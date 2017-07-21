'use strict';

const test = require('ava');
const sinon = require('sinon');

const {
  events
} = require('../../src/constants').exposeWebrtcEvents;

let sessionManager, args, sandbox, endRtcSessions, handleEndRtcSessionsWithJid;
test.beforeEach(() => {
  sandbox = sinon.sandbox.create();
  args = {
    sessionManager: {
      endPeerSessions: sandbox.stub(),
      peers: {
        peerId1: 'peer1@pier.com',
        peerId2: 'peer2@pier.com'
      }
    },
    pendingSessions: {
      sid: {
        to: '12abcde'
      }
    },
    stanzaio: {
      on: () => {
        return {
          bind: sandbox.stub()
        };
      },
      connect: () => {
        return {
          bind: sandbox.stub()
        };
      },
      disconnect: () => {
        return {
          bind: sandbox.stub()
        };
      },
      emit: () => {
        return {
          bind: sandbox.stub()
        };
      }
    }
  };
  const Session = require('../../src/JingleSessionManager').JingleSessionManager;
  sessionManager = new Session(args);
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
  const actual = sessionManager.handleEndRtcSessionsWithJid(options);
  t.is(actual, undefined);
  t.truthy(args.sessionManager.endPeerSessions.notCalled);
});

test('handleEndRtcSessionsWithJid should return result', t => {
  const args = {
    stanzaio: {
      on: () => {
        return {
          bind: sandbox.stub()
        };
      },
      connect: () => {
        return {
          bind: sandbox.stub()
        };
      },
      disconnect: () => {
        return {
          bind: sandbox.stub()
        };
      },
      emit: () => {
        return {
          bind: sandbox.stub()
        };
      }
    },
    sessionManager: {
      endPeerSessions: sandbox.stub(),
      addSession: sandbox.stub(),
      peers: {
        'flashbang@storm.net': 'peer1@pier.com'
      }
    },
    pendingSessions: {
      sid: {
        to: 'flashbang@storm.net'
      }
    },
    iceServers: []
  };
  const Session = require('../../src/JingleSessionManager').JingleSessionManager;
  sessionManager = new Session(args);
  const options = {
    jid: 'flashbang@storm.net',
    reason: 'smoky'
  };
  sessionManager.handleEndRtcSessionsWithJid(options);
  t.truthy(args.sessionManager.endPeerSessions.called);
});

test('createRtcSession should emit error if an exception occurs when creating MediaDataSession', t => {
  const args = {
    stanzaio: {
      emit: v => v
    },
    sessionManager: {
      endPeerSessions: sandbox.stub(),
      addSession: sandbox.stub(),
      peers: {
        'flashbang@storm.net': 'peer1@pier.com'
      }
    },
    pendingSessions: {
      sid: {
        to: 'flashbang@storm.net'
      }
    },
    iceServers: []
  };
  const Session = require('../../src/JingleSessionManager').JingleSessionManager;
  const sessionManager = new Session(args);
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
  const actual = sessionManager.createRtcSession(options);
  const expected = events.RTCSESSION_ERROR;
  t.is(actual, expected);
});

test('createRtcSession should emit error if an exception occurs when creating MediaSession', t => {
  const args = {
    stanzaio: {
      emit: v => v
    },
    sessionManager: {
      endPeerSessions: sandbox.stub(),
      addSession: sandbox.stub(),
      peers: {
        peerId1: 'peer1@pier.com',
        peerId2: 'peer2@pier.com'
      }
    },
    pendingSessions: {
      sid: {
        to: 'flashbang@storm.net'
      }
    },
    iceServers: []
  };
  const Session = require('../../src/JingleSessionManager').JingleSessionManager;
  const sessionManager = new Session(args);
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
  const actual = sessionManager.createRtcSession(options);
  const expected = events.RTCSESSION_ERROR;
  t.is(actual, expected);
});

test('createRtcSession should addSession and start', t => {
  const args = {
    stanzaio: {
      emit: v => v
    },
    sessionManager: {
      endPeerSessions: sandbox.stub(),
      addSession: sandbox.stub(),
      peers: {
        peerId1: 'peer1@pier.com',
        peerId2: 'peer2@pier.com'
      }
    },
    pendingSessions: {
      sid: {
        to: '12abcde'
      }
    },
    iceServers: []
  };
  const Session = require('../../src/JingleSessionManager').JingleSessionManager;
  const sessionManager = new Session(args);
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
  sessionManager.createRtcSession(options);
  t.is(args.sessionManager.addSession.called, true);
  delete global.RTCPeerConnection;
});

test('initiateRtcSession should call sendMessage if not conference', t => {
  const args = {
    stanzaio: {
      on: () => {
        return {
          bind: sandbox.stub()
        };
      },
      connect: () => {
        return {
          bind: sandbox.stub()
        };
      },
      disconnect: () => {
        return {
          bind: sandbox.stub()
        };
      },
      emit: () => {
        return {
          bind: sandbox.stub()
        };
      },
      sendMessage: sandbox.stub()
    },
    sessionManager: {
      endPeerSessions: sandbox.stub(),
      addSession: sandbox.stub(),
      peers: {
        peerId1: 'peer1@pier.com',
        peerId2: 'peer2@pier.com'
      }
    },
    pendingSessions: {
      sid: {
        to: '12abcde'
      }
    },
    iceServers: []
  };
  const Session = require('../../src/JingleSessionManager').JingleSessionManager;
  sessionManager = new Session(args);
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
  const proposeId = sessionManager.initiateRtcSession(options);
  t.is(args.stanzaio.sendMessage.called, true);
  t.truthy(proposeId);
});

