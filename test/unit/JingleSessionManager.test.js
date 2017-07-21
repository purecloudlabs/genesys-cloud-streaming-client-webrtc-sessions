'use strict';

const test = require('ava');
const sinon = require('sinon');

const {
  events
} = require('../../constants');

const SessionManager = require('../../src/index');

let sessionManager;
let sandbox;
test.beforeEach(() => {
  const stanzaClient = { on () {} };
  sandbox = sinon.sandbox.create();
  sessionManager = new SessionManager(stanzaClient);
});

test.afterEach(() => {
  sandbox.restore();
});

test('handleEndRtcSessionsWithJid should return undefined if jid not in peerId', t => {
  t.plan(2);
  const options = {
    jid: 'flashbang@storm.net',
    reason: 'smoky'
  };

  sessionManager.jingleJs.peers = { 'concussion@storm.net': {} };
  sinon.stub(sessionManager.jingleJs, 'endPeerSessions');
  const actual = sessionManager.handleEndRtcSessionsWithJid(options);
  t.is(actual, undefined);
  t.truthy(sessionManager.jingleJs.endPeerSessions.notCalled);
});

test('handleEndRtcSessionsWithJid should return result', t => {
  const options = {
    jid: 'flashbang@storm.net',
    reason: 'smoky'
  };
  sessionManager.jingleJs.peers = { 'flashbang@storm.net': {} };
  sinon.stub(sessionManager.jingleJs, 'endPeerSessions');
  sessionManager.handleEndRtcSessionsWithJid(options);
  t.truthy(sessionManager.jingleJs.endPeerSessions.called);
});

test('createRtcSession should emit error if an exception occurs when creating MediaDataSession', t => {
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
  sinon.stub(sessionManager, 'emit', (event, data) => {
    t.is(event, events.RTCSESSION_ERROR);
    t.is(data instanceof Error, true);
  });
});

test('createRtcSession should emit error if an exception occurs when creating MediaSession', t => {
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
  sinon.stub(sessionManager, 'emit', (event, data) => {
    t.is(event, events.RTCSESSION_ERROR);
    t.is(data instanceof Error, true);
  });
});

test('createRtcSession should addSession and start', t => {
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
  sinon.stub(sessionManager.jingleJs, 'addSession');
  sessionManager.expose.createRtcSession(options);
  t.is(sessionManager.jingleJs.addSession.called, true);
  delete global.RTCPeerConnection;
});

test('initiateRtcSession should emit a message if not conference', t => {
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
  sinon.stub(sessionManager, 'emit', (event, data, message) => {
    t.is(message, true);
    t.is(event, 'send');
  });
  const proposeId = sessionManager.expose.initiateRtcSession(options);
  t.is(sessionManager.emit.called, true);
  t.truthy(proposeId);
});

test('initiateRtcSession should emit an iq if conference', t => {
  const opts = {
    opts: {
      jid: 'peer1@conference',
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
  sinon.stub(sessionManager, 'emit', (event, data, message) => {
    t.is(message, undefined);
    t.is(event, 'send');
  });
  const proposeId = sessionManager.expose.initiateRtcSession(opts);
  t.is(sessionManager.emit.called, true);
  t.truthy(proposeId);
});

test('requestWebrtcDump should emit message', t => {
  t.plan(1);
  const stanza = {
    attrs: {
      requestId: 'dump1235@message'
    }
  };
  const actual = sessionManager.requestWebrtcDump(stanza);
  const expected = {
    message: 'requestWebrtcDump',
    requestId: 'dump1235@message'
  };
  t.deepEqual(actual, expected);
});
