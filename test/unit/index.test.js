'use strict';

const test = require('ava');
const sinon = require('sinon');
const jingleStanza = require('jingle-stanza');
const WildEmitter = require('wildemitter');
const XMPP = require('stanza.io');

const {
  events
} = require('../../constants');

const {
  jingleActionStanza,
  jingleMessageInitStanza,
  jingleMessageRetractStanza,
  jingleMessageAcceptStanza,
  jingleMessageProceedStanza,
  jingleMessageRejectStanza
} = require('../data');

const {
  MockRTCPeerConnection,
  MockMediaSession
} = require('../utils');

const SessionManager = require('../../src/index');

const MOCK_JXT = {
  withDefinition (label, xmlns, fn) { fn(); },
  utils: {
    attribute () {}
  },
  define () {},
  extend () {},
  extendPresence () {},
  use () {},
  getPresence: () => function (data) { this.data = data; }
};

class MockStanzaIo extends WildEmitter {
  constructor (jid) {
    super();
    this.jid = {
      bare: jid,
      toString: () => jid + '/asdf',
      full: jid + '/asdf'
    };
    this.disco = { addFeature () {} };
    this.stanzas = MOCK_JXT;
  }

  send () {}
  getServices () {}
}

class MockClient {
  constructor (jid) {
    this._stanzaio = new MockStanzaIo(jid);
    this.logger = { debug () {}, info () {}, warn () {}, error () {} };
  }

  on () {
    this._stanzaio.on(...arguments);
  }
}

test.beforeEach(() => {
  global.window = global;
  global.window.RTCPeerConnection = global.RTCPeerConnection = MockRTCPeerConnection();
  global.window.MediaSession = global.MediaSession = MockMediaSession();
});

const beforeEach = function () {
  const sandbox = sinon.sandbox.create();
  const client = new MockClient('theOneJidToRuleThemAll12345');
  const sessionManager = new SessionManager(client);
  return { stanzaio: client._stanzaio, sessionManager, sandbox };
};

/* custom stanza definitions */
test('screenstart stanza should be defined properly', t => {
  const stanzaio = XMPP.createClient();
  const client = new MockClient();
  client._stanzaio = stanzaio;
  const webrtcSessions = new SessionManager(client);
  const IQ = webrtcSessions.client._stanzaio.stanzas.getIQ();
  const iq = new IQ({ to: 'test', from: 'test', jingle: { sid: 'test', action: 'session-info', screenstart: {} } });
  t.truthy(iq.toString().indexOf('screen-start'), 'stanza should include a "screen-start" element');
});

test('screenstop stanza should be defined properly', t => {
  const stanzaio = XMPP.createClient();
  const client = new MockClient();
  client._stanzaio = stanzaio;
  const webrtcSessions = new SessionManager(client);
  const IQ = webrtcSessions.client._stanzaio.stanzas.getIQ();
  const iq = new IQ({ to: 'test', from: 'test', jingle: { sid: 'test', action: 'session-info', screenstop: {} } });
  t.truthy(iq.toString().indexOf('screen-stop'), 'stanza should include a "screen-stop" element');
});

test('sessionManager should take in a client with a stanzaio property and clientOptions', t => {
  t.plan(1);
  const stanzaio = {
    on () {},
    disco: { addFeature () {} },
    stanzas: MOCK_JXT
  };
  const clientOptions = {
    iceServers: []
  };
  const sessionManager = new SessionManager({ _stanzaio: stanzaio, on () {} }, clientOptions);
  t.truthy(sessionManager);
});

test('sessionManager should allow for rtcSessionSurvivability = true', t => {
  const client = new MockClient('somejid@example.com');
  const clientOptions = {
    iceServers: [],
    rtcSessionSurvivability: true
  };
  sinon.spy(client._stanzaio, 'on');
  const sessionManager = new SessionManager(client, clientOptions);

  sinon.stub(sessionManager.jingleJs, 'endAllSessions');
  sessionManager.pendingIqs = { foo: 'bar' };
  sessionManager.pendingSessions = { foo: 'bar' };
  client._stanzaio.emit('disconnect');

  t.deepEqual(sessionManager.pendingIqs, { foo: 'bar' });
  t.deepEqual(sessionManager.pendingSessions, { foo: 'bar' });
  sinon.assert.notCalled(sessionManager.jingleJs.endAllSessions);

  sessionManager.handleIq(); // no-op, but it has to exist
});

test('sessionManager should allow for rtcSessionSurvivability = false', t => {
  const client = new MockClient('somejid@example.com');
  const clientOptions = {
    iceServers: [],
    rtcSessionSurvivability: false
  };
  sinon.spy(client._stanzaio, 'on');
  const sessionManager = new SessionManager(client, clientOptions);

  sinon.stub(sessionManager.jingleJs, 'endAllSessions');
  sessionManager.pendingIqs = { foo: 'bar' };
  sessionManager.pendingSessions = { foo: 'bar' };
  client._stanzaio.emit('disconnect');

  t.deepEqual(sessionManager.pendingIqs, {});
  t.deepEqual(sessionManager.pendingSessions, {});
  sinon.assert.calledOnce(sessionManager.jingleJs.endAllSessions);

  sessionManager.handleIq(); // no-op, but it has to exist
});

test('sessionManager will not support features of RTCPeerConnection is not defined', t => {
  global.window.RTCPeerConnection = null;
  const client = new MockClient('somejid@example.com');
  const clientOptions = {
    iceServers: []
  };
  sinon.spy(client._stanzaio.disco, 'addFeature');
  const sessionManager = new SessionManager(client, clientOptions);
  t.truthy(sessionManager);
  sinon.assert.calledOnce(client._stanzaio.disco.addFeature); // only once, otherwise, lots of times
});

