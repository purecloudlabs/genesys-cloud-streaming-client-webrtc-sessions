'use strict';

const MediaDataSession = require('jingle-media-data-session-purecloud');
const MediaSession = require('jingle-media-session-purecloud');
const jingleStanza = require('jingle-stanza');
const uuid = require('uuid');
const WildEmitter = require('wildemitter');
const Jingle = require('jingle-purecloud');

const {
  events,
  labels,
  stanzaEvents
} = require('../constants');

const guard = require('../utils').guard;

function prepareSession (options) {
  options.signalEndOfCandidates = options.signalEndOfCandidates || true;

  if (options.peerID.toString().indexOf('@conference') > -1) {
    const session = new MediaSession(options);

    // set up the last-n datachannel
    session.on('addChannel', function (channel) {
      session.lastNChannel = channel;
      channel.onmessage = function (message) {
        if (guard(message, x => x.data)) {
          return session.emit(events.LASTN_CHANGE, JSON.parse(message.data));
        }
      };
      return channel.onmessage;
    });
    return session;
  }

  // one to one rooms use MediaDataSession if datachannel is enabled
  if (Array.from(options.applicationTypes).includes('rtp')) {
    if (Array.from(options.applicationTypes).includes('datachannel')) {
      return new MediaDataSession(options);
    } else {
      return new MediaSession(options);
    }
  }
}

class JingleSessionManager extends WildEmitter {
  constructor (stanzaClient, clientOptions = {}) {
    super();
    this.iceServers = clientOptions.iceServers || [];
    this.jingleJs = new Jingle({
      iceServers: this.iceServers,
      prepareSession: prepareSession
    });
    this.pendingSessions = {};

    this.logger = clientOptions.logger || console;

    this.jid = stanzaClient.jid;

    stanzaClient.on('disconnect', () => {
      if (clientOptions.rtcSessionSurvivability !== true) {
        this.pendingSessions = {};
        this.pendingIqs = {};
        return this.jingleJs.endAllSessions('disconnect');
      }
    });

    this.proxyEvents();
  }

  proxyEvents () {
    this.jingleJs.on('send', data => {
      this.emit('send', data);
    });

    this.jingleJs.on('outgoing', session => {
      return this.emit(events.OUTGOING_RTCSESSION_PROCEED, session);
    });

    this.jingleJs.on('incoming', session => {
      return this.emit(events.INCOMING_RTCSESSION, session);
    });

    this.jingleJs.on('log:*', (level, msg) => {
      return this.emit(events.TRACE_RTCSESSION, level.split(':')[1], msg);
    });

    this.jingleJs.on('error', req => {
      return this.emit(events.RTCSESSION_ERROR, req.error, req);
    });
  }

  // Incoming stanzas from the server
  checkStanza (stanza) {
    Object.keys(this.stanzaCheckers).forEach(handlerName => {
      // call the checker above to determine which handler (if any) should handle the stanza
      const shouldHandleStanza = this.stanzaCheckers[handlerName](stanza);
      if (shouldHandleStanza) {
        // if so, call the corresponding method
        this.stanzaHandlers[handlerName](stanza);
      }
    });
  }

  handleIq (stanza) {
    this.checkStanza(stanza);
  }

  handleMessage (stanza) {
    this.checkStanza(stanza);
  }

  handleEndRtcSessionsWithJid ({jid, reason}) {
    Object.keys(this.jingleJs.peers).forEach((peerId) => {
      if (peerId.indexOf(jid) < 0) {
        return;
      }

      this.jingleJs.endPeerSessions(peerId, reason);

      const sessions = Object.keys(this.pendingSessions);
      sessions.forEach(sessionId => {
        if (this.pendingSessions[sessionId].to === peerId) {
          delete this.pendingSessions[sessionId];
        }
      });
    });
  }

