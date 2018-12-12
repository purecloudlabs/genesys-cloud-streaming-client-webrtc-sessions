'use strict';

const test = require('ava');
const sinon = require('sinon');
const jingleStanza = require('jingle-stanza');

const {
  events
} = require('../../constants');

const {
  jingleActionStanza,
  iceServersStanza,
  jingleMessageInitStanza,
  jingleMessageRetractStanza,
  jingleMessageAcceptStanza,
  jingleMessageProceedStanza,
  jingleMessageRejectStanza,
  upgradeErrorStanza
} = require('../data');

const {
  MockRTCPeerConnection,
  MockMediaSession
} = require('../utils');

const SessionManager = require('../../src/index');

let sessionManager;
let sandbox;

const MOCK_JXT = {
  withDefinition () {},
  utils: {
    attribute () {}
  },
  define () {},
  extend () {},
  extendPresence () {}
};

test.beforeEach(() => {
  global.RTCPeerConnection = MockRTCPeerConnection();
  global.MediaSession = MockMediaSession();
  const stanzaio = {
    callbacks: {},
    on (e, callback) {
      this.callbacks[e] = this.callbacks[e] || [];
      this.callbacks[e].push(callback);
    },
    jid: {
      bare: () => 'theOneJidToRuleThemAll12345'
    },
    disco: {
      addFeature () {}
    },
    stanzas: MOCK_JXT,
    emit (e, ...args) {
      (this.callbacks[e] || []).forEach(fn => fn(...args));
    }
  };
  sandbox = sinon.sandbox.create();
  sandbox.stub(jingleStanza, 'getData').callsFake(jid => {
    return {
      from: {
        bare: () => {},
        full: 'I am full'
      },
      propose: {
        id: 'random1234'
      },
      ofrom: {
        full: 'full5555'
      },
      retract: {
        id: 'retractedId'
      },
      accept: {
        id: 'myAcceptedId'
      },
      proceed: {
        id: 'proceedId'
      },
      reject: {
        id: 'rejectedId'
      },
      toJSON: () => {
        return {
          from: {
            bare: () => {},
            full: 'I am full'
          },
          propose: {
            id: 'random1234'
          },
          ofrom: {
            full: 'full5555'
          },
          retract: {
            id: 'retractedId'
          },
          accept: {
            id: 'myAcceptedId'
          },
          proceed: {
            id: 'proceedId'
          },
          reject: {
            id: 'rejectedId'
          }
        };
      }
    };
  });
  sessionManager = new SessionManager({ _stanzaio: stanzaio });
});

test.afterEach(() => {
  delete global.RTCPeerConnection;
  delete global.MediaSession;
  sandbox.restore();
});

test('sessionManager should take in a client with a stanzaio property and clientOptions', t => {
  t.plan(1);
  const stanzaio = {
    on () {},
    disco: { addFeature () {} },
    stanzas: MOCK_JXT
  };
  const clientOptions = {
    iceServers: [],
    logger: () => {}
  };
  sessionManager = new SessionManager({ _stanzaio: stanzaio }, clientOptions);
  t.truthy(sessionManager);
});

test('prepareSession should return Media session', t => {
  t.plan(1);
  sessionManager.clientOptions = {
    signalEndOfCandidates: true
  };
  const mediaSession = sessionManager.jingleJs.prepareSession({peerID: 'somebody@conference'});
  const message = mediaSession.emit('addChannel', { message: 'channel1' });
  t.is(message.peerID, 'somebody@conference');
});

test('media session should emit end of candidates', t => {
  t.plan(1);
  sessionManager.clientOptions = {
    signalEndOfCandidates: true
  };
  const mediaSession = sessionManager.jingleJs.prepareSession({peerID: 'somebody@conference'});
  const message = mediaSession.emit('addChannel', { message: 'channel1' });
  t.is(message.peerID, 'somebody@conference');

  sinon.spy(mediaSession, 'onIceEndOfCandidates');
  sinon.spy(mediaSession, 'send');
  mediaSession.pc.pc.iceConnectionState = 'checking';
  mediaSession.pc.emit('iceConnectionStateChange');
  sinon.assert.calledOnce(mediaSession.onIceEndOfCandidates);
  sinon.assert.notCalled(mediaSession.send);
});