test('exposeEvents', t => {
  const client = new MockClient('somejid@example.com');
  const clientOptions = {
    iceServers: []
  };
  const sessionManager = new SessionManager(client, clientOptions);
  t.deepEqual(sessionManager.stanzaEvents, ['iq:set:jingle', 'iq:get:jingle']);
});

test('proxyEvents should proxy specific events up from the jingle session manager', t => {
  t.plan(6);
  const client = new MockClient('somejid@example.com');
  client.logger = { debug: sinon.stub() };
  const clientOptions = {
    iceServers: []
  };
  const sessionManager = new SessionManager(client, clientOptions);

  const mockError = '<error reason="invalid"/>';
  sessionManager.on(events.RTCSESSION_ERROR, e => t.is(e, mockError));
  sessionManager.jingleJs.emit('error', { error: mockError });

  sessionManager.on(events.TRACE_RTCSESSION, (level, msg) => {
    t.is(msg, mockError);
    t.is(level, 'error');
  });
  sessionManager.jingleJs.emit('log:error', mockError);

  const mockSession = {};
  sessionManager.on(events.INCOMING_RTCSESSION, session => t.is(session, mockSession));
  sessionManager.jingleJs.emit('incoming', mockSession);

  sessionManager.on(events.OUTGOING_RTCSESSION_PROCEED, session => t.is(session, mockSession));
  sessionManager.jingleJs.emit('outgoing', mockSession);

  const mockStanzaData = { to: 'foo', from: 'bar' };
  const sendHandler = data => t.is(data, mockStanzaData);
  sessionManager.on('send', sendHandler);
  sessionManager.jingleJs.emit('send', mockStanzaData);
  sessionManager.off('send', sendHandler);

  const mockIgnoredStanzaData = { to: 'foo', jingle: { sid: '1234' } };
  sessionManager.ignoredSessions.set('1234', true);
  sessionManager.jingleJs.emit('send', mockIgnoredStanzaData);
  sinon.assert.calledOnce(sessionManager.logger.debug);
});

test('prepareSession should return Media session', t => {
  const { sessionManager } = beforeEach();
  sessionManager.config.signalEndOfCandidates = true;
  const mediaSession = sessionManager.jingleJs.prepareSession({ peerID: 'somebody@conference' });
  t.is(mediaSession.peerID, 'somebody@conference');
});

test('onIceCandidate should filter ipv6 candidates by default', async t => {
  const ipv6Candidate = 'a=candidate:4089960842 1 udp 2122197247 2603:900a:160a:aa00:540:b412:2a2d:1f5b 53622 typ host generation 0';
  const ipv4Candidate = 'a=candidate:2999745851 1 udp 2122129151 192.168.56.1 53623 typ host generation 0';
  const { sessionManager } = beforeEach();
  const mediaSession = sessionManager.jingleJs.prepareSession({ peerID: 'somebody@conference' });
  const spy = sinon.stub(mediaSession, 'send');

  mediaSession.onIceCandidate({}, {
    candidate: {
      candidate: ipv6Candidate
    }
  });

  mediaSession.onIceCandidate({}, {
    candidate: {
      candidate: ipv4Candidate
    }
  });

  sinon.assert.calledOnce(spy);

  mediaSession.onIceCandidate({}, {
    candidate: null
  });

  sinon.assert.calledTwice(spy);
});

test('onIceCandidate should not filter ipv6 candidates if allowIPv6', async t => {
  const ipv6Candidate = 'a=candidate:4089960842 1 udp 2122197247 2603:900a:160a:aa00:540:b412:2a2d:1f5b 53622 typ host generation 0';
  const ipv4Candidate = 'a=candidate:2999745851 1 udp 2122129151 192.168.56.1 53623 typ host generation 0';
  const { sessionManager } = beforeEach();
  const mediaSession = sessionManager.jingleJs.prepareSession({ peerID: 'somebody@conference' });
  const spy = sinon.stub(mediaSession, 'send');

  mediaSession.onIceCandidate({ allowIPv6: true }, {
    candidate: {
      candidate: ipv6Candidate
    }
  });

  mediaSession.onIceCandidate({ allowIPv6: true }, {
    candidate: {
      candidate: ipv4Candidate
    }
  });
  sinon.assert.calledTwice(spy);
});

test.serial('prepareSession should wire up data channel events', async t => {
  t.plan(3);
  const { sessionManager } = beforeEach();
  sessionManager.config.signalEndOfCandidates = true;
  const mediaSession = sessionManager.jingleJs.prepareSession({ peerID: 'somebody@conference' });
  t.is(mediaSession.peerID, 'somebody@conference');
  const mockChannel = { label: 'channel1' };
  mediaSession.emit('addChannel', mockChannel);
  const lastnEvent = new Promise(resolve => {
    mediaSession.on(events.LASTN_CHANGE, (data) => {
      t.is(data.foo, 'bar');
      t.is(data.json, 'data');
      resolve();
    });
  });
  mockChannel.onmessage({ data: '{ "foo": "bar", "json": "data" }' });
  mockChannel.onmessage({});
  await lastnEvent;
});

test('prepareSession should create a MediaDataSession when appropriate', t => {
  const { sessionManager } = beforeEach();
  sessionManager.config.signalEndOfCandidates = true;
  const mediaSession = sessionManager.jingleJs.prepareSession({
    peerID: 'somebody@example.com',
    applicationTypes: [ 'rtp', 'datachannel' ]
  });
  t.is(mediaSession.peerID, 'somebody@example.com');
  t.is(typeof mediaSession.getDataChannel, 'function');
});