  // these are the methods exposed on the extension (session manager)
  get expose () {
    return {
      getIceServers: function () {
        return this.iceServers;
      }.bind(this),

      createRtcSession: function ({jid, sid, stream, peerConstraints, peerConnectionConstraints}) {
        this.logger.info('video', 'startVideoChat', jid);

        peerConstraints = peerConstraints || { offerToReceiveAudio: true, offerToReceiveVideo: true };

        peerConnectionConstraints = peerConnectionConstraints || this.jingleJs.config.peerConnectionConstraints;

        try {
          let session;
          const opts = {
            sid,
            peer: jid,
            initiator: true,
            stream,
            parent: this.jingleJs,
            iceServers: this.jingleJs.iceServers,
            constraints: peerConnectionConstraints,
            signalEndOfCandidates: true
          };

          if (peerConstraints.offerToReceiveAudio || peerConstraints.offerToReceiveVideo) {
            session = new MediaDataSession(opts);
          } else {
            session = new MediaSession(opts);
          }

          this.jingleJs.addSession(session);

          return session.start(peerConstraints);
        } catch (err) {
          return this.emit(events.RTCSESSION_ERROR, err);
        }
      }.bind(this),

      initiateRtcSession: function ({opts, callback = function () {}}) {
        const session = {
          to: opts.jid,
          propose: {
            id: uuid.v1(),
            descriptions: []
          }
        };
        if (opts.stream) {
          for (let track of Array.from(opts.stream.getTracks())) {
            session.propose.descriptions.push({
              media: track.kind
            });
          }
        }

        if (opts.jid.match(/@conference/)) {
          let mediaDescriptions = session.propose.descriptions;
          if (mediaDescriptions.length === 0) {
            mediaDescriptions = [ { media: 'listener' } ];
          }

          // this is problematic, because this is a realtime thing. need to figure out what to do here
          // probably just construct the stanza
          this.emit(events.UPDATE_MEDIA_PRESENCE, {
            opts: opts,
            mediaDescriptions: mediaDescriptions,
            callback: callback
          });
        } else {
          this.emit('send', session, true); // send as Message
          this.pendingSessions[session.propose.id] = session;
          callback(null);
        }

        return session.propose.id;
      }.bind(this),

      endRtcSessions: function ({opts, reason = 'success', callback = function () {}}) {
        if (typeof opts === 'function') {
          callback = opts;
          opts = { jid: null };
        } else if (typeof opts === 'string') {
          opts = { jid: opts };
        } else if (!opts) {
          opts = {};
        }

        if (typeof reason === 'function') {
          callback = reason;
          reason = labels.SUCCESS;
        }

        const jid = opts.jid || opts.oneToOneJid;

        if (jid) {
          // TODO: remove if-block after PCDWEBK-3533 (realtime and web-directory) has been merged and shipped to all environments
          // and after web-directory has removed their use of "oneToOneJid"
          if (opts.oneToOneJid) {
            this.logger.warn('use of oneToOneJid with endRtcSessions is deprecated. please use "opts.jid"');
          }

          this.handleEndRtcSessionsWithJid({jid, reason});

          if (jid.match(/@conference/)) {
            this.emit(events.UPDATE_MEDIA_PRESENCE, {
              opts: {jid},
              mediaDescriptions: [],
              callback: callback
            });
          } else {
            return callback();
          }
        } else {
          this.jingleJs.endAllSessions(reason);
          this.pendingSessions = {};

          return callback(null);
        }
      }.bind(this),

      cancelRtcSession: function (sessionId) {
        const session = this.pendingSessions[sessionId];
        if (!session) {
          this.emit(
            events.RTCSESSION_ERROR,
            'Cannot cancel session because it is not pending or does not exist'
          );
          return;
        }

        const message = {
          to: session.to,
          retract: {
            id: sessionId
          }
        };
        this.emit('send', message);
        delete this.pendingSessions[sessionId];
      }.bind(this),

      acceptRtcSession: function (sessionId) {
        let accept, proceed, session;
        session = this.pendingSessions[sessionId];
        if (!session) {
          this.emit(
            events.RTCSESSION_ERROR,
            'Cannot accept session because it is not pending or does not exist'
          );
          return;
        }
        accept = {
          to: this.jid.bare().toString(),
          accept: {
            id: sessionId
          }
        };
        this.emit('send', accept);
        proceed = {
          to: session.from.toString(),
          proceed: {
            id: sessionId
          }
        };
        this.emit('send', proceed);
        delete this.pendingSessions[sessionId];
      }.bind(this),

      rejectRtcSession: function (sessionId) {
        let reject, session;
        session = this.pendingSessions[sessionId];
        if (!session) {
          this.emit(
            events.RTCSESSION_ERROR,
            'Cannot reject session because it is not pending or does not exist'
          );
          return;
        }
        reject = {
          to: this.jid.bare().toString(),
          reject: {
            id: sessionId
          }
        };
        this.emit('send', reject);
        reject.to = session.from.toString();
        this.emit('send', reject);
        delete this.pendingSessions[sessionId];
      }.bind(this)
    };
  }

  // these are the events exposed by the session
  get exposeEvents () {
    return Object.keys(stanzaEvents).map(e => stanzaEvents[e]);
  }

