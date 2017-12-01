'use strict';

const MediaDataSession = require('jingle-media-data-session-purecloud');
const MediaSession = require('jingle-media-session-purecloud');
const uuid = require('uuid');
const WildEmitter = require('wildemitter');
const Jingle = require('jingle-purecloud');

const {
  events,
  labels,
  stanzaEvents
} = require('../constants');

const CAPABILITIES = [
  'urn:xmpp:jingle:apps:rtp:1',
  'urn:xmpp:jingle:apps:rtp:audio',
  'urn:xmpp:jingle:apps:rtp:video',
  'urn:xmpp:jingle:apps:rtp:rtcb-fb:0',
  'urn:xmpp:jingle:apps:rtp:rtp-hdrext:0',
  'urn:xmpp:jingle:apps:rtp:ssma:0',
  'urn:xmpp:jingle:apps:dtls:0',
  'urn:xmpp:jingle:apps:grouping:0',
  'urn:xmpp:jingle:apps:file-transfer:3',
  'urn:xmpp:jingle:transports:ice-udp:1',
  'urn:xmpp:jingle:transports:dtls-sctp:1',
  'urn:ietf:rfc:3264',
  'urn:ietf:rfc:5576',
  'urn:ietf:rfc:5888'
];

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

    stanzaClient.disco.addFeature('urn:xmpp:jingle:1');
    if (typeof window !== 'undefined' && window.RTCPeerConnection) {
      CAPABILITIES.forEach(c => stanzaClient.disco.addFeature(c));
    }

    // Define an extension for Jingle RTP for Data Channel, since jingle-xmpp-types
    // does not have it, for some reason
    stanzaClient.stanzas.withDefinition('content', 'urn:xmpp:jingle:1', function (Content) {
      stanzaClient.stanzas.extend(Content, stanzaClient.stanzas.define({
        name: '_datachannel',
        namespace: 'urn:xmpp:jingle:transports:webrtc-datachannel:0',
        element: 'description',
        tags: ['jingle-application'],
        fields: {
          applicationType: { value: 'datachannel' }
        }
      }));
    });

    // Define an extension for presence to support our proprietary media presence
    const attribute = stanzaClient.stanzas.utils.attribute;
    const MediaStream = stanzaClient.stanzas.define({
      name: 'mediastream',
      tags: ['mediastream'],
      element: 'mediastream',
      fields: {
        audio: attribute('audio'),
        video: attribute('video'),
        screenRecording: attribute('screenRecording')
      }
    });

    const MediaPresence = stanzaClient.stanzas.define({
      name: 'media',
      namespace: 'orgspan:mediastream',
      element: 'x',
      tags: ['mediapresence'],
      fields: {
        conversationId: attribute('conversationId'),
        sourceCommunicationId: attribute('sourceCommunicationId')
      }
    });

    stanzaClient.stanzas.extend(MediaPresence, MediaStream, 'mediaStreams');
    stanzaClient.stanzas.extendPresence(MediaPresence);

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

    this.stanzaClient = stanzaClient;
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
      setIceServers: function (iceServers) {
        this.jingleJs.iceServers = iceServers;
      }.bind(this),

      getIceServers: function () {
        return this.jingleJs.iceServers;
      }.bind(this),

      on: function (event, handler) {
        this.on(event, handler);
      }.bind(this),

      off: function (event, handler) {
        this.off(event, handler);
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

      initiateRtcSession: function (opts) {
        const session = {
          to: opts.jid,
          propose: {
            id: uuid.v1(),
            descriptions: []
          }
        };
        if (opts.stream) {
          for (let track of Array.from(opts.stream.getTracks())) {
            session.propose.descriptions.push({ media: track.kind });
          }
        }

        if (opts.mediaPurpose) {
          session.propose.descriptions.push({media: opts.mediaPurpose});
        }

        if (opts.jid.match(/@conference/)) {
          let mediaDescriptions = session.propose.descriptions;
          if (mediaDescriptions.length === 0) {
            mediaDescriptions = [ { media: 'listener' } ];
          }

          const Presence = this.stanzaClient.stanzas.getPresence();
          const mediaPresence = {
            type: mediaDescriptions.length ? 'upgradeMedia' : 'available',
            to: opts.jid,
            id: uuid(),
            from: this.stanzaClient.config.jid,
            media: {
              conversationId: opts.conversationId,
              sourceCommunicationId: opts.sourceCommunicationId,
              mediaStreams: [
                {}
              ]
            }
          };

          // TODO? can't set last-n on parent element because it invalidates presence root schema

          const mediaStreamDescription = mediaPresence.media.mediaStreams[0];
          for (const mediaDescription of mediaDescriptions) {
            mediaStreamDescription[mediaDescription.media] = 'true';
          }

          this.stanzaClient.send(new Presence(mediaPresence));
        } else {
          this.emit('send', session, true); // send as Message
          this.pendingSessions[session.propose.id] = session;
        }

        return session.propose.id;
      }.bind(this),

      endRtcSessions: function (opts, reason = 'success', callback = () => {}) {
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
          this.handleEndRtcSessionsWithJid({ jid, reason });

          if (jid.match(/@conference/)) {
            this.emit(events.UPDATE_MEDIA_PRESENCE, {
              opts: { jid },
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
        return !!stanza.jingle;
      },

      requestWebRtcDump: stanza => {
        const isIQ = stanza._name === 'iq';
        return isIQ && stanza.services && stanza.type === 'get' && stanza.kind === 'webrtcDump';
      },

      iceServers: stanza => {
        return stanza.services && ['set', 'result'].includes(stanza.type);
      },

      // https://xmpp.org/extensions/xep-0353.html
      jingleMessageInit: stanza => {
        const isMessage = stanza._name === 'message';
        return stanza.propose && isMessage;
      },

      jingleMessageRetract: stanza => {
        const isMessage = stanza._name === 'message';
        return stanza.retract && isMessage;
      },

      jingleMessageAccept: stanza => {
        const isMessage = stanza._name === 'message';
        return stanza.accept && isMessage;
      },

      jingleMessageProceed: stanza => {
        const isMessage = stanza._name === 'message';
        return stanza.proceed && isMessage;
      },

      jingleMessageReject: stanza => {
        const isMessage = stanza._name === 'message';
        return stanza.reject && isMessage;
      },

      // todo this is realtime specific, might not go in firehose
      upgradeError: stanza => {
        const isPresence = stanza._name === 'presence';
        return isPresence && stanza.type === 'error' &&
            stanza.originalType === 'upgradeMedia' &&
            stanza.from.match(/@conference/) &&
            String.prototype.toString.call(stanza.to) === this.jid.bare().toString();
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
        }

        this.jingleJs.process(stanza);
      }.bind(this),

      requestWebrtcDump: function (stanza) {
        return this.emit(
          events.REQUEST_WEBRTC_DUMP,
          stanza.attrs.requestId
        );
      }.bind(this),

      jingleMessageInit: function (stanza) {
        if (stanza.from === this.jid.bare().toString()) {
          return;
        }
        if (stanza.ofrom) {
          let fromJid = stanza.ofrom;
          if (fromJid.toString() === this.jid.bare().toString()) {
            return;
          }
          stanza.from = fromJid.toString();
        }
        this.pendingSessions[stanza.propose.id] = stanza.propose.id;
        const roomJid = (stanza.ofrom && stanza.ofrom.full) || stanza.from.full || stanza.from;
        return this.emit('requestIncomingRtcSession', {
          sessionId: stanza.propose.id,
          conversationId: stanza.propose.xml.attrs['inin-cid'],
          autoAnswer: stanza.propose.xml.attrs['inin-autoanswer'],
          persistentConnectionId: stanza.propose.xml.attrs['inin-persistent-cid'],
          roomJid,
          fromJid: stanza.from.full || stanza.from
        });
      }.bind(this),

      jingleMessageRetract: function (stanza) {
        this.emit(events.CANCEL_INCOMING_RTCSESSION, stanza.retract.id);
        return delete this.pendingSessions[stanza.retract.id];
      }.bind(this),

      jingleMessageAccept: function (stanza) {
        if (stanza.from.toString() === this.jid.toString()) {
          return;
        }
        this.emit(events.HANDLED_INCOMING_RTCSESSION, stanza.accept.id);
        delete this.pendingSessions[stanza.accept.id];
      }.bind(this),

      jingleMessageProceed: function (stanza) {
        return this.emit(
          events.OUTGOING_RTCSESSION_PROCEED,
          stanza.proceed.id,
          stanza.from.full
        );
      }.bind(this),

      jingleMessageReject: function (stanza) {
        if (stanza.from.toString() === this.jid.toString()) {
          return;
        }
        if (stanza.from.toString() === this.jid.bare().toString()) {
          this.emit(
            events.HANDLED_INCOMING_RTCSESSION,
            stanza.reject.id
          );
        } else {
          this.emit(
            events.OUTGOING_RTCSESSION_REJECTED,
            stanza.reject.id
          );
        }
        delete this.pendingSessions[stanza.reject.id];
      }.bind(this)
    };
  }
}

module.exports = JingleSessionManager;