test('initiateRtcSession should emit message if conference', t => {
  const args = {
    stanzaio: {
      on: () => {
        return {
          bind: sandbox.stub()
        };
      },
      connect: () => {
        return {
          bind: sandbox.stub()
        };
      },
      disconnect: () => {
        return {
          bind: sandbox.stub()
        };
      },
      emit: () => {
        return {
          bind: sandbox.stub()
        };
      },
      sendMessage: sandbox.stub()
    },
    sessionManager: {
      endPeerSessions: sandbox.stub(),
      addSession: sandbox.stub(),
      peers: {
        peerId1: 'peer1@conference',
        peerId2: 'peer2@conference'
      }
    },
    pendingSessions: {
      sid: {
        to: '12abcde'
      }
    },
    iceServers: []
  };
  const Session = require('../../src/JingleSessionManager').JingleSessionManager;
  sessionManager = new Session(args);
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
  const proposeId = sessionManager.initiateRtcSession(opts);
  t.is(args.stanzaio.sendMessage.notCalled, true);
  t.truthy(proposeId);
});

test('leaveRtcSessions should call endRtcSessions', t => {
  const args = {
    stanzaio: {
      on: () => {
        return {
          bind: sandbox.stub()
        };
      },
      connect: () => {
        return {
          bind: sandbox.stub()
        };
      },
      disconnect: () => {
        return {
          bind: sandbox.stub()
        };
      },
      emit: () => {
        return {
          bind: sandbox.stub()
        };
      }
    },
    sessionManager: {
      endPeerSessions: sandbox.stub(),
      addSession: sandbox.stub(),
      peers: {
        peerId1: 'peer1@conference',
        peerId2: 'peer2@conference'
      }
    },
    pendingSessions: {
      sid: {
        to: '12abcde'
      }
    },
    iceServers: []
  };
  const Session = require('../../src/JingleSessionManager').JingleSessionManager;
  endRtcSessions = Session.prototype.endRtcSessions;
  Session.prototype.endRtcSessions = sandbox.stub();
  sessionManager = new Session(args);
  const opts = {
    jid: 'peer1@conference',
    callback: function () {}
  };
  sessionManager.leaveRtcSessions(opts);
  t.is(Session.prototype.endRtcSessions.called, true);
});

test('leaveRtcSessions should call endRtcSessions and call endAllSessions if no jid is provided', t => {
  const args = {
    stanzaio: {
      on: () => {
        return {
          bind: sandbox.stub()
        };
      },
      connect: () => {
        return {
          bind: sandbox.stub()
        };
      },
      disconnect: () => {
        return {
          bind: sandbox.stub()
        };
      },
      emit: () => {
        return {
          bind: sandbox.stub()
        };
      }
    },
    sessionManager: {
      endPeerSessions: sandbox.stub(),
      addSession: sandbox.stub(),
      endAllSessions: sandbox.stub(),
      peers: {
        peerId1: 'peer1@conference',
        peerId2: 'peer2@conference'
      }
    },
    pendingSessions: {
      sid: {
        to: '12abcde'
      }
    },
    iceServers: []
  };
  const Session = require('../../src/JingleSessionManager').JingleSessionManager;
  Session.prototype.endRtcSessions = endRtcSessions;
  sessionManager = new Session(args);
  const opts = {
    jid: function () {},
    callback: function () {}
  };
  sessionManager.leaveRtcSessions(opts);
  t.is(args.sessionManager.endAllSessions.called, true);
});

test('leaveRtcSessions should call endRtcSessions and call handleEndRtcSessionsWithJid if jid is provided', t => {
  const args = {
    stanzaio: {
      on: () => {
        return {
          bind: sandbox.stub()
        };
      },
      connect: () => {
        return {
          bind: sandbox.stub()
        };
      },
      disconnect: () => {
        return {
          bind: sandbox.stub()
        };
      },
      emit: () => {
        return {
          bind: sandbox.stub()
        };
      }
    },
    sessionManager: {
      endPeerSessions: sandbox.stub(),
      endAllSessions: sandbox.stub(),
      addSession: sandbox.stub(),
      peers: {
        peerId1: 'peer1@conference',
        peerId2: 'peer2@conference'
      }
    },
    pendingSessions: {
      sid: {
        to: '12abcde'
      }
    },
    iceServers: []
  };
  const Session = require('../../src/JingleSessionManager').JingleSessionManager;
  handleEndRtcSessionsWithJid = Session.prototype.handleEndRtcSessionsWithJid;
  Session.prototype.handleEndRtcSessionsWithJid = sandbox.stub();
  sessionManager = new Session(args);
  const opts = {
    jid: 'peer1@conference',
    callback: function () {}
  };
  sessionManager.leaveRtcSessions(opts);
  t.is(Session.prototype.handleEndRtcSessionsWithJid.called, true);
  Session.prototype.handleEndRtcSessionsWithJid = handleEndRtcSessionsWithJid;
});

test('requestWebrtcDump should emit message', t => {
  t.plan(1);
  const args = {
    stanzaio: {
      on: () => {
        return {
          bind: sandbox.stub()
        };
      },
      connect: () => {
        return {
          bind: sandbox.stub()
        };
      },
      disconnect: () => {
        return {
          bind: sandbox.stub()
        };
      },
      emit: (message, requestId) => {
        return {
          message,
          requestId
        };
      }
    },
    sessionManager: {
      endPeerSessions: sandbox.stub(),
      addSession: sandbox.stub(),
      peers: {
        'flashbang@storm.net': 'peer1@pier.com'
      }
    },
    pendingSessions: {
      sid: {
        to: 'flashbang@storm.net'
      }
    },
    iceServers: []
  };
  const Session = require('../../src/JingleSessionManager').JingleSessionManager;
  sessionManager = new Session(args);
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