  // these are functions to check each stanza and return a predicate (A function that evaluates to true/false)
  get stanzaCheckers () {
    return {
      // https://xmpp.org/extensions/xep-0166.html
      jingle: stanza => {
        const isIQ = stanza._name === 'iq';
        return isIQ && (
          (stanza.type === 'set' && stanza.jingle) ||
          (stanza.type === 'result' && stanza.xml.children.length === 0) || // todo: better way?
          (stanza.type === 'error' && stanza.error)
        );
      },
      requestWebRtcDump: stanza => {
        const isIQ = stanza._name === 'iq';
        return isIQ && stanza.services && stanza.type === 'get' && stanza.kind === 'webrtcDump';
      },
      iceServers: stanza => {
        const isIQ = stanza._name === 'iq';
        return isIQ && stanza.services && ['set', 'result'].includes(stanza.type);
      },

      // https://xmpp.org/extensions/xep-0353.html
      jingleMessageInit: stanza => {
        const isMessage = stanza._name === 'message';
        return isMessage && stanza.services && stanza.type === 'propose';
      },
      jingleMessageRetract: stanza => {
        const isMessage = stanza._name === 'message';
        return isMessage && stanza.services && stanza.type === 'retract';
      },
      jingleMessageAccept: stanza => {
        const isMessage = stanza._name === 'message';
        return isMessage && stanza.services && stanza.type === 'accept';
      },
      jingleMessageProceed: stanza => {
        const isMessage = stanza._name === 'message';
        return isMessage && stanza.services && stanza.type === 'proceed';
      },
      jingleMessageReject: stanza => {
        const isMessage = stanza._name === 'message';
        return isMessage && stanza.services && stanza.type === 'reject';
      },

      // todo this is realtime specific, might not go in firehose
      upgradeError: stanza => {
        const isPresence = stanza._name === 'presence';
        return isPresence && stanza.type === 'error' &&
            stanza.originalType === 'upgradeMedia' &&
            stanza.to.toString() === this.jid.toString() &&
            stanza.from.match(/@conference/);
      }
    };
  }

  // these are the functions to handle each stanza that should be handled
  get stanzaHandlers () {
    return {
      jingle: function (stanza) {
        if (['result', 'error'].includes(stanza.type)) {
          const pendingIq = this.pendingIqs[stanza.id];
          if (pendingIq) {
            // Workaround for https://github.com/otalk/jingle.js/issues/34
            stanza.jingle = pendingIq.jingle;
            delete this.pendingIqs[stanza.id];
          } else {
            return; // this is an error or result for a stanza we did not send
          }

          // the core of handling jingle stanzas is to feed them to jinglejs
          this.jingleJs.process(stanza.toJSON()); // todo: do we need toJSON()?
        }
      }.bind(this),

      requestWebrtcDump: function (stanza) {
        return this.emit(
          events.REQUEST_WEBRTC_DUMP,
          stanza.attrs.requestId
        );
      }.bind(this),

      jingleMessageInit: function (stanza) {
        const session = jingleStanza.getData(stanza).toJSON();
        if (session.from.bare === this.jid.bare().toString()) {
          return;
        }
        if (stanza.attrs.ofrom) {
          let fromJid = stanza.attrs.ofrom;
          if (fromJid.bare().toString() === this.jid.bare().toString()) {
            return;
          }
          session.from = fromJid.toString();
        }
        this.pendingSessions[session.propose.id] = session;
        const roomJid = (session.ofrom && session.ofrom.full) || session.from.full || session.from;
        return this.emit('requestIncomingRtcSession', {
          sessionId: session.propose.id,
          conversationId: stanza.getChild('propose').attrs['inin-cid'],
          autoAnswer: stanza.getChild('propose').attrs['inin-autoanswer'] === 'true',
          persistentConnectionId: stanza.getChild('propose').attrs['inin-persistent-cid'],
          roomJid,
          fromJid: session.from.full || session.from
        });
      }.bind(this),

      jingleMessageRetract: function (stanza) {
        const session = jingleStanza.getData(stanza);
        this.emit(events.CANCEL_INCOMING_RTCSESSION, session.retract.id);
        return delete this.pendingSessions[session.retract.id];
      }.bind(this),

      jingleMessageAccept: function (stanza) {
        const session = jingleStanza.getData(stanza);
        if (session.from.toString() === this.jid.toString()) {
          return;
        }
        this.emit(events.HANDLED_INCOMING_RTCSESSION, session.accept.id);
        delete this.pendingSessions[session.accept.id];
      }.bind(this),

      jingleMessageProceed: function (stanza) {
        const session = jingleStanza.getData(stanza);
        return this.emit(events.OUTGOING_RTCSESSION_PROCEED, session.proceed.id, session.from.full);
      }.bind(this),

      jingleMessageReject: function (stanza) {
        var session;
        session = jingleStanza.getData(stanza);
        if (session.from.toString() === this.jid.toString()) {
          return;
        }
        if (session.from.bare === this.jid.bare().toString()) {
          this.emit(events.HANDLED_INCOMING_RTCSESSION, session.reject.id);
        } else {
          this.emit(events.OUTGOING_RTCSESSION_REJECTED, session.reject.id);
        }
        delete this.pendingSessions[session.reject.id];
      }.bind(this)
    };
  }
}

module.exports = JingleSessionManager;
