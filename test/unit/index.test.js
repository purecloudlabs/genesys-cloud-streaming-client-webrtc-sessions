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
  const stanzaClient = {
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
  sessionManager = new SessionManager(stanzaClient);
});

test.afterEach(() => {
  delete global.RTCPeerConnection;
  delete global.MediaSession;
  sandbox.restore();
});

test('sessionManager should take in a stanzaClient and clientOptions', t => {
  t.plan(1);
  const stanzaClient = {
    on () {},
    disco: { addFeature () {} },
    stanzas: MOCK_JXT
  };
  const clientOptions = {
    iceServers: [],
    logger: () => {}
  };
  sessionManager = new SessionManager(stanzaClient, clientOptions);
  t.truthy(sessionManager);
});

test('prepareSession should return Media session', t => {
  t.plan(1);
  const options = {
    signalEndOfCandidates: true,
    peerID: 'somebody@conference'
  };
  const prepareSession = sessionManager.jingleJs.prepareSession(options);
  const message = prepareSession.emit('addChannel', { message: 'channel1' });
  t.is(message.peerID, 'somebody@conference');
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
  sessionManager.handleIq(jingleActionStanza);
  t.is(sessionManager.checkStanza.called, true);
});

test.serial('it should register for jingle events', async t => {
  const p = new Promise((resolve) => {
    sandbox.stub(sessionManager.jingleJs, 'process').callsFake(resolve);
  });
  sessionManager.stanzaClient.emit('iq:set:jingle', jingleActionStanza);
  await p;
  t.is(sessionManager.jingleJs.process.calledOnce, true);
  t.is(sessionManager.jingleJs.process.calledWith(jingleActionStanza), true);
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

// test('initiateRtcSession should emit a message if not conference', t => {
//   t.plan(5);
//   const options = {
//     opts: {
//       jid: 'flashbang@storm.net',
//       stream: {
//         getTracks: () => {
//           return [
//             {
//               stop: () => {}
//             }
//           ];
//         }
//       }
//     },
//     callback: () => {}
//   };
//   const dataExpected = {
//     to: 'flashbang@storm.net',
//     propose: {
//       descriptions: [
//         {
//           media: undefined
//         }
//       ]
//     }
//   };
//   sandbox.stub(sessionManager, 'emit').callsFake((event, data, message) => {
//     t.is(message, true);
//     t.is(event, 'send');
//     t.is(data.to, dataExpected.to);
//   });
//   const proposeId = sessionManager.expose.initiateRtcSession(options);
//   t.is(sessionManager.emit.called, true);
//   t.truthy(proposeId);
// });

// test('initiateRtcSession should emit an iq if conference', t => {
//   t.plan(5);
//   const opts = {
//     opts: {
//       jid: 'peer1@conference',
//       stream: {
//         getTracks: () => {
//           return [
//             {
//               stop: () => {},
//               kind: 'audio'
//             }
//           ];
//         }
//       }
//     },
//     callback: () => {}
//   };
//   sandbox.stub(sessionManager, 'emit').callsFake((event, data, message) => {
//     t.is(message, undefined);
//     t.is(event, 'updateMediaPresence');
//     t.deepEqual(data.mediaDescriptions, [ { media: 'audio' } ]);
//   });
//   const proposeId = sessionManager.expose.initiateRtcSession(opts);
//   t.is(sessionManager.emit.called, true);
//   t.truthy(proposeId);
// });

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

// test('endRtcSessions should call handleEndRtcSessionsWithJid if there is a jid', t => {
//   t.plan(1);
//   const opts = {
//     opts: {
//       jid: 'peer1@conference'
//     },
//     callback: () => {}
//   };
//   sessionManager.handleEndRtcSessionsWithJid = sandbox.stub();
//   sessionManager.expose.endRtcSessions(opts);
//   t.is(sessionManager.handleEndRtcSessionsWithJid.called, true);
// });

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