test('prepareSession should create a MediaSession when appropriate', t => {
  const { sessionManager } = beforeEach();
  sessionManager.config.signalEndOfCandidates = true;
  const mediaSession = sessionManager.jingleJs.prepareSession({
    peerID: 'somebody@example.com',
    applicationTypes: [ 'rtp' ]
  });
  t.is(mediaSession.peerID, 'somebody@example.com');
  t.is(typeof mediaSession.getDataChannel, 'undefined');
});

test('prepareSession should create a MediaSession when appropriate', t => {
  const { sessionManager } = beforeEach();
  sessionManager.config.signalEndOfCandidates = true;
  const mediaSession = sessionManager.jingleJs.prepareSession({
    peerID: 'somebody@example.com',
    applicationTypes: [ ]
  });
  t.is(mediaSession.peerID, 'somebody@example.com');
  t.is(typeof mediaSession.getDataChannel, 'undefined');
});

test('media session should emit end of candidates', t => {
  const { sessionManager } = beforeEach();
  sessionManager.config.signalEndOfCandidates = true;
  sessionManager.config.disableEOCShortCircuit = false;
  const mediaSession = sessionManager.jingleJs.prepareSession({ peerID: 'somebody@conference' });
  const message = mediaSession.emit('addChannel', { id: 'channel1' });
  t.is(message.peerID, 'somebody@conference');

  sinon.spy(mediaSession, 'onIceEndOfCandidates');
  sinon.spy(mediaSession, 'send');
  mediaSession.pc.pc.iceConnectionState = 'checking';
  mediaSession.pc.emit('iceConnectionStateChange');
  sinon.assert.calledOnce(mediaSession.onIceEndOfCandidates);
  sinon.assert.notCalled(mediaSession.send);
});

test('media session should not end of candidates on checking', t => {
  const { sessionManager } = beforeEach();
  sessionManager.config.signalEndOfCandidates = true;
  sessionManager.config.disableEOCShortCircuit = true;
  const mediaSession = sessionManager.jingleJs.prepareSession({ peerID: 'somebody@conference' });
  const message = mediaSession.emit('addChannel', { id: 'channel1' });
  t.is(message.peerID, 'somebody@conference');

  sinon.spy(mediaSession, 'onIceEndOfCandidates');
  sinon.spy(mediaSession, 'send');
  mediaSession.pc.pc.iceConnectionState = 'checking';
  mediaSession.pc.emit('iceConnectionStateChange');
  sinon.assert.notCalled(mediaSession.onIceEndOfCandidates);
  sinon.assert.notCalled(mediaSession.send);
});

test('media session should emit connected event', t => {
  const { sessionManager } = beforeEach();
  sessionManager.config.signalIceConnected = true;
  const mediaSession = sessionManager.jingleJs.prepareSession({ peerID: 'somebody@conference' });
  const message = mediaSession.emit('addChannel', { id: 'channel1' });
  t.is(message.peerID, 'somebody@conference');

  sinon.spy(mediaSession, 'onIceEndOfCandidates');
  sinon.stub(mediaSession, 'send').callsFake(() => {});
  mediaSession.pc.pc.iceConnectionState = 'connected';
  mediaSession.pc.emit('iceConnectionStateChange');
  sinon.assert.notCalled(mediaSession.onIceEndOfCandidates);
  sinon.assert.calledOnce(mediaSession.send);
});

test('message stanzas should check a stanza and handle it', t => {
  const stanza = `
    <message xmlns="jabber:client"
              from="example-number@gjoll.us-east-1.inindca.com/a2b41aaf-23da-4166-9e05-37d1d2018565"
              to="example-user@test-valve-1ym37mj1kao.orgspan.com">
        <propose xmlns="urn:xmpp:jingle-message:0" id="a2b41aaf-23da-4166-9e05-37d1d2018565"
                  inin-cid="2d6c2ec1-17a8-4b2f-8fb2-7161f097a98f"
                  inin-persistent-cid="16677b89-099e-48cb-977a-bc0a917791d3"
                  inin-autoanswer="true">
            <description xmlns="urn:xmpp:jingle:apps:rtp:1" media="audio"></description>
        </propose>
    </message>
  `;
  const { sessionManager } = beforeEach();
  sinon.spy(sessionManager, 'checkStanza');
  sinon.stub(sessionManager.stanzaHandlers, 'jingleMessageInit');
  sessionManager.client._stanzaio.emit('stream:data', jingleStanza.getData(stanza));
  sinon.assert.calledOnce(sessionManager.checkStanza);
  sinon.assert.calledOnce(sessionManager.stanzaHandlers.jingleMessageInit);

  // handle message does nothing
  sessionManager.handleMessage(stanza);
  sinon.assert.calledOnce(sessionManager.checkStanza);
  sinon.assert.calledOnce(sessionManager.stanzaHandlers.jingleMessageInit);
});

test('non message stanzas should not be checked or handled handle it', t => {
  const stanza = `
    <iq xmlns="jabber:client"
              from="example-number@gjoll.us-east-1.inindca.com/a2b41aaf-23da-4166-9e05-37d1d2018565"
              to="example-user@test-valve-1ym37mj1kao.orgspan.com">
        <propose xmlns="urn:xmpp:jingle-message:0" id="a2b41aaf-23da-4166-9e05-37d1d2018565"
                  inin-cid="2d6c2ec1-17a8-4b2f-8fb2-7161f097a98f"
                  inin-persistent-cid="16677b89-099e-48cb-977a-bc0a917791d3"
                  inin-autoanswer="true">
            <description xmlns="urn:xmpp:jingle:apps:rtp:1" media="audio"></description>
        </propose>
    </iq>
  `;
  const { sessionManager } = beforeEach();
  sinon.spy(sessionManager, 'checkStanza');
  sessionManager.client._stanzaio.emit('stream:data', jingleStanza.getData(stanza));
  sinon.assert.notCalled(sessionManager.checkStanza);
});