test('media session should emit connected event', t => {
  t.plan(1);
  sessionManager.clientOptions = {
    signalIceConnected: true
  };
  const mediaSession = sessionManager.jingleJs.prepareSession({peerID: 'somebody@conference'});
  const message = mediaSession.emit('addChannel', { message: 'channel1' });
  t.is(message.peerID, 'somebody@conference');

  sinon.spy(mediaSession, 'onIceEndOfCandidates');
  sinon.stub(mediaSession, 'send').callsFake(() => {});
  mediaSession.pc.pc.iceConnectionState = 'connected';
  mediaSession.pc.emit('iceConnectionStateChange');
  sinon.assert.notCalled(mediaSession.onIceEndOfCandidates);
  sinon.assert.calledOnce(mediaSession.send);
});

test('checkStanza should call the appropriate handler', t => {
  t.plan(0);
  sessionManager.checkStanza(jingleStanza);
});

test('handleMessage should call checkStanza function', t => {
  sandbox.stub(sessionManager, 'checkStanza').callsFake(stanza => stanza);
  sessionManager.handleMessage(jingleActionStanza);
  t.is(sessionManager.checkStanza.called, true);
});

test('handleIq should call checkStanza function', t => {
  sandbox.stub(sessionManager, 'checkStanza').callsFake(stanza => stanza);
  sessionManager.handleIq(jingleActionStanza.toJSON());
  t.is(sessionManager.checkStanza.called, true);
});

test.serial('it should register for jingle events', async t => {
  const p = new Promise((resolve) => {
    sandbox.stub(sessionManager.jingleJs, 'process').callsFake(resolve);
  });
  sessionManager.client._stanzaio.emit('iq:set:jingle', jingleActionStanza.toJSON());
  await p;
  t.is(sessionManager.jingleJs.process.calledOnce, true);
  t.is(sessionManager.jingleJs.process.calledWith(jingleActionStanza.toJSON()), true);
});

test.serial('it should not process jingle events for ignored sessions', async t => {
  sandbox.stub(sessionManager.jingleJs, 'process');
  const p = new Promise((resolve) => {
    sandbox.stub(sessionManager.logger, 'debug').callsFake(resolve);
  });
  sessionManager.ignoredSessions.set(jingleActionStanza.toJSON().jingle.sid, true);
  sessionManager.client._stanzaio.emit('iq:set:jingle', jingleActionStanza.toJSON());
  await p;
  t.is(sessionManager.jingleJs.process.notCalled, true);
});

test.serial('it should send stanzas emitted by jinglejs', async t => {
  const sentStanza = jingleActionStanza.toJSON();
  t.plan(1);
  const p = new Promise(resolve => {
    sessionManager.on('send', stanza => {
      t.is(stanza, sentStanza);
      resolve();
    });
  });
  sessionManager.jingleJs.emit('send', sentStanza);
  return p;
});

test.serial('it should not send stanzas emitted by jinglejs if the session is ignored', async t => {
  const sentStanza = jingleActionStanza.toJSON();
  t.plan(1);
  const p = new Promise((resolve, reject) => {
    sessionManager.on('send', stanza => {
      reject(new Error('Send should not have been called'));
    });
    sinon.stub(sessionManager.logger, 'debug').callsFake(l => {
      t.is(l, 'Ignoring outbound stanza for ignored session');
      resolve();
    });
  });
  sessionManager.ignoredSessions.set(jingleActionStanza.toJSON().jingle.sid, true);
  sessionManager.jingleJs.emit('send', sentStanza);
  return p;
});

test('handleEndRtcSessionsWithJid should return undefined if jid not in peerId', t => {
  t.plan(2);
  const options = {
    jid: 'flashbang@storm.net',
    reason: 'smoky'
  };

  sessionManager.jingleJs.peers = { 'concussion@storm.net': {} };
  sandbox.stub(sessionManager.jingleJs, 'endPeerSessions');
  const actual = sessionManager.handleEndRtcSessionsWithJid(options);
  t.is(actual, undefined);
  t.truthy(sessionManager.jingleJs.endPeerSessions.notCalled);
});

test('handleEndRtcSessionsWithJid should return result', t => {
  t.plan(1);
  const options = {
    jid: 'flashbang@storm.net',
    reason: 'smoky'
  };
  sessionManager.jingleJs.peers = { 'flashbang@storm.net': {} };
  sandbox.stub(sessionManager.jingleJs, 'endPeerSessions');
  sessionManager.handleEndRtcSessionsWithJid(options);
  t.truthy(sessionManager.jingleJs.endPeerSessions.called);
});

/* Exposed Methods on the extension */

