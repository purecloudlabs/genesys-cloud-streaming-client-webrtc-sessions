'use strict';

const MediaDataSession = require('jingle-media-data-session-purecloud');
const MediaSession = require('jingle-media-session-purecloud');
const uuid = require('uuid');
const WildEmitter = require('wildemitter');
const LRU = require('lru-cache');
const Jingle = require('jingle-purecloud');
const jingleMessage = require('jingle-stanza/stanzas/jingleMessage');

const {
  events,
  labels,
  jingleEvents
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

const STANZA_EVENTS = [
  'iq:set:jingle',
  'iq:get:jingle'
];

function prepareSession (options) {
  if (options.peerID.toString().indexOf('@conference') > -1) {
    const session = new MediaSession(options);

    // set up the last-n datachannel
    session.on('addChannel', function (channel) {
      session.lastNChannel = channel;
      channel.onmessage = function (message) {
        if (message && message.data) {
          return session.emit(events.LASTN_CHANGE, JSON.parse(message.data));
        }
      };
      return channel.onmessage;
    });
    return session;
  }

  // one to one rooms use MediaDataSession if datachannel is enabled
  const applicationTypes = Array.from(options.applicationTypes);
  if (applicationTypes.includes('rtp') && applicationTypes.includes('datachannel')) {
    return new MediaDataSession(options);
  }
  return new MediaSession(options);
}

const existingOnIceCandidate = MediaSession.prototype.onIceCandidate;
MediaSession.prototype.onIceCandidate = function (opts, e) {
  if (e.candidate && !opts.allowIPv6) {
    const addressRegex = /.+udp [^ ]+ ([^ ]+).*typ host/;
    const matches = addressRegex.exec(e.candidate.candidate);

    const ipv4Regex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
    if (matches && !matches[1].match(ipv4Regex)) {
      this._log('debug', 'Filtering out IPv6 candidate', e.candidate.candidate);
      return;
    }
  }
  if (e.candidate) {
    this._log('debug', 'Processing ice candidate', e.candidate.candidate);
  }
  existingOnIceCandidate.call(this, ...arguments);
};

MediaSession.prototype._log = function (level, message, details) {
  // for backward compatibility, but also logging details
  const msg = `${this.sid}: ${message}`;
  this.emit(`log:${level}`, msg, details);
};

export default class JingleSessionManager extends WildEmitter {
  constructor (client, clientOptions = {}) {
    super();

    const stanzaio = client._stanzaio;

    stanzaio.disco.addFeature('urn:xmpp:jingle:1');
    if (typeof window !== 'undefined' && window.RTCPeerConnection) {
      CAPABILITIES.forEach(c => stanzaio.disco.addFeature(c));
    }

    // Define an extension for Jingle RTP for Data Channel, since jingle-xmpp-types
    // does not have it, for some reason
    stanzaio.stanzas.withDefinition('content', 'urn:xmpp:jingle:1', function (Content) {
      stanzaio.stanzas.extend(Content, stanzaio.stanzas.define({
        name: '_datachannel',
        namespace: 'urn:xmpp:jingle:transports:webrtc-datachannel:0',
        element: 'description',
        tags: ['jingle-application'],
        fields: {
          applicationType: { value: 'datachannel', writable: true }
        }
      }));
    });

    // Define an extension for presence to support our proprietary media presence
    const attribute = stanzaio.stanzas.utils.attribute;
    const MediaStream = stanzaio.stanzas.define({
      name: 'mediastream',
      tags: ['mediastream'],
      element: 'mediastream',
      fields: {
        audio: attribute('audio'),
        video: attribute('video'),
        listener: attribute('listener'),
        screenShare: attribute('screenShare'),
        screenRecording: attribute('screenRecording')
      }
    });

    const MediaPresence = stanzaio.stanzas.define({
      name: 'media',
      namespace: 'orgspan:mediastream',
      element: 'x',
      tags: ['mediapresence'],
      fields: {
        conversationId: attribute('conversationId'),
        sourceCommunicationId: attribute('sourceCommunicationId')
      }
    });

    const StateDump = stanzaio.stanzas.define({
      name: 'statedump',
      namespace: 'urn:xmpp:jingle:apps:rtp:info:1',
      element: 'state-dump',
      fields: {
        requestId: attribute('requestId')
      }
    });

    const ScreenStart = stanzaio.stanzas.define({
      name: 'screenstart',
      namespace: 'urn:xmpp:jingle:apps:rtp:info:1',
      element: 'screen-start'
    });

    const ScreenStop = stanzaio.stanzas.define({
      name: 'screenstop',
      namespace: 'urn:xmpp:jingle:apps:rtp:info:1',
      element: 'screen-stop'
    });

    stanzaio.stanzas.withDefinition('jingle', 'urn:xmpp:jingle:1', function (Jingle) {
      stanzaio.stanzas.extend(Jingle, StateDump);
      stanzaio.stanzas.extend(Jingle, ScreenStart);
      stanzaio.stanzas.extend(Jingle, ScreenStop);
    });

    stanzaio.stanzas.extend(MediaPresence, MediaStream, 'mediaStreams');
    stanzaio.stanzas.extendPresence(MediaPresence);

    // Extend messages for jingleMessage (propose/proceed/etc)
    stanzaio.stanzas.use(jingleMessage);

    this.config = {
      iceTransportPolicy: clientOptions.iceTransportPolicy,
      iceServers: clientOptions.iceServers,
      // all default to true
      signalEndOfCandidates: clientOptions.signalEndOfCandidates !== false,
      signalIceConnected: clientOptions.signalIceConnected !== false,
      rtcSessionSurvivability: clientOptions.rtcSessionSurvivability !== false,
      disableEOCShortCircuit: clientOptions.disableEOCShortCircuit !== false,
      allowIPv6: clientOptions.allowIPv6 === true
    };
    this.jingleJs = new Jingle({
      iceServers: this.config.iceServers,
      prepareSession: options => {
        options.iceTransportPolicy = this.config.iceTransportPolicy || 'all';
        options.signalEndOfCandidates = this.config.signalEndOfCandidates;
        options.signalIceConnected = this.config.signalIceConnected;
        options.disableEOCShortCircuit = this.config.disableEOCShortCircuit;
        options.allowIPv6 = this.config.allowIPv6;
        options.iceServers = this.config.iceServers;
        return prepareSession(options);
      }
    });
    this.pendingSessions = {};
    this.pendingIqs = {};

    // can ignore up to 10 sessions for up to 6 hours
    this.ignoredSessions = new LRU({ max: 10, maxAge: 10 * 60 * 60 * 6 });

    this.logger = client.logger;

    stanzaio.on('disconnect', () => {
      if (this.config.rtcSessionSurvivability === false) {
        this.pendingSessions = {};
        this.pendingIqs = {};
        return this.jingleJs.endAllSessions('disconnect');
      }
    });

    this.client = client;

    client.on('connected', () => {
      this.refreshIceServers();
    });

    if (client.connected) {
      this.refreshIceServers();
    }

    this.setupStanzaHandlers();
    STANZA_EVENTS.forEach(e => stanzaio.on(e, this.stanzaHandlers.jingle));
    stanzaio.on('stream:data', (data) => {
      const json = data ? data.toJSON() : null;
      if (!json) {
        return;
      }
      if (data._name !== 'message') {
        return;
      }
      this.checkStanza(json, data);
    });
    this.proxyEvents();
  }

  get jid () {
    return this.client._stanzaio.jid;
  }

  proxyEvents () {
    this.jingleJs.on('send', data => {
      if (data.jingle && data.jingle.sid && this.ignoredSessions.get(data.jingle.sid)) {
        this.logger.debug('Ignoring outbound stanza for ignored session', data.jingle.sid);
        return;
      }
      this.emit('send', data);
    });

    this.jingleJs.on('outgoing', session => {
      return this.emit(events.OUTGOING_RTCSESSION, session);
    });

    this.jingleJs.on('incoming', session => {
      return this.emit(events.INCOMING_RTCSESSION, session);
    });

    this.jingleJs.on('log:*', (level, msg, details) => {
      return this.emit(events.TRACE_RTCSESSION, level.split(':')[1], msg, details);
    });

    this.jingleJs.on('error', req => {
      return this.emit(events.RTCSESSION_ERROR, req.error, req);
    });
  }

  // Incoming stanzas from the server
  checkStanza (stanza, raw) {
    Object.keys(this.stanzaCheckers).forEach(handlerName => {
      // call the checker above to determine which handler (if any) should handle the stanza
      const shouldHandleStanza = this.stanzaCheckers[handlerName](stanza);
      if (shouldHandleStanza) {
        // if so, call the corresponding method
        this.stanzaHandlers[handlerName](stanza, raw);
      }
    });
  }

  // stanza events to register with stanza.io
  get stanzaEvents () {
    return [...STANZA_EVENTS];
  }

  handleIq () {
    // no-op - we register for iq's with stanzaEvents
  }

  handleMessage () {
    // no-op - we do a custom handler
  }

  refreshIceServers () {
    const getServices = (type) => this.client._stanzaio.getServices(this.client._stanzaio.jid.domain, type);
    const turn = getServices('turn');
    const stun = getServices('stun');

    return Promise.all([turn, stun])
      .then((responses) => {
        const turnServers = responses[0].services.services;
        const stunServers = responses[1].services.services;
        this.logger.debug('STUN/TURN server discovery result', { turnServers, stunServers });
        const iceServers = [...turnServers, ...stunServers].map(service => {
          const ice = { type: service.type };
          const port = service.port ? `:${service.port}` : '';
          ice.urls = `${service.type}:${service.host}${port}`;
          if (['turn', 'turns'].includes(service.type)) {
            if (service.transport && (service.transport !== 'udp')) {
              ice.urls += `?transport=${service.transport}`;
            }
            if (service.username) {
              ice.username = service.username;
            }
            if (service.password) {
              ice.credential = service.password;
            }
          }
          return ice;
        });
        this.expose.setIceServers(iceServers);
        return this.jingleJs.iceServers;
      })
      .catch((err) => {
        this.logger.warn('Failed to fetch ice servers, retrying in 5 seconds', err);
        setTimeout(() => {
          this.refreshIceServers()
            .catch(err => this.logger.warn('Failed to fetch ice servers on retry; will keep trying until success', err));
        }, 5000);
        return Promise.reject(err);
      });
  }

  handleEndRtcSessionsWithJid ({ jid, reason }) {
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
      config: this.config,
      setIceServers: function (iceServers) {
        this.config.iceServers = iceServers;
        this.jingleJs.config.peerConnectionConfig.iceServers = iceServers;
        this.jingleJs.iceServers = iceServers;
      }.bind(this),

      getIceServers: function () {
        return this.jingleJs.iceServers;
      }.bind(this),

      refreshIceServers: function () {
        return this.refreshIceServers();
      }.bind(this),

      on: function (event, handler) {
        this.on(event, handler);
      }.bind(this),

      once: function (event, handler) {
        this.once(event, handler);
      }.bind(this),

      off: function (event, handler) {
        this.off(event, handler);
      }.bind(this),

      createRtcSession: function ({ jid, sid, stream, peerConstraints, peerConnectionConstraints }) {
        // outbound video chat
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
            signalEndOfCandidates: this.config.signalEndOfCandidates,
            signalIceConnected: this.config.signalIceConnected,
            iceTransportPolicy: this.config.iceTransportPolicy,
            disableEOCShortCircuit: this.config.disableEOCShortCircuit
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
        // send media presence to join conference or screen screenRecording
        // or send propose to single client for 1:1 video chat
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
          session.propose.descriptions.push({ media: opts.mediaPurpose });
        }

        if (opts.jid.match(/@conference/)) {
          let mediaDescriptions = session.propose.descriptions;
          if (mediaDescriptions.length === 0) {
            mediaDescriptions = [{ media: 'listener' }];
          }

          const Presence = this.client._stanzaio.stanzas.getPresence();
          const mediaPresence = {
            type: 'upgradeMedia',
            to: opts.jid,
            id: uuid(),
            from: this.client._stanzaio.jid.full,
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

          this.client._stanzaio.send(new Presence(mediaPresence));
        } else {
          this.emit('send', session, true); // send as Message
          this.pendingSessions[session.propose.id] = session;
        }

        return session.propose.id;
      }.bind(this),

      endRtcSessions: function (opts, reason = 'success', callback = () => { }) {
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

          // TODO: can we kill callback? This seems useless
          return callback(null);
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

        const retract = {
          to: session.to,
          retract: {
            id: sessionId
          }
        };
        this.emit('send', retract, true); // send as Message
        delete this.pendingSessions[sessionId];
      }.bind(this),

      rtcSessionAccepted: function (sessionId) {
        const accept = {
          to: this.jid.bare,
          accept: {
            id: sessionId
          }
        };
        this.emit('send', accept, true); // send as Message
      }.bind(this),

      acceptRtcSession: function (sessionId) {
        const session = this.pendingSessions[sessionId];
        if (!session) {
          this.emit(
            events.RTCSESSION_ERROR,
            'Cannot accept session because it is not pending or does not exist'
          );
          return;
        }

        const proceed = {
          to: session.from.toString(),
          proceed: {
            id: sessionId
          }
        };
        this.emit('send', proceed, true); // send as Message
        delete this.pendingSessions[sessionId];
      }.bind(this),

      rejectRtcSession: function (sessionId, ignore) {
        const session = this.pendingSessions[sessionId];
        if (!session) {
          this.emit(
            events.RTCSESSION_ERROR,
            'Cannot reject session because it is not pending or does not exist'
          );
          return;
        }
        if (ignore) {
          this.ignoredSessions.set(sessionId, true);
        } else {
          const reject1 = {
            to: this.jid.bare,
            reject: {
              id: sessionId
            }
          };
          this.emit('send', reject1, true); // send as Message
          const reject2 = {
            to: session.from.toString(),
            reject: {
              id: sessionId
            }
          };
          this.emit('send', reject2, true); // send as Message
        }
        delete this.pendingSessions[sessionId];
      }.bind(this),

      requestStateDump: function (session, requestId) {
        this.emit('send', {
          to: session.peerID,
          from: this.jid.bare,
          type: 'set',
          jingle: {
            action: 'session-info',
            sid: session.sid,
            statedump: {
              requestId
            }
          }
        });
      }.bind(this),

      notifyScreenShareStart: function (session) {
        this.emit('send', {
          to: `${session.peerID}`,
          from: this.jid.bare,
          type: 'set',
          jingle: {
            action: 'session-info',
            sid: session.sid,
            screenstart: {}
          }
        });
      }.bind(this),

      notifyScreenShareStop: function (session) {
        this.emit('send', {
          to: `${session.peerID}`,
          from: this.jid.bare,
          type: 'set',
          jingle: {
            action: 'session-info',
            sid: session.sid,
            screenstop: {}
          }
        });
      }.bind(this)
    };
  }

  // these are the events exposed by the session
  get exposeEvents () {
    return Object.keys(jingleEvents).map(e => jingleEvents[e]);
  }

  // these are functions to check each stanza and return a predicate (A function that evaluates to true/false)
  get stanzaCheckers () {
    return {
      // https://xmpp.org/extensions/xep-0353.html
      jingleMessageInit: stanza => !!(stanza.propose && stanza.propose.id),
      jingleMessageRetract: stanza => !!(stanza.retract && stanza.retract.id),
      jingleMessageAccept: stanza => !!(stanza.accept && stanza.accept.id),
      jingleMessageProceed: stanza => !!(stanza.proceed && stanza.proceed.id),
      jingleMessageReject: stanza => !!(stanza.reject && stanza.reject.id)
    };
  }

  // these are the functions to handle each stanza that should be handled
  setupStanzaHandlers () {
    this.stanzaHandlers = {
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
        }

        if (stanza.jingle && stanza.jingle.sid && this.ignoredSessions.get(stanza.jingle.sid)) {
          this.logger.debug('Ignoring inbound stanza for ignored webrtc session', stanza.jingle.sid);
          return;
        }

        // the core of handling jingle stanzas is to feed them to jinglejs
        this.jingleJs.process(stanza);
      }.bind(this),

      jingleMessageInit: function (stanza, raw) {
        if (stanza.from === this.jid.bare) {
          return;
        }
        if (stanza.ofrom) {
          let fromJid = stanza.ofrom;
          if (fromJid.toString() === this.jid.bare) {
            return;
          }
          stanza.from = fromJid.toString();
        }
        this.pendingSessions[stanza.propose.id] = stanza;
        const roomJid = (stanza.ofrom && stanza.ofrom.full) || stanza.from.full || stanza.from;
        return this.emit(events.REQUEST_INCOMING_RTCSESSION, {
          sessionId: stanza.propose.id,
          conversationId: raw.propose.xml.attrs['inin-cid'],
          autoAnswer: raw.propose.xml.attrs['inin-autoanswer'] === 'true',
          persistentConnectionId: raw.propose.xml.attrs['inin-persistent-cid'],
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
        if (stanza.from.toString() === this.jid.bare) {
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
