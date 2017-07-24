'use strict';

const test = require('ava');
const sinon = require('sinon');
const jingleStanza = require('jingle-stanza');

const {
  events
} = require('../../constants');

const SessionManager = require('../../src/index');

let sessionManager;
let sandbox;
let stanza;
test.beforeEach(() => {
  stanza = {
    inbound: '<iq xmlns="jabber:client" to="589a4b5c6014d01beb690444@realtime-test-inindca-51a45385-64ca-411e-9d56-e4df2a2d7792.orgspan.com/realtime-test-JS-088bc99c-8b5a-4e0f-aca3-24474546f557-1094" id="589a4b7c000182072a4c84a3" type="error" from="589a4b7100000a9f65dfcb17-z@conference.realtime-test-inindca-51a45385-64ca-411e-9d56-e4df2a2d7792.orgspan.com" mark="1486506921731" originalType="result"><error type="wait" code="429"><text>Throttled: Rate exceeded for /realtime/stanza/VideoBridgeProxyController/clientStanza in dimension 589a4b5c6014d01beb690444@realtime-test-inindca-51a45385-64ca-411e-9d56-e4df2a2d7792.orgspan.com</text><resource-constraint xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/><resource-limit-exceeded xmlns="urn:realtime:errors"/></error></iq>'
  };
  const stanzaClient = {
    on () {},
    jid: {
      bare: () => 'theOneJidToRuleThemAll12345'
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
  sandbox.restore();
});

test('sessionManager should take in a stanzaClient and clientOptions', t => {
  t.plan(1);
  const stanzaClient = {
    on () {}
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
  global.RTCPeerConnection = function () {
    return {
      addEventListener: () => {},
      addStream: () => {},
      createOffer: () => Promise.resolve(),
      setLocalDescription: () => {},
      setRemoteDescription: () => {},
      createAnswer: () => Promise.resolve(),
      gatherStats: () => {},
      getStats: () => {
        return {
          then: () => {}
        };
      },
      gotStats: () => {},
      getRemoteStreams: () => {},
      createDataChannel: () => {
        return {
          onmessage: null,
          addEventListener: () => {}
        };
      },
      offer: () => {},
      getLocalStreams: function () {},
      onIceCandidate: function () {},
      onIceEndOfCandidates: function () {},
      onIceStateChange: function () {}
    };
  };
  const options = {
    signalEndOfCandidates: true,
    peerID: 'somebody@conference'
  };
  const prepareSession = sessionManager.jingleJs.prepareSession(options);
  const message = prepareSession.emit('addChannel', { message: 'channel1' });
  t.is(message.peerID, 'somebody@conference');
  delete global.RTCPeerConnection;
});

test('checkStanza should call the appropriate handler', t => {
  t.plan(3);
  const eventLabels = [
    'requestIncomingRtcSession',
    'cancelIncomingRtcSession',
    'outgoingRtcSessionProceed'
  ];
  let counter = 0;
  sandbox.stub(sessionManager, 'emit').callsFake((event, data) => {
    t.is(event, eventLabels[counter++]);
  });

  const stanza = {
    attrs: {
      type: 'what',
      kind: 'otherDump'
    },
    is: types => types,
    getChild: message => {
      return {
        attrs: {
          'dont-answer': 'false'
        }
      };
    }
  };
  sessionManager.checkStanza(stanza);
});

test('handleMessage should call checkStanza function', t => {
  sandbox.stub(sessionManager, 'checkStanza').callsFake(stanza => stanza);
  sessionManager.handleMessage(stanza);
  t.is(sessionManager.checkStanza.called, true);
});

test('handleIq should call checkStanza function', t => {
  sandbox.stub(sessionManager, 'checkStanza').callsFake(stanza => stanza);
  sessionManager.handleIq(stanza);
  t.is(sessionManager.checkStanza.called, true);
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
  global.RTCPeerConnection = function () {
    return {
      addEventListener: () => {},
      addStream: () => {},
      createOffer: () => Promise.resolve(),
      setLocalDescription: () => {},
      setRemoteDescription: () => {},
      createAnswer: () => Promise.resolve(),
      gatherStats: () => {},
      getStats: () => {
        return {
          then: () => {}
        };
      },
      gotStats: () => {},
      getRemoteStreams: () => {},
      createDataChannel: () => {
        return {
          onmessage: null,
          addEventListener: () => {}
        };
      },
      offer: () => {},
      getLocalStreams: function () {},
      onIceCandidate: function () {},
      onIceEndOfCandidates: function () {},
      onIceStateChange: function () {}
    };
  };
  sandbox.stub(sessionManager.jingleJs, 'addSession');
  sessionManager.expose.createRtcSession(options);
  t.is(sessionManager.jingleJs.addSession.called, true);
  delete global.RTCPeerConnection;
});

test('initiateRtcSession should emit a message if not conference', t => {
  t.plan(5);
  const options = {
    opts: {
      jid: 'flashbang@storm.net',
      stream: {
        getTracks: () => {
          return [
            {
              stop: () => {}
            }
          ];
        }
      }
    },
    callback: () => {}
  };
  const dataExpected = {
    to: 'flashbang@storm.net',
    propose: {
      descriptions: [
        {
          media: undefined
        }
      ]
    }
  };
  sandbox.stub(sessionManager, 'emit').callsFake((event, data, message) => {
    t.is(message, true);
    t.is(event, 'send');
    t.is(data.to, dataExpected.to);
  });
  const proposeId = sessionManager.expose.initiateRtcSession(options);
  t.is(sessionManager.emit.called, true);
  t.truthy(proposeId);
});

test('initiateRtcSession should emit an iq if conference', t => {
  t.plan(5);
  const opts = {
    opts: {
      jid: 'peer1@conference',
      stream: {
        getTracks: () => {
          return [
            {
              stop: () => {},
              kind: 'audio'
            }
          ];
        }
      }
    },
    callback: () => {}
  };
  sandbox.stub(sessionManager, 'emit').callsFake((event, data, message) => {
    t.is(message, undefined);
    t.is(event, 'updateMediaPresence');
    t.deepEqual(data.mediaDescriptions, [ { media: 'audio' } ]);
  });
  const proposeId = sessionManager.expose.initiateRtcSession(opts);
  t.is(sessionManager.emit.called, true);
  t.truthy(proposeId);
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

test('endRtcSessions should call handleEndRtcSessionsWithJid if there is a jid', t => {
  t.plan(1);
  const opts = {
    opts: {
      jid: 'peer1@conference'
    },
    callback: () => {}
  };
  sessionManager.handleEndRtcSessionsWithJid = sandbox.stub();
  sessionManager.expose.endRtcSessions(opts);
  t.is(sessionManager.handleEndRtcSessionsWithJid.called, true);
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

test('requestWebrtcDump should evaluate to true if type is get and kind is webrtcDump', t => {
  t.plan(2);
  const stanza = {
    attrs: {
      type: 'what',
      kind: 'otherDump'
    },
    is: types => types
  };
  const actual = sessionManager.stanzaCheckers.requestWebRtcDump(stanza);
  const expected = false;
  t.is(actual, expected);

  const stanza2 = {
    attrs: {
      type: 'get',
      kind: 'webrtcDump'
    },
    is: types => types
  };
  const actual2 = sessionManager.stanzaCheckers.requestWebRtcDump(stanza2);
  const expected2 = true;
  t.is(actual2, expected2);
});

test('iceServers should evaluate services and jingle message', t => {
  t.plan(1);
  const stanza = {
    attrs: {
      type: 'set'
    },
    is: types => types,
    getChild: (services, message) => services
  };
  const actual = sessionManager.stanzaCheckers.iceServers(stanza);
  const expected = true;
  t.is(actual, expected);
});

test('jingleMessageInit should evaluate services and jingle message', t => {
  t.plan(1);
  const stanza = {
    is: types => types,
    getChild: (services, message) => services
  };
  const actual = sessionManager.stanzaCheckers.jingleMessageInit(stanza);
  const expected = 'propose';
  t.is(actual, expected);
});

test('jingleMessageRetract should evaluate services and jingle message', t => {
  t.plan(1);
  const stanza = {
    is: types => types,
    getChild: (services, message) => services
  };
  const actual = sessionManager.stanzaCheckers.jingleMessageRetract(stanza);
  const expected = 'retract';
  t.is(actual, expected);
});

test('jingleMessageAccept should evaluate services and jingle message', t => {
  t.plan(1);
  const stanza = {
    is: types => types,
    getChild: (services, message) => services
  };
  const actual = sessionManager.stanzaCheckers.jingleMessageAccept(stanza);
  const expected = 'accept';
  t.is(actual, expected);
});

test('jingleMessageProceed should evaluate services and jingle message', t => {
  t.plan(1);
  const stanza = {
    is: types => types,
    getChild: (services, message) => services
  };
  const actual = sessionManager.stanzaCheckers.jingleMessageProceed(stanza);
  const expected = 'proceed';
  t.is(actual, expected);
});

test('jingleMessageReject should evaluate services and jingle message', t => {
  t.plan(1);
  const stanza = {
    is: types => types,
    getChild: (services, message) => services
  };
  const actual = sessionManager.stanzaCheckers.jingleMessageReject(stanza);
  const expected = 'reject';
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
  const stanza = {
    attrs: {
      requestId: 'myRequestId1'
    },
    getChild: message => {
      return {
        attrs: {
          'inin-cid': 'xxaa112222',
          'inin-persistent-cid': 'persistentId111'
        }
      };
    }
  };
  const expectedData = {
    autoAnswer: false,
    conversationId: 'xxaa112222',
    fromJid: 'I am full',
    persistentConnectionId: 'persistentId111',
    roomJid: 'full5555',
    sessionId: 'random1234'
  };
  sandbox.stub(sessionManager, 'emit').callsFake((event, data) => {
    t.is(event, 'requestIncomingRtcSession');
    t.deepEqual(data, expectedData);
  });
  sessionManager.stanzaHandlers.jingleMessageInit(stanza);
});

test('jingleMessageRetract should emit message', t => {
  t.plan(1);
  const stanza = {
    attrs: {
      requestId: 'myRequestId1'
    },
    getChild: message => message
  };
  t.truthy(sessionManager.stanzaHandlers.jingleMessageRetract(stanza));
});

test('jingleMessageAccept should emit message', t => {
  t.plan(1);
  const stanza = {
    attrs: {
      requestId: 'myRequestId1'
    },
    getChild: message => message
  };
  t.is(sessionManager.stanzaHandlers.jingleMessageAccept(stanza), undefined);
});

test('jingleMessageProceed should emit message', t => {
  t.plan(1);
  const stanza = {
    attrs: {
      requestId: 'myRequestId1'
    },
    getChild: message => message
  };
  t.truthy(sessionManager.stanzaHandlers.jingleMessageProceed(stanza));
});

test('jingleMessageReject should emit message', t => {
  t.plan(1);
  const stanza = {
    attrs: {
      requestId: 'myRequestId1'
    },
    getChild: message => message
  };
  t.is(sessionManager.stanzaHandlers.jingleMessageReject(stanza), undefined);
});

/* stanzaHandlers */