test('createRtcSession should emit error if an exception occurs when creating MediaDataSession', t => {
  t.plan(0);
  const options = {
    jid: 'flashbang@storm.net',
    sid: 'mysmokyFlashBang',
    stream: {},
    peerConstraints: {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    },
    peerConnectionConstraints: {
      'audio': true,
      'video': {
        'width': {
          'min': '300',
          'max': '640'
        },
        'height': {
          'min': '200',
          'max': '480'
        }
      }
    }
  };
  sessionManager.expose.createRtcSession(options);
  sandbox.stub(sessionManager, 'emit').callsFake((event, data) => {
    t.is(event, events.RTCSESSION_ERROR);
    t.is(data instanceof Error, true);
  });
});

test('createRtcSession should emit error if an exception occurs when creating MediaSession', t => {
  t.plan(0);
  const options = {
    jid: 'flashbang@storm.net',
    sid: 'mysmokyFlashBang',
    stream: {},
    peerConstraints: {
      offerToReceiveAudio: false,
      offerToReceiveVideo: false
    },
    peerConnectionConstraints: {
      'audio': true,
      'video': {
        'width': {
          'min': '300',
          'max': '640'
        },
        'height': {
          'min': '200',
          'max': '480'
        }
      }
    }
  };
  sessionManager.expose.createRtcSession(options);
  sandbox.stub(sessionManager, 'emit').callsFake((event, data) => {
    t.is(event, events.RTCSESSION_ERROR);
    t.is(data instanceof Error, true);
  });
});

test('createRtcSession should addSession and start', t => {
  t.plan(1);
  const options = {
    jid: 'flashbang@storm.net',
    sid: 'mysmokyFlashBang',
    stream: {},
    peerConstraints: {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    },
    peerConnectionConstraints: {
      'audio': true,
      'video': {
        'width': {
          'min': '300',
          'max': '640'
        },
        'height': {
          'min': '200',
          'max': '480'
        }
      }
    }
  };
  sandbox.stub(sessionManager.jingleJs, 'addSession');
  sessionManager.expose.createRtcSession(options);
  t.is(sessionManager.jingleJs.addSession.called, true);
});

test('endRtcSessions should call endAllSessions if no jid', t => {
  t.plan(1);
  const opts = {
    opts: {},
    callback: () => {}
  };
  sessionManager.jingleJs.endAllSessions = sandbox.stub();
  sessionManager.expose.endRtcSessions(opts);
  t.is(sessionManager.jingleJs.endAllSessions.called, true);
});

test('cancelRtcSession should emit error if no session provided', t => {
  t.plan(2);
  sandbox.stub(sessionManager, 'emit').callsFake((event, data) => {
    t.is(event, 'rtcSessionError');
    t.is(data, 'Cannot cancel session because it is not pending or does not exist');
  });
  sessionManager.expose.cancelRtcSession({});
});

test('cancelRtcSession should emit message if session provided', t => {
  t.plan(2);
  sessionManager.pendingSessions = {
    session1: 'abcSession1',
    to: 'goingTo'
  };
  sandbox.stub(sessionManager, 'emit').callsFake((event, data) => {
    t.is(event, 'send');
    t.deepEqual(data, { to: undefined, retract: { id: 'session1' } });
  });
  sessionManager.expose.cancelRtcSession('session1');
});

test('acceptRtcSession should emit error if no session provided', t => {
  t.plan(2);
  sandbox.stub(sessionManager, 'emit').callsFake((event, data) => {
    t.is(event, 'rtcSessionError');
    t.is(data, 'Cannot accept session because it is not pending or does not exist');
  });
  sessionManager.expose.acceptRtcSession({});
});

test('acceptRtcSession should emit message if session provided', t => {
  t.plan(4);
  sessionManager.pendingSessions = {
    session1: {
      from: {
        toString: () => {}
      }
    },
    to: 'goingTo'
  };
  const emitObjects = [
    {
      event: 'send',
      data: { to: 'theOneJidToRuleThemAll12345', accept: { id: 'session1' } }
    },
    {
      event: 'send',
      data: { to: undefined, proceed: { id: 'session1' } }
    }
  ];
  let counter = 0;
  sandbox.stub(sessionManager, 'emit').callsFake((event, data) => {
    t.is(event, emitObjects[counter].event);
    t.deepEqual(data, emitObjects[counter].data);
    counter++;
  });
  sessionManager.expose.acceptRtcSession('session1');
});

test('rejectRtcSession should emit error if no session provided', t => {
  t.plan(2);
  sandbox.stub(sessionManager, 'emit').callsFake((event, data) => {
    t.is(event, 'rtcSessionError');
    t.is(data, 'Cannot reject session because it is not pending or does not exist');
  });
  sessionManager.expose.rejectRtcSession({});
});