test('invalid stanzas should not be checked or handled handle it', t => {
  const stanza = `
    <iq >
    </iq>
  `;
  const { sessionManager } = beforeEach();
  sinon.spy(sessionManager, 'checkStanza');
  sessionManager.client._stanzaio.emit('stream:data', jingleStanza.getData(stanza));
  sinon.assert.notCalled(sessionManager.checkStanza);
});

test.serial('it should register for jingle events', async t => {
  const { sessionManager, sandbox } = beforeEach();
  const p = new Promise((resolve) => {
    sandbox.stub(sessionManager.jingleJs, 'process').callsFake(resolve);
  });
  sessionManager.client._stanzaio.emit('iq:set:jingle', jingleActionStanza.toJSON());
  await p;
  t.is(sessionManager.jingleJs.process.calledOnce, true);
  t.is(sessionManager.jingleJs.process.calledWith(jingleActionStanza.toJSON()), true);
});

test.serial('it should not process jingle events for ignored sessions', async t => {
  const { sessionManager, sandbox } = beforeEach();
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
  const { sessionManager } = beforeEach();
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
  const { sessionManager } = beforeEach();
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

test('handleEndRtcSessionsWithJid should return if jid not in peerId', t => {
  t.plan(2);
  const options = {
    jid: 'flashbang@storm.net',
    reason: 'smoky'
  };
  const { sessionManager, sandbox } = beforeEach();
  sessionManager.jingleJs.peers = { 'concussion@storm.net': {} };
  sandbox.stub(sessionManager.jingleJs, 'endPeerSessions');
  const actual = sessionManager.handleEndRtcSessionsWithJid(options);
  t.is(actual, undefined);
  t.truthy(sessionManager.jingleJs.endPeerSessions.notCalled);
});

test('handleEndRtcSessionsWithJid should delete pending sessions', t => {
  const options = {
    jid: 'flashbang@storm.net',
    reason: 'smoky'
  };
  const { sessionManager, sandbox } = beforeEach();
  sessionManager.jingleJs.peers = { 'flashbang@storm.net': {} };
  sessionManager.pendingSessions = {
    'asdf': { to: 'flashbang@storm.net' },
    'qwerty': { to: 'someoneElse@storm.net' }
  };
  sandbox.stub(sessionManager.jingleJs, 'endPeerSessions');
  sessionManager.handleEndRtcSessionsWithJid(options);
  sinon.assert.calledOnce(sessionManager.jingleJs.endPeerSessions);
  t.deepEqual(sessionManager.pendingSessions, { 'qwerty': { to: 'someoneElse@storm.net' } });
});

/* Exposed Methods on the extension */

test('createRtcSession should emit error if an exception occurs when creating MediaDataSession', t => {
  t.plan(1);
  const { sessionManager } = beforeEach();
  const options = {
    jid: 'flashbang@storm.net',
    sid: 'mysmokyFlashBang',
    stream: {},
    peerConstraints: {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    },
    peerConnectionConstraints: {
      optional: [ ]
    }
  };

  sinon.stub(sessionManager.jingleJs, 'addSession').callsFake(() => {
    throw new Error('Intentional error');
  });

  sessionManager.on(events.RTCSESSION_ERROR, err => {
    t.is(err instanceof Error, true);
  });
  sessionManager.expose.createRtcSession(options);
});

test('createRtcSession uses defaults', t => {
  t.plan(1);
  const options = {
    jid: 'flashbang@storm.net',
    sid: 'mysmokyFlashBang',
    stream: {}
  };
  const { sessionManager } = beforeEach();
  sinon.stub(sessionManager.jingleJs, 'addSession').callsFake(session => {
    sinon.stub(session, 'start').callsFake(constraints => {
      t.deepEqual(constraints, {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
    });
  });
  sessionManager.expose.createRtcSession(options);
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
  const { sessionManager, sandbox } = beforeEach();
  sandbox.stub(sessionManager.jingleJs, 'addSession').callsFake((session) => {
    sinon.stub(session, 'start');
  });
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
  const { sessionManager, sandbox } = beforeEach();
  sandbox.stub(sessionManager.jingleJs, 'addSession').callsFake((session) => {
    sinon.stub(session, 'start');
  });
  sessionManager.expose.createRtcSession(options);
  t.is(sessionManager.jingleJs.addSession.called, true);
});

test('initiateRtcSession sends a presence for a conference', t => {
  const { sessionManager } = beforeEach();
  sinon.stub(sessionManager.client._stanzaio, 'send').callsFake(() => {});
  sessionManager.expose.initiateRtcSession({
    stream: { getTracks: () => [ { kind: 'audio' }, { kind: 'video' } ] },
    mediaPurpose: 'screenRecording',
    jid: 'example@conference.test.com'
  });
  sinon.assert.calledOnce(sessionManager.client._stanzaio.send);
  sinon.assert.calledWith(sessionManager.client._stanzaio.send, {
    data: {
      type: 'upgradeMedia',
      to: 'example@conference.test.com',
      from: sessionManager.client._stanzaio.jid.full,
      id: sinon.match.string,
      media: {
        conversationId: undefined,
        sourceCommunicationId: undefined,
        mediaStreams: [{
          screenRecording: 'true',
          audio: 'true',
          video: 'true'
        }]
      }
    }
  });
});

test('initiateRtcSession sends a listener presence for a conference', t => {
  const { sessionManager } = beforeEach();
  sinon.stub(sessionManager.client._stanzaio, 'send');
  sessionManager.expose.initiateRtcSession({
    jid: 'example@conference.test.com'
  });
  sinon.assert.calledOnce(sessionManager.client._stanzaio.send);
  sinon.assert.calledWith(sessionManager.client._stanzaio.send, {
    data: {
      type: 'upgradeMedia',
      to: 'example@conference.test.com',
      from: sessionManager.client._stanzaio.jid.full,
      id: sinon.match.string,
      media: {
        conversationId: undefined,
        sourceCommunicationId: undefined,
        mediaStreams: [{
          listener: 'true'
        }]
      }
    }
  });
});

test('initiateRtcSession sends a listener presence for a one:one', t => {
  const { sessionManager } = beforeEach();
  t.plan(3);
  sinon.stub(sessionManager.client._stanzaio, 'send');
  let pendingId;
  sessionManager.on('send', stanza => {
    t.truthy(stanza.propose.id);
    pendingId = stanza.propose.id;
    t.deepEqual(stanza.propose.descriptions, [ { media: 'audio' }, { media: 'video' } ]);
  });
  sessionManager.expose.initiateRtcSession({
    stream: { getTracks: () => [ { kind: 'audio' }, { kind: 'video' } ] },
    jid: 'example@test.com'
  });
  sinon.assert.notCalled(sessionManager.client._stanzaio.send);
  t.truthy(sessionManager.pendingSessions[pendingId]);
});

test('endRtcSessions should call endAllSessions if no jid', t => {
  const { sessionManager, sandbox } = beforeEach();
  sessionManager.jingleJs.endAllSessions = sandbox.stub();
  sessionManager.expose.endRtcSessions();
  t.is(sessionManager.jingleJs.endAllSessions.called, true);
});

test('endRtcSessions should call endAllSessions if no jid with reason success by default', t => {
  const { sessionManager, sandbox } = beforeEach();
  sessionManager.jingleJs.endAllSessions = sandbox.stub();
  sessionManager.expose.endRtcSessions({}, () => {}, () => {});
  sinon.assert.called(sessionManager.jingleJs.endAllSessions);
  sinon.assert.calledWith(sessionManager.jingleJs.endAllSessions, 'success');
});

test('endRtcSessions should call callback', t => {
  const { sessionManager, sandbox } = beforeEach();
  t.plan(2);
  sessionManager.jingleJs.endAllSessions = sandbox.stub();
  sessionManager.expose.endRtcSessions(() => t.pass());
  t.is(sessionManager.jingleJs.endAllSessions.called, true);
});

test('endRtcSessions should call handleEndRtcSessionsWithJid if a jid is provided', t => {
  const { sessionManager, sandbox } = beforeEach();
  sessionManager.jingleJs.endAllSessions = sandbox.stub();
  sessionManager.jingleJs.endAllSessions = sandbox.stub();
  sinon.stub(sessionManager, 'handleEndRtcSessionsWithJid');

  sessionManager.expose.endRtcSessions({ jid: 'someone@conference.test.com' });

  sinon.assert.notCalled(sessionManager.jingleJs.endAllSessions);
  sinon.assert.calledOnce(sessionManager.handleEndRtcSessionsWithJid);
  sinon.assert.calledWith(sessionManager.handleEndRtcSessionsWithJid, {
    jid: 'someone@conference.test.com',
    reason: 'success'
  });
});

test('endRtcSessions should call handleEndRtcSessionsWithJid if a jid is as a string', t => {
  const { sessionManager, sandbox } = beforeEach();
  sessionManager.jingleJs.endAllSessions = sandbox.stub();
  sessionManager.jingleJs.endAllSessions = sandbox.stub();
  sinon.stub(sessionManager, 'handleEndRtcSessionsWithJid');

  sessionManager.expose.endRtcSessions('someone@test.com');

  sinon.assert.notCalled(sessionManager.jingleJs.endAllSessions);
  sinon.assert.calledOnce(sessionManager.handleEndRtcSessionsWithJid);
  sinon.assert.calledWith(sessionManager.handleEndRtcSessionsWithJid, {
    jid: 'someone@test.com',
    reason: 'success'
  });
});

test('cancelRtcSession should emit error if no session provided', t => {
  const { sessionManager, sandbox } = beforeEach();
  t.plan(2);
  sandbox.stub(sessionManager, 'emit').callsFake((event, data) => {
    t.is(event, 'rtcSessionError');
    t.is(data, 'Cannot cancel session because it is not pending or does not exist');
  });
  sessionManager.expose.cancelRtcSession({});
});

test('cancelRtcSession should emit message if session provided', t => {
  const { sessionManager, sandbox } = beforeEach();
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
  const { sessionManager, sandbox } = beforeEach();
  t.plan(2);
  sandbox.stub(sessionManager, 'emit').callsFake((event, data) => {
    t.is(event, 'rtcSessionError');
    t.is(data, 'Cannot accept session because it is not pending or does not exist');
  });
  sessionManager.expose.acceptRtcSession({});
});

test('acceptRtcSession should emit message if session provided', t => {
  t.plan(4);
  const { sessionManager, sandbox } = beforeEach();
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
  const { sessionManager, sandbox } = beforeEach();
  t.plan(2);
  sandbox.stub(sessionManager, 'emit').callsFake((event, data) => {
    t.is(event, 'rtcSessionError');
    t.is(data, 'Cannot reject session because it is not pending or does not exist');
  });
  sessionManager.expose.rejectRtcSession('asdf');
});

test('rejectRtcSession not send anything if ignore is true', t => {
  const { sessionManager, sandbox } = beforeEach();
  sandbox.stub(sessionManager, 'emit');
  sessionManager.pendingSessions.asdf = {};
  sessionManager.expose.rejectRtcSession('asdf', true);
  t.is(sessionManager.ignoredSessions.get('asdf'), true);
  sinon.assert.notCalled(sessionManager.emit);
});

test('rejectRtcSession will send two reject messages', t => {
  const { sessionManager, sandbox } = beforeEach();
  sandbox.stub(sessionManager, 'emit');
  sessionManager.pendingSessions.asdf = { from: 'someone-else@test.com' };
  sessionManager.expose.rejectRtcSession('asdf');
  sinon.assert.calledTwice(sessionManager.emit);
  sessionManager.emit.firstCall.calledWith({
    to: sessionManager.jid.bare,
    reject: {
      id: 'asdf'
    }
  });
  sessionManager.emit.secondCall.calledWith({
    to: 'someone-else@test.com',
    reject: {
      id: 'asdf'
    }
  });

  t.is(typeof sessionManager.pendingSessions.asdf, 'undefined');
});

test('notifyScreenShareStart should emit screenstart', t => {
  const { sessionManager, sandbox } = beforeEach();
  sandbox.stub(sessionManager, 'emit');

  const mediaSession = sessionManager.jingleJs.prepareSession({
    peerID: 'somebody@example.com',
    applicationTypes: [ ]
  });

  sessionManager.expose.notifyScreenShareStart(mediaSession);

  sessionManager.emit.firstCall.calledWith({
    to: mediaSession.peerID,
    from: sessionManager.jid.bare,
    jingle: {
      action: 'session-info',
      sid: mediaSession.sid,
      screenstart: {}
    }
  });
});

test('notifyScreenShareStop should emit screenstop', t => {
  const { sessionManager, sandbox } = beforeEach();
  sandbox.stub(sessionManager, 'emit');

  const mediaSession = sessionManager.jingleJs.prepareSession({
    peerID: 'somebody@example.com',
    applicationTypes: [ ]
  });

  sessionManager.expose.notifyScreenShareStop(mediaSession);

  sessionManager.emit.firstCall.calledWith({
    to: mediaSession.peerID,
    from: sessionManager.jid.bare,
    jingle: {
      action: 'session-info',
      sid: mediaSession.sid,
      screenstop: {}
    }
  });
});

/* Exposed Methods on the extension */

test('exposeEvents should return an array of jingleEvents', t => {
  const { sessionManager } = beforeEach();
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

test('setIceServers and getIceServers cooperate', t => {
  const { sessionManager } = beforeEach();
  const mockIceServers = [ { urls: [] } ];
  sessionManager.expose.setIceServers(mockIceServers);
  t.is(sessionManager.jingleJs.iceServers, mockIceServers);
  t.is(sessionManager.expose.getIceServers(), mockIceServers);
});

test('refreshIceServers will call getServices on stanzaio and setIceServers with the result', async t => {
  const { sessionManager, sandbox } = beforeEach();
  const mockStunServers = [ { host: 'asdf.exmple.com', port: 3297, transport: 'udp', type: 'stun' } ];
  const mockTurnServers = [ { host: 'asdf.example.com', port: 3297, username: 'asdfk', password: 'qwerty', transport: 'udp', type: 'turn' } ];
  sandbox.stub(sessionManager.client._stanzaio, 'getServices').callsFake(function (jid, type) {
    if (type === 'stun') {
      return Promise.resolve({ to: 'asdf', from: 'qwery', services: { services: mockStunServers } });
    }
    if (type === 'turn') {
      return Promise.resolve({ to: 'asdf', from: 'qwery', services: { services: mockTurnServers } });
    }
  });
  sandbox.stub(sessionManager.expose, 'setIceServers');
  await sessionManager.expose.refreshIceServers();
  sinon.assert.calledTwice(sessionManager.client._stanzaio.getServices);
  console.warn(sessionManager.jingleJs.iceServers);
  t.deepEqual(sessionManager.jingleJs.iceServers.find(s => s.type === 'turn'), {
    type: 'turn',
    urls: `turn:asdf.example.com:3297`,
    username: 'asdfk',
    credential: 'qwerty'
  });
});

test('constructor will call refreshIceServers immediately if the client is connected', async t => {
  const { sandbox } = beforeEach();
  const client = new MockClient('somejid@example.com');
  const mockStunServers = [ { host: 'asdf.exmple.com', port: 3297, transport: 'udp', type: 'stun' } ];
  const mockTurnServers = [ { host: 'asdf.example.com', port: 3297, username: 'asdfk', password: 'qwerty', transport: 'udp', type: 'turn' } ];
  client.logger = { debug () {} };
  client.connected = true;
  sandbox.stub(client._stanzaio, 'getServices').callsFake(function (jid, type) {
    if (type === 'stun') {
      return Promise.resolve({ to: 'asdf', from: 'qwery', services: { services: mockStunServers } });
    }
    if (type === 'turn') {
      return Promise.resolve({ to: 'asdf', from: 'qwery', services: { services: mockTurnServers } });
    }
  });
  const sessionManager = new SessionManager(client);
  sinon.assert.calledTwice(sessionManager.client._stanzaio.getServices);
  await new Promise(resolve => setTimeout(resolve, 10));
  t.deepEqual(sessionManager.jingleJs.iceServers.find(s => s.type === 'turn'), {
    type: 'turn',
    urls: `turn:asdf.example.com:3297`,
    username: 'asdfk',
    credential: 'qwerty'
  });
});

test('constructor will call refreshIceServers when the client becomes connected', async t => {
  const { sessionManager, sandbox } = beforeEach();
  const mockStunServers = [ { host: 'asdf.exmple.com', port: 3297, transport: 'udp', type: 'stun' } ];
  // different than standard to test other code paths
  const mockTurnServers = [ { host: 'asdf.example.com', transport: 'tcp', type: 'turn' } ];
  sandbox.stub(sessionManager.client._stanzaio, 'getServices').callsFake(function (jid, type) {
    if (type === 'stun') {
      return Promise.resolve({ to: 'asdf', from: 'qwery', services: { services: mockStunServers } });
    }
    if (type === 'turn') {
      return Promise.resolve({ to: 'asdf', from: 'qwery', services: { services: mockTurnServers } });
    }
  });
  sinon.assert.notCalled(sessionManager.client._stanzaio.getServices);
  sessionManager.client._stanzaio.emit('connected');
  sinon.assert.calledTwice(sessionManager.client._stanzaio.getServices);
  await new Promise(resolve => setTimeout(resolve, 10));
  t.deepEqual(sessionManager.jingleJs.iceServers.find(s => s.type === 'turn'), {
    type: 'turn',
    urls: `turn:asdf.example.com?transport=tcp`
  });
});

test('on and off hook up to the session manager directly', t => {
  t.plan(1);
  const { sessionManager } = beforeEach();
  const handler = () => t.pass();
  sessionManager.expose.on('someEvent', handler);
  sessionManager.emit('someEvent');
  sessionManager.expose.off('someEvent', handler);

  // it shouldn't fire again now
  sessionManager.emit('someEvent');
});

/* stanzaCheckers --- Predicate functions that check each stanza */
test('jingleMessageInit should evaluate services and jingle message', t => {
  const { sessionManager } = beforeEach();
  t.true(sessionManager.stanzaCheckers.jingleMessageInit(jingleMessageInitStanza.toJSON()));
  t.false(sessionManager.stanzaCheckers.jingleMessageInit(jingleMessageRetractStanza.toJSON()));
});

test('jingleMessageRetract should evaluate services and jingle message', t => {
  const { sessionManager } = beforeEach();
  t.true(sessionManager.stanzaCheckers.jingleMessageRetract(jingleMessageRetractStanza.toJSON()));
  t.false(sessionManager.stanzaCheckers.jingleMessageRetract(jingleMessageInitStanza.toJSON()));
});

test('jingleMessageAccept should evaluate services and jingle message', t => {
  const { sessionManager } = beforeEach();
  t.true(sessionManager.stanzaCheckers.jingleMessageAccept(jingleMessageAcceptStanza.toJSON()));
  t.false(sessionManager.stanzaCheckers.jingleMessageAccept(jingleMessageProceedStanza.toJSON()));
});

test('jingleMessageProceed should evaluate services and jingle message', t => {
  const { sessionManager } = beforeEach();
  t.true(sessionManager.stanzaCheckers.jingleMessageProceed(jingleMessageProceedStanza.toJSON()));
  t.false(sessionManager.stanzaCheckers.jingleMessageProceed(jingleMessageRejectStanza.toJSON()));
});

test('jingleMessageReject should evaluate services and jingle message', t => {
  const { sessionManager } = beforeEach();
  t.true(sessionManager.stanzaCheckers.jingleMessageReject(jingleMessageRejectStanza.toJSON()));
  t.false(sessionManager.stanzaCheckers.jingleMessageReject(jingleMessageProceedStanza.toJSON()));
});

/* stanzaCheckers --- Predicate functions that check each stanza */

/* stanzaHandlers */

test('jingle should return if it receives an error or result for a stanza it did not send', t => {
  const { sessionManager } = beforeEach();
  sinon.stub(sessionManager.jingleJs, 'process');
  const stanzaData = jingleActionStanza.toJSON();
  stanzaData.type = 'error';
  sessionManager.stanzaHandlers.jingle(stanzaData);
  stanzaData.type = 'result';
  sessionManager.stanzaHandlers.jingle(stanzaData);
  sinon.assert.notCalled(sessionManager.jingleJs.process);
});

test('jingle should attach the pendingIq jingle data before processing for an error or result', t => {
  const { sessionManager } = beforeEach();
  sinon.stub(sessionManager.jingleJs, 'process');
  const stanzaData = jingleActionStanza.toJSON();
  const pendingData = { jingle: stanzaData.jingle };
  stanzaData.jingle = null;
  stanzaData.type = 'error';
  sessionManager.pendingIqs[stanzaData.id] = pendingData;

  sessionManager.stanzaHandlers.jingle(stanzaData);
  sinon.assert.calledOnce(sessionManager.jingleJs.process);

  stanzaData.jingle = pendingData.jingle;
  sinon.assert.calledWith(sessionManager.jingleJs.process, stanzaData);
});

test('jingleMessageInit should return without emitting an event if it is from another client of the same user', t => {
  const { sessionManager } = beforeEach();
  sinon.stub(sessionManager, 'emit');
  const stanzaData = jingleMessageInitStanza.toJSON();
  stanzaData.from = sessionManager.jid.bare;
  sessionManager.stanzaHandlers.jingleMessageInit(stanzaData);

  stanzaData.from = '';
  stanzaData.ofrom = sessionManager.jid.bare;
  sessionManager.stanzaHandlers.jingleMessageInit(stanzaData, jingleMessageInitStanza);

  sinon.assert.notCalled(sessionManager.emit);
});

test('jingleMessageInit should emit message', t => {
  const { sessionManager, sandbox } = beforeEach();
  t.plan(0);
  sandbox.stub(sessionManager, 'emit');
  const propose = jingleStanza.getMessageXml({
    'id': 'mmsageInit1',
    'from': 'romeo@montague.lit',
    'ofrom': 'o art thou',
    'to': 'juliet@capulet.com',
    'propose': {
      'id': 'proposeId1'
    }
  });
  propose.propose.xml.attrs['inin-autoanswer'] = 'false';
  const stanzaData = propose.toJSON();
  sessionManager.stanzaHandlers.jingleMessageInit(stanzaData, propose);
  sinon.assert.calledOnce(sessionManager.emit);
  sinon.assert.calledWith(sessionManager.emit, events.REQUEST_INCOMING_RTCSESSION, {
    sessionId: 'proposeId1',
    conversationId: undefined,
    autoAnswer: false,
    persistentConnectionId: undefined,
    roomJid: 'o art thou',
    fromJid: 'o art thou'
  });
});

test('jingleMessageInit should emit message with a different from address', t => {
  t.plan(0);
  const { sessionManager, sandbox } = beforeEach();
  sandbox.stub(sessionManager, 'emit');
  const propose = jingleStanza.getMessageXml({
    'id': 'mmsageInit1',
    'from': 'romeo@montague.lit',
    'ofrom': 'o art thou',
    'to': 'juliet@capulet.com',
    'propose': {
      'id': 'proposeId1'
    }
  });
  propose.propose.xml.attrs['inin-autoanswer'] = 'true';
  const stanzaData = propose.toJSON();
  stanzaData.from = 'o art thou';
  stanzaData.ofrom = null;
  sessionManager.stanzaHandlers.jingleMessageInit(stanzaData, propose);
  sinon.assert.calledOnce(sessionManager.emit);
  sinon.assert.calledWith(sessionManager.emit, events.REQUEST_INCOMING_RTCSESSION, {
    sessionId: 'proposeId1',
    conversationId: undefined,
    autoAnswer: true,
    persistentConnectionId: undefined,
    roomJid: 'o art thou',
    fromJid: 'o art thou'
  });
});

test('jingleMessageRetract should emit a cancel event and remove the pendingSession', t => {
  const { sessionManager } = beforeEach();
  const stanzaData = jingleMessageRetractStanza.toJSON();
  sinon.stub(sessionManager, 'emit');
  sessionManager.pendingSessions[stanzaData.retract.id] = {};
  sessionManager.stanzaHandlers.jingleMessageRetract(stanzaData);
  sinon.assert.calledOnce(sessionManager.emit);
  sinon.assert.calledWith(sessionManager.emit, events.CANCEL_INCOMING_RTCSESSION, stanzaData.retract.id);
  t.is(typeof sessionManager.pendingSessions[stanzaData.retract.id], 'undefined');
});

test('jingleMessageAccept should emit an accept event and remove the pendingSession', t => {
  const { sessionManager } = beforeEach();
  const stanzaData = jingleMessageAcceptStanza.toJSON();
  stanzaData.from = sessionManager.jid.toString() + '/other-client';
  sinon.stub(sessionManager, 'emit');
  sessionManager.pendingSessions[stanzaData.accept.id] = {};
  sessionManager.stanzaHandlers.jingleMessageAccept(stanzaData);
  sinon.assert.calledOnce(sessionManager.emit);
  sinon.assert.calledWith(sessionManager.emit, events.HANDLED_INCOMING_RTCSESSION, stanzaData.accept.id);
  t.is(typeof sessionManager.pendingSessions[stanzaData.accept.id], 'undefined');
});

test('jingleMessageAccept should return without emitting an event if it is from another client of the same user', t => {
  const { sessionManager } = beforeEach();
  sinon.stub(sessionManager, 'emit');
  const stanzaData = jingleMessageAcceptStanza.toJSON();
  stanzaData.from = sessionManager.jid.toString();
  sessionManager.stanzaHandlers.jingleMessageAccept(stanzaData);

  sinon.assert.notCalled(sessionManager.emit);
});

test('jingleMessageProceed should emit a proceed event and not remove the pendingSession', t => {
  const { sessionManager } = beforeEach();
  const stanzaData = jingleMessageProceedStanza.toJSON();
  sinon.stub(sessionManager, 'emit');
  sessionManager.pendingSessions[stanzaData.proceed.id] = {};
  sessionManager.stanzaHandlers.jingleMessageProceed(stanzaData);
  sinon.assert.calledOnce(sessionManager.emit);
  sinon.assert.calledWith(sessionManager.emit, events.OUTGOING_RTCSESSION_PROCEED, stanzaData.proceed.id);
  t.truthy(sessionManager.pendingSessions[stanzaData.proceed.id]);
});

test('jingleMessageReject should return without emitting an event if it is from another client of the same user', t => {
  const { sessionManager } = beforeEach();
  sinon.stub(sessionManager, 'emit');
  const stanzaData = jingleMessageRejectStanza.toJSON();
  stanzaData.from = sessionManager.jid.toString();
  sessionManager.stanzaHandlers.jingleMessageReject(stanzaData);

  sinon.assert.notCalled(sessionManager.emit);
});

test('jingleMessageReject should emit a handled event if it is from another client of the same user', t => {
  const { sessionManager } = beforeEach();
  const stanzaData = jingleMessageRejectStanza.toJSON();
  stanzaData.from = sessionManager.jid.bare;
  sinon.stub(sessionManager, 'emit');
  sessionManager.pendingSessions[stanzaData.reject.id] = {};
  sessionManager.stanzaHandlers.jingleMessageReject(stanzaData);
  sinon.assert.calledOnce(sessionManager.emit);
  sinon.assert.calledWith(sessionManager.emit, events.HANDLED_INCOMING_RTCSESSION, stanzaData.reject.id);
  t.is(typeof sessionManager.pendingSessions[stanzaData.reject.id], 'undefined');
});

test('jingleMessageReject should emit a handled event if it is from another client of the same user', t => {
  const { sessionManager } = beforeEach();
  const stanzaData = jingleMessageRejectStanza.toJSON();
  sinon.stub(sessionManager, 'emit');
  sessionManager.pendingSessions[stanzaData.reject.id] = {};
  sessionManager.stanzaHandlers.jingleMessageReject(stanzaData);
  sinon.assert.calledOnce(sessionManager.emit);
  sinon.assert.calledWith(sessionManager.emit, events.OUTGOING_RTCSESSION_REJECTED, stanzaData.reject.id);
  t.is(typeof sessionManager.pendingSessions[stanzaData.reject.id], 'undefined');
});

/* stanzaHandlers */