/* Exposed Methods on the extension */

test('exposeEvents should return an array of stanzaEvents', t => {
  const actual = sessionManager.exposeEvents;
  const expected = [
    'services',
    'propose',
    'retract',
    'accept',
    'proceed',
    'reject'
  ];
  t.deepEqual(actual, expected);
});

/* stanzaCheckers --- Predicate functions that check each stanza */
test('iceServers should evaluate services and jingle message', t => {
  t.plan(1);
  const actual = sessionManager.stanzaCheckers.iceServers(iceServersStanza);
  const expected = true;
  t.is(actual, expected);
});

test('jingleMessageInit should evaluate services and jingle message', t => {
  t.plan(1);
  const actual = sessionManager.stanzaCheckers.jingleMessageInit(jingleMessageInitStanza);
  const expected = true;
  t.is(actual, expected);
});

test('jingleMessageRetract should evaluate services and jingle message', t => {
  t.plan(1);
  const actual = sessionManager.stanzaCheckers.jingleMessageRetract(jingleMessageRetractStanza);
  const expected = true;
  t.is(actual, expected);
});

test('jingleMessageAccept should evaluate services and jingle message', t => {
  t.plan(1);
  const actual = sessionManager.stanzaCheckers.jingleMessageAccept(jingleMessageAcceptStanza);
  const expected = true;
  t.is(actual, expected);
});

test('jingleMessageProceed should evaluate services and jingle message', t => {
  t.plan(1);
  const actual = sessionManager.stanzaCheckers.jingleMessageProceed(jingleMessageProceedStanza);
  const expected = true;
  t.is(actual, expected);
});

test('jingleMessageReject should evaluate services and jingle message', t => {
  t.plan(1);
  const actual = sessionManager.stanzaCheckers.jingleMessageReject(jingleMessageRejectStanza);
  const expected = true;
  t.is(actual, expected);
});

test('upgradeError should evaluate error and presence', t => {
  t.plan(1);
  const actual = sessionManager.stanzaCheckers.upgradeError(upgradeErrorStanza);
  const expected = false;
  t.is(actual, expected);
});

/* stanzaCheckers --- Predicate functions that check each stanza */

/* stanzaHandlers */

test('requestWebrtcDump should emit message', t => {
  t.plan(2);
  const stanza = {
    attrs: {
      requestId: 'myRequestId1'
    }
  };
  sandbox.stub(sessionManager, 'emit').callsFake((event, data) => {
    t.is(event, 'requestWebrtcDump');
    t.is(data, 'myRequestId1');
  });
  sessionManager.stanzaHandlers.requestWebrtcDump(stanza);
});

test('jingleMessageInit should emit message', t => {
  t.plan(2);
  const expectedData = {
    sessionId: 'proposeId1',
    conversationId: undefined,
    autoAnswer: undefined,
    persistentConnectionId: undefined,
    roomJid: 'o art thou',
    fromJid: 'o art thou'
  };
  sandbox.stub(sessionManager, 'emit').callsFake((event, data) => {
    t.is(event, 'requestIncomingRtcSession');
    t.deepEqual(data, expectedData);
  });
  sessionManager.stanzaHandlers.jingleMessageInit(jingleMessageInitStanza);
});

test('jingleMessageRetract should emit message', t => {
  t.plan(1);
  // TODO: There's no assertion about a message being emitted in this test. Also need another to cover jid to/from equal
  t.truthy(sessionManager.stanzaHandlers.jingleMessageRetract(jingleMessageRetractStanza));
});

test('jingleMessageAccept should emit message', t => {
  t.plan(1);
  // TODO: There's no assertion about a message being emitted in this test. Also need another to cover jid to/from equal
  t.is(sessionManager.stanzaHandlers.jingleMessageAccept(jingleMessageAcceptStanza), undefined);
});

test('jingleMessageProceed should emit message', t => {
  t.plan(1);
  // TODO: There's no assertion about a message being emitted in this test. Also need another to cover jid to/from equal
  t.truthy(sessionManager.stanzaHandlers.jingleMessageProceed(jingleMessageProceedStanza));
});

test('jingleMessageReject should emit message', t => {
  t.plan(1);
  // TODO: There's no assertion about a message being emitted in this test. Also need another to cover jid to/from equal
  t.is(sessionManager.stanzaHandlers.jingleMessageReject(jingleMessageRejectStanza), undefined);
});

/* stanzaHandlers */
