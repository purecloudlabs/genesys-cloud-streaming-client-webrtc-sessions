import { createClient } from 'stanza/browser-module';
import jingleStanza from 'jingle-stanza';
import WildEmitter from 'wildemitter';
import SessionManager from '../../src/index';
import constants from '../../src/constants';
import data from '../data';
import { MockRTCPeerConnection, MockMediaSession } from '../utils';

declare var global: NodeJS.Global & {
  window: any;
  RTCPeerConnection: any;
  MediaSession: any;
};

const {
  jingleActionStanza,
  jingleMessageInitStanza,
  jingleMessageRetractStanza,
  jingleMessageAcceptStanza,
  jingleMessageProceedStanza,
  jingleMessageRejectStanza
} = data;

const events = constants.events;

const MOCK_JXT = {
  withDefinition (label, xmlns, fn) { fn(); },
  utils: {
    attribute () { }
  },
  define () { },
  extend () { },
  extendPresence () { },
  use () { },
  getPresence: () => (function (data) { this.data = data; })
};

class MockStanzaIo extends WildEmitter {
  jid: { bare: any; toString: () => string; full: string; };
  disco: { addFeature (): void; };
  stanzas: { withDefinition (label: any, xmlns: any, fn: any): void; utils: { attribute (): void; }; define (): void; extend (): void; extendPresence (): void; use (): void; getPresence: () => (data: any) => void; };
  constructor (jid) {
    super();
    this.jid = {
      bare: jid,
      toString: () => jid + '/asdf',
      full: jid + '/asdf'
    };
    this.disco = { addFeature () { } };
    this.stanzas = MOCK_JXT;
  }

  send () { }
  getServices () { }
}

class MockClient {
  _stanzaio: MockStanzaIo;
  logger: { debug (): void; info (): void; warn (): void; error (): void; };
  connected: boolean;
  constructor (jid?: string) {
    this._stanzaio = new MockStanzaIo(jid);
    this.logger = { debug () { }, info () { }, warn () { }, error () { } };
  }

  on (event: string, message?: any, details?: any) {
    this._stanzaio.on(event, message || 'random', message);
  }
}

describe('JingleSessionManager', () => {

  beforeEach(() => {
    try {
      Object.defineProperty(global, 'window', { value: global, writable: true, configurable: true });
    } catch (e) { }
    Object.defineProperties(global.window, {
      RTCPeerConnection: { value: MockRTCPeerConnection(), writable: true, configurable: true },
      MediaSession: { value: MockMediaSession(), writable: true, configurable: true },
    });
    Object.defineProperty(global, 'RTCPeerConnection', { value: MockRTCPeerConnection(), writable: true, configurable: true });
    Object.defineProperty(global, 'MediaSession', { value: MockMediaSession(), writable: true, configurable: true });
  });

  const _beforeEach = function () {
    const client = new MockClient('theOneJidToRuleThemAll12345');
    const sessionManager = new SessionManager(client);
    return { stanzaio: client._stanzaio, sessionManager };
  };

  /* custom stanza definitions */
  test('screenstart stanza should be defined properly', () => {
    const stanzaio = createClient();
    const client = new MockClient();
    client._stanzaio = stanzaio;
    const webrtcSessions = new SessionManager(client);
    const IQ = webrtcSessions.client._stanzaio.stanzas.getIQ();
    const iq = new IQ({ to: 'test', from: 'test', jingle: { sid: 'test', action: 'session-info', screenstart: {} } });
    expect(iq.toString().indexOf('screen-start')).toBeTruthy();
  });

  test('screenstop stanza should be defined properly', () => {
    const stanzaio = createClient();
    const client = new MockClient();
    client._stanzaio = stanzaio;
    const webrtcSessions = new SessionManager(client);
    const IQ = webrtcSessions.client._stanzaio.stanzas.getIQ();
    const iq = new IQ({ to: 'test', from: 'test', jingle: { sid: 'test', action: 'session-info', screenstop: {} } });
    expect(iq.toString().indexOf('screen-stop')).toBeTruthy();
  });

  test('sessionManager should take in a client with a stanzaio property and clientOptions', () => {
    expect.assertions(1);
    const stanzaio = {
      on () { },
      disco: { addFeature () { } },
      stanzas: MOCK_JXT
    };
    const clientOptions = {
      iceServers: []
    };
    const sessionManager = new SessionManager({ _stanzaio: stanzaio, on () { } }, clientOptions);
    expect(sessionManager).toBeTruthy();
  });

  test('sessionManager should allow for rtcSessionSurvivability = true', () => {
    const client = new MockClient('somejid@example.com');
    const clientOptions = {
      iceServers: [],
      rtcSessionSurvivability: true
    };
    jest.spyOn(client._stanzaio, 'on');
    const sessionManager = new SessionManager(client, clientOptions);

    jest.spyOn(sessionManager.jingleJs, 'endAllSessions');
    sessionManager.pendingIqs = { foo: 'bar' };
    sessionManager.pendingSessions = { foo: 'bar' };
    client._stanzaio.emit('disconnect');

    expect(sessionManager.pendingIqs).toEqual({ foo: 'bar' });
    expect(sessionManager.pendingSessions).toEqual({ foo: 'bar' });
    expect(sessionManager.jingleJs.endAllSessions).not.toHaveBeenCalled();

    sessionManager.handleIq(); // no-op, but it has to exist
  });

  test('sessionManager should allow for rtcSessionSurvivability = false', () => {
    const client = new MockClient('somejid@example.com');
    const clientOptions = {
      iceServers: [],
      rtcSessionSurvivability: false
    };
    jest.spyOn(client._stanzaio, 'on');
    const sessionManager = new SessionManager(client, clientOptions);

    jest.spyOn(sessionManager.jingleJs, 'endAllSessions');
    sessionManager.pendingIqs = { foo: 'bar' };
    sessionManager.pendingSessions = { foo: 'bar' };
    client._stanzaio.emit('disconnect');

    expect(sessionManager.pendingIqs).toEqual({});
    expect(sessionManager.pendingSessions).toEqual({});
    expect(sessionManager.jingleJs.endAllSessions).toHaveBeenCalledTimes(1);

    sessionManager.handleIq(); // no-op, but it has to exist
  });

  test('sessionManager will not support features of RTCPeerConnection is not defined', () => {
    global.window.RTCPeerConnection = null;
    const client = new MockClient('somejid@example.com');
    const clientOptions = {
      iceServers: []
    };
    jest.spyOn(client._stanzaio.disco, 'addFeature');
    const sessionManager = new SessionManager(client, clientOptions);
    expect(sessionManager).toBeTruthy();
    expect(client._stanzaio.disco.addFeature).toHaveBeenCalledTimes(1); // only once, otherwise, lots of times
  });

  test('exposeEvents', () => {
    const client = new MockClient('somejid@example.com');
    const clientOptions = {
      iceServers: []
    };
    const sessionManager = new SessionManager(client, clientOptions);
    expect(sessionManager.stanzaEvents).toEqual(['iq:set:jingle', 'iq:get:jingle']);
  });

  test('proxyEvents should proxy specific events up from the jingle session manager', () => {
    expect.assertions(7);
    const client = new MockClient('somejid@example.com');
    client.logger = { debug: jest.fn() } as any;
    const clientOptions = {
      iceServers: []
    };
    const sessionManager = new SessionManager(client, clientOptions);

    const mockError = '<error reason="invalid"/>';
    sessionManager.on(events.RTCSESSION_ERROR, e => expect(e).toBe(mockError));
    sessionManager.jingleJs.emit('error', { error: mockError });

    sessionManager.on(events.TRACE_RTCSESSION, (level, msg) => {
      expect(msg).toBe(mockError);
      expect(level).toBe('error');
    });
    sessionManager.jingleJs.emit('log:error', mockError);

    const mockSession = {};
    sessionManager.on(events.INCOMING_RTCSESSION, session => expect(session).toBe(mockSession));
    sessionManager.jingleJs.emit('incoming', mockSession);

    sessionManager.on(events.OUTGOING_RTCSESSION, session => expect(session).toBe(mockSession));
    sessionManager.jingleJs.emit('outgoing', mockSession);

    const mockStanzaData = { to: 'foo', from: 'bar' };
    const sendHandler = data => expect(data).toBe(mockStanzaData);
    sessionManager.on('send', sendHandler);
    sessionManager.jingleJs.emit('send', mockStanzaData);
    sessionManager.off('send', sendHandler);

    const mockIgnoredStanzaData = { to: 'foo', jingle: { sid: '1234' } };
    sessionManager.ignoredSessions.set('1234', true);
    sessionManager.jingleJs.emit('send', mockIgnoredStanzaData);
    expect(sessionManager.logger.debug).toHaveBeenCalledTimes(1);
  });

  test('prepareSession should return Media session', () => {
    const { sessionManager } = _beforeEach();
    sessionManager.config.signalEndOfCandidates = true;
    const mediaSession = sessionManager.jingleJs.prepareSession({ peerID: 'somebody@conference' });
    expect(mediaSession.peerID).toBe('somebody@conference');
  });

  test('onIceCandidate should filter ipv6 candidates by default', async () => {
    const ipv6Candidate = 'a=candidate:4089960842 1 udp 2122197247 2603:900a:160a:aa00:540:b412:2a2d:1f5b 53622 typ host generation 0';
    const ipv4Candidate = 'a=candidate:2999745851 1 udp 2122129151 192.168.56.1 53623 typ host generation 0';
    const { sessionManager } = _beforeEach();
    const mediaSession = sessionManager.jingleJs.prepareSession({ peerID: 'somebody@conference' });
    const spy = jest.spyOn(mediaSession, 'send');

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

    expect(spy).toHaveBeenCalledTimes(1);

    mediaSession.onIceCandidate({}, {
      candidate: null
    });

    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('onIceCandidate should not filter ipv6 candidates if allowIPv6', async () => {
    const ipv6Candidate = 'a=candidate:4089960842 1 udp 2122197247 2603:900a:160a:aa00:540:b412:2a2d:1f5b 53622 typ host generation 0';
    const ipv4Candidate = 'a=candidate:2999745851 1 udp 2122129151 192.168.56.1 53623 typ host generation 0';
    const { sessionManager } = _beforeEach();
    const mediaSession = sessionManager.jingleJs.prepareSession({ peerID: 'somebody@conference' });
    const spy = jest.spyOn(mediaSession, 'send');

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
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('prepareSession should wire up data channel events', async () => {
    expect.assertions(3);
    const { sessionManager } = _beforeEach();
    sessionManager.config.signalEndOfCandidates = true;
    const mediaSession = sessionManager.jingleJs.prepareSession({ peerID: 'somebody@conference' });
    expect(mediaSession.peerID).toBe('somebody@conference');
    const mockChannel: any = { label: 'channel1' };
    mediaSession.emit('addChannel', mockChannel);
    const lastnEvent = new Promise(resolve => {
      mediaSession.on(events.LASTN_CHANGE, (data) => {
        expect(data.foo).toBe('bar');
        expect(data.json).toBe('data');
        resolve();
      });
    });
    mockChannel.onmessage({ data: '{ "foo": "bar", "json": "data" }' });
    mockChannel.onmessage({});
    await lastnEvent;
  });

  test('prepareSession should create a MediaDataSession when appropriate (rtp, datachannel)', () => {
    const { sessionManager } = _beforeEach();
    sessionManager.config.signalEndOfCandidates = true;
    const mediaSession = sessionManager.jingleJs.prepareSession({
      peerID: 'somebody@example.com',
      applicationTypes: ['rtp', 'datachannel']
    });
    expect(mediaSession.peerID).toBe('somebody@example.com');
    expect(typeof mediaSession.getDataChannel).toBe('function');
  });

  test('prepareSession should not create a MediaSession when not appropriate (rtp)', () => {
    const { sessionManager } = _beforeEach();
    sessionManager.config.signalEndOfCandidates = true;
    const mediaSession = sessionManager.jingleJs.prepareSession({
      peerID: 'somebody@example.com',
      applicationTypes: ['rtp']
    });
    expect(mediaSession.peerID).toBe('somebody@example.com');
    expect(typeof mediaSession.getDataChannel).toBe('undefined');
  });

  test('prepareSession should not create a MediaSession when not appropriate (none)', () => {
    const { sessionManager } = _beforeEach();
    sessionManager.config.signalEndOfCandidates = true;
    const mediaSession = sessionManager.jingleJs.prepareSession({
      peerID: 'somebody@example.com',
      applicationTypes: []
    });
    expect(mediaSession.peerID).toBe('somebody@example.com');
    expect(typeof mediaSession.getDataChannel).toBe('undefined');
  });

  test('media session should emit end of candidates', () => {
    const { sessionManager } = _beforeEach();
    sessionManager.config.signalEndOfCandidates = true;
    sessionManager.config.disableEOCShortCircuit = false;
    const mediaSession = sessionManager.jingleJs.prepareSession({ peerID: 'somebody@conference' });
    const message = mediaSession.emit('addChannel', { id: 'channel1' });
    expect(message.peerID).toBe('somebody@conference');

    jest.spyOn(mediaSession, 'onIceEndOfCandidates');
    jest.spyOn(mediaSession, 'send');
    mediaSession.pc.pc.iceConnectionState = 'checking';
    mediaSession.pc.emit('iceConnectionStateChange');
    expect(mediaSession.onIceEndOfCandidates).toHaveBeenCalledTimes(1);
    expect(mediaSession.send).not.toHaveBeenCalled();
  });

  test('media session should not end of candidates on checking', () => {
    const { sessionManager } = _beforeEach();
    sessionManager.config.signalEndOfCandidates = true;
    sessionManager.config.disableEOCShortCircuit = true;
    const mediaSession = sessionManager.jingleJs.prepareSession({ peerID: 'somebody@conference' });
    const message = mediaSession.emit('addChannel', { id: 'channel1' });
    expect(message.peerID).toBe('somebody@conference');

    jest.spyOn(mediaSession, 'onIceEndOfCandidates');
    jest.spyOn(mediaSession, 'send');
    mediaSession.pc.pc.iceConnectionState = 'checking';
    mediaSession.pc.emit('iceConnectionStateChange');
    expect(mediaSession.onIceEndOfCandidates).not.toHaveBeenCalled();
    expect(mediaSession.send).not.toHaveBeenCalled();
  });

  test('media session should emit connected event', () => {
    const { sessionManager } = _beforeEach();
    sessionManager.config.signalIceConnected = true;
    const mediaSession = sessionManager.jingleJs.prepareSession({ peerID: 'somebody@conference' });
    const message = mediaSession.emit('addChannel', { id: 'channel1' });
    expect(message.peerID).toBe('somebody@conference');

    jest.spyOn(mediaSession, 'onIceEndOfCandidates');
    jest.spyOn(mediaSession, 'send').mockImplementation(() => { });
    mediaSession.pc.pc.iceConnectionState = 'connected';
    mediaSession.pc.emit('iceConnectionStateChange');
    expect(mediaSession.onIceEndOfCandidates).not.toHaveBeenCalled();
    expect(mediaSession.send).toHaveBeenCalledTimes(1);
  });

  test('message stanzas should check a stanza and handle it', () => {
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
    const { sessionManager } = _beforeEach();
    jest.spyOn(sessionManager, 'checkStanza');
    jest.spyOn(sessionManager.stanzaHandlers, 'jingleMessageInit');
    sessionManager.client._stanzaio.emit('stream:data', jingleStanza.getData(stanza));
    expect(sessionManager.checkStanza).toHaveBeenCalledTimes(1);
    expect(sessionManager.stanzaHandlers.jingleMessageInit).toHaveBeenCalledTimes(1);

    // handle message does nothing
    sessionManager.handleMessage(stanza);
    expect(sessionManager.checkStanza).toHaveBeenCalledTimes(1);
    expect(sessionManager.stanzaHandlers.jingleMessageInit).toHaveBeenCalledTimes(1);
  });

  test('non message stanzas should not be checked or handled handle it', () => {
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
    const { sessionManager } = _beforeEach();
    jest.spyOn(sessionManager, 'checkStanza');
    sessionManager.client._stanzaio.emit('stream:data', jingleStanza.getData(stanza));
    expect(sessionManager.checkStanza).not.toHaveBeenCalled();
  });

  test('invalid stanzas should not be checked or handled handle it', () => {
    const stanza = `
    <iq >
    </iq>
  `;
    const { sessionManager } = _beforeEach();
    jest.spyOn(sessionManager, 'checkStanza');
    sessionManager.client._stanzaio.emit('stream:data', jingleStanza.getData(stanza));
    expect(sessionManager.checkStanza).not.toHaveBeenCalled();
  });

  test('it should register for jingle events', async () => {
    const { sessionManager } = _beforeEach();
    const p = new Promise((resolve) => {
      jest.spyOn(sessionManager.jingleJs, 'process').mockImplementation(resolve);
    });
    sessionManager.client._stanzaio.emit('iq:set:jingle', jingleActionStanza.toJSON());
    await p;
    expect(sessionManager.jingleJs.process).toHaveBeenCalledTimes(1);
    expect(sessionManager.jingleJs.process).toHaveBeenCalledWith(jingleActionStanza.toJSON());
  });

  test('it should not process jingle events for ignored sessions', async () => {
    const { sessionManager } = _beforeEach();
    jest.spyOn(sessionManager.jingleJs, 'process');
    const p = new Promise((resolve) => {
      jest.spyOn(sessionManager.logger, 'debug').mockImplementation(resolve);
    });
    sessionManager.ignoredSessions.set(jingleActionStanza.toJSON().jingle.sid, true);
    sessionManager.client._stanzaio.emit('iq:set:jingle', jingleActionStanza.toJSON());
    await p;
    expect(sessionManager.jingleJs.process).not.toHaveBeenCalled();
  });

  test('it should send stanzas emitted by jinglejs', async () => {
    const sentStanza = jingleActionStanza.toJSON();
    const { sessionManager } = _beforeEach();
    expect.assertions(1);
    const p = new Promise(resolve => {
      sessionManager.on('send', stanza => {
        expect(stanza).toBe(sentStanza);
        resolve();
      });
    });
    sessionManager.jingleJs.emit('send', sentStanza);
    return p;
  });

  test('it should not send stanzas emitted by jinglejs if the session is ignored', async () => {
    const sentStanza = jingleActionStanza.toJSON();
    const { sessionManager } = _beforeEach();
    expect.assertions(1);
    const p = new Promise((resolve, reject) => {
      sessionManager.on('send', stanza => {
        reject(new Error('Send should not have been called'));
      });
      jest.spyOn(sessionManager.logger, 'debug').mockImplementation(l => {
        expect(l).toBe('Ignoring outbound stanza for ignored session');
        resolve();
      });
    });
    sessionManager.ignoredSessions.set(jingleActionStanza.toJSON().jingle.sid, true);
    sessionManager.jingleJs.emit('send', sentStanza);
    await p;
  }
  );

  test('handleEndRtcSessionsWithJid should return if jid not in peerId', () => {
    expect.assertions(2);
    const options = {
      jid: 'flashbang@storm.net',
      reason: 'smoky'
    };
    const { sessionManager } = _beforeEach();
    sessionManager.jingleJs.peers = { 'concussion@storm.net': {} };
    jest.spyOn(sessionManager.jingleJs, 'endPeerSessions');
    const actual = sessionManager.handleEndRtcSessionsWithJid(options);
    expect(actual).toBe(undefined);
    expect(sessionManager.jingleJs.endPeerSessions).not.toHaveBeenCalled();
  });

  test('handleEndRtcSessionsWithJid should delete pending sessions', () => {
    const options = {
      jid: 'flashbang@storm.net',
      reason: 'smoky'
    };
    const { sessionManager } = _beforeEach();
    sessionManager.jingleJs.peers = { 'flashbang@storm.net': {} };
    sessionManager.pendingSessions = {
      'asdf': { to: 'flashbang@storm.net' },
      'qwerty': { to: 'someoneElse@storm.net' }
    };
    jest.spyOn(sessionManager.jingleJs, 'endPeerSessions').mockImplementation();
    sessionManager.handleEndRtcSessionsWithJid(options);
    expect(sessionManager.jingleJs.endPeerSessions).toHaveBeenCalledTimes(1);
    expect(sessionManager.pendingSessions).toEqual({ 'qwerty': { to: 'someoneElse@storm.net' } });
  });

  /* Exposed Methods on the extension */

  test('createRtcSession should emit error if an exception occurs when creating MediaDataSession', () => {
    expect.assertions(1);
    const { sessionManager } = _beforeEach();
    const options = {
      jid: 'flashbang@storm.net',
      sid: 'mysmokyFlashBang',
      stream: {},
      peerConstraints: {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      },
      peerConnectionConstraints: {
        optional: []
      }
    };

    jest.spyOn(sessionManager.jingleJs, 'addSession').mockImplementation(() => {
      throw new Error('Intentional error');
    });

    sessionManager.on(events.RTCSESSION_ERROR, err => {
      expect(err instanceof Error).toBe(true);
    });
    sessionManager.expose.createRtcSession(options);
  });

  test('createRtcSession uses defaults', () => {
    expect.assertions(1);
    const options = {
      jid: 'flashbang@storm.net',
      sid: 'mysmokyFlashBang',
      stream: {}
    };
    const { sessionManager } = _beforeEach();
    jest.spyOn(sessionManager.jingleJs, 'addSession').mockImplementation((session: any) => {
      jest.spyOn(session, 'start').mockImplementation(constraints => {
        expect(constraints).toEqual({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
      });
    });
    sessionManager.expose.createRtcSession(options as any);
  });

  test('createRtcSession should emit error if an exception occurs when creating MediaSession', () => {
    expect.assertions(0);
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
    const { sessionManager } = _beforeEach();
    jest.spyOn(sessionManager.jingleJs, 'addSession').mockImplementation((session: any) => {
      jest.spyOn(session, 'start');
    });
    sessionManager.expose.createRtcSession(options);
    jest.spyOn(sessionManager, 'emit').mockImplementation((event, data) => {
      expect(event).toBe(events.RTCSESSION_ERROR);
      expect(data instanceof Error).toBe(true);
    });
  });

  test('createRtcSession should addSession and start', () => {
    expect.assertions(1);
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
    const { sessionManager } = _beforeEach();
    jest.spyOn(sessionManager.jingleJs, 'addSession').mockImplementation((session: any) => {
      jest.spyOn(session, 'start');
    });
    sessionManager.expose.createRtcSession(options);
    expect(sessionManager.jingleJs.addSession).toHaveBeenCalled();
  });

  test('initiateRtcSession sends a presence for a conference', () => {
    const { sessionManager } = _beforeEach();
    jest.spyOn(sessionManager.client._stanzaio, 'send').mockImplementation(() => { });
    sessionManager.expose.initiateRtcSession({
      stream: { getTracks: () => [{ kind: 'audio' }, { kind: 'video' }] },
      mediaPurpose: 'screenRecording',
      jid: 'example@conference.test.com'
    });
    expect(sessionManager.client._stanzaio.send).toHaveBeenCalledTimes(1);
    expect(sessionManager.client._stanzaio.send).toHaveBeenCalledWith({
      data: {
        type: 'upgradeMedia',
        to: 'example@conference.test.com',
        from: sessionManager.client._stanzaio.jid.full,
        id: expect.any(String),
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

  test('initiateRtcSession sends a listener presence for a conference', () => {
    const { sessionManager } = _beforeEach();
    jest.spyOn(sessionManager.client._stanzaio, 'send');
    sessionManager.expose.initiateRtcSession({
      jid: 'example@conference.test.com'
    });
    expect(sessionManager.client._stanzaio.send).toHaveBeenCalledTimes(1);
    expect(sessionManager.client._stanzaio.send).toHaveBeenCalledWith({
      data: {
        type: 'upgradeMedia',
        to: 'example@conference.test.com',
        from: sessionManager.client._stanzaio.jid.full,
        id: expect.any(String),
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

  test('initiateRtcSession sends a listener presence for a one:one', () => {
    const { sessionManager } = _beforeEach();
    expect.assertions(4);
    jest.spyOn(sessionManager.client._stanzaio, 'send');
    let pendingId;
    sessionManager.on('send', stanza => {
      expect(stanza.propose.id).toBeTruthy();
      pendingId = stanza.propose.id;
      expect(stanza.propose.descriptions).toEqual([{ media: 'audio' }, { media: 'video' }]);
    });
    sessionManager.expose.initiateRtcSession({
      stream: { getTracks: () => [{ kind: 'audio' }, { kind: 'video' }] },
      jid: 'example@test.com'
    });
    expect(sessionManager.client._stanzaio.send).not.toHaveBeenCalled();
    expect(sessionManager.pendingSessions[pendingId]).toBeTruthy();
  });

  test('endRtcSessions should call endAllSessions if no jid', () => {
    const { sessionManager } = _beforeEach();
    sessionManager.jingleJs.endAllSessions = jest.fn();
    sessionManager.expose.endRtcSessions(null);
    expect(sessionManager.jingleJs.endAllSessions).toHaveBeenCalled();
  });

  test('endRtcSessions should call endAllSessions if no jid with reason success by default', () => {
    const { sessionManager } = _beforeEach();
    sessionManager.jingleJs.endAllSessions = jest.fn();
    sessionManager.expose.endRtcSessions({}, () => { }, () => { });
    expect(sessionManager.jingleJs.endAllSessions).toHaveBeenCalled();
    expect(sessionManager.jingleJs.endAllSessions).toHaveBeenCalledWith('success');
  });

  test('endRtcSessions should call callback', () => {
    const { sessionManager } = _beforeEach();
    expect.assertions(1);
    sessionManager.jingleJs.endAllSessions = jest.fn();
    sessionManager.expose.endRtcSessions(() => { });
    expect(sessionManager.jingleJs.endAllSessions).toHaveBeenCalled();
  });

  test('endRtcSessions should call handleEndRtcSessionsWithJid if a jid is provided', () => {
    const { sessionManager } = _beforeEach();
    sessionManager.jingleJs.endAllSessions = jest.fn();
    sessionManager.jingleJs.endAllSessions = jest.fn();
    jest.spyOn(sessionManager, 'handleEndRtcSessionsWithJid');

    sessionManager.expose.endRtcSessions({ jid: 'someone@conference.test.com' });

    expect(sessionManager.jingleJs.endAllSessions).not.toHaveBeenCalled();
    expect(sessionManager.handleEndRtcSessionsWithJid).toHaveBeenCalledTimes(1);
    expect(sessionManager.handleEndRtcSessionsWithJid).toHaveBeenCalledWith({
      jid: 'someone@conference.test.com',
      reason: 'success'
    });
  });

  test('endRtcSessions should call handleEndRtcSessionsWithJid if a jid is as a string', () => {
    const { sessionManager } = _beforeEach();
    sessionManager.jingleJs.endAllSessions = jest.fn();
    sessionManager.jingleJs.endAllSessions = jest.fn();
    jest.spyOn(sessionManager, 'handleEndRtcSessionsWithJid');

    sessionManager.expose.endRtcSessions('someone@test.com');

    expect(sessionManager.jingleJs.endAllSessions).not.toHaveBeenCalled();
    expect(sessionManager.handleEndRtcSessionsWithJid).toHaveBeenCalledTimes(1);
    expect(sessionManager.handleEndRtcSessionsWithJid).toHaveBeenCalledWith({
      jid: 'someone@test.com',
      reason: 'success'
    });
  });

  test('cancelRtcSession should emit error if no session provided', () => {
    const { sessionManager } = _beforeEach();
    expect.assertions(2);
    jest.spyOn(sessionManager, 'emit').mockImplementation((event, data) => {
      expect(event).toBe('rtcSessionError');
      expect(data).toBe('Cannot cancel session because it is not pending or does not exist');
    });
    sessionManager.expose.cancelRtcSession({});
    // TODO: make sure the assertions(2) works as expected
  });

  test('cancelRtcSession should emit message if session provided', () => {
    const { sessionManager } = _beforeEach();
    expect.assertions(2);
    sessionManager.pendingSessions = {
      session1: 'abcSession1',
      to: 'goingTo'
    };
    jest.spyOn(sessionManager, 'emit').mockImplementation((event, data) => {
      expect(event).toBe('send');
      expect(data).toEqual({ to: undefined, retract: { id: 'session1' } });
    });
    sessionManager.expose.cancelRtcSession('session1');
  });

  test('acceptRtcSession should emit error if no session provided', () => {
    const { sessionManager } = _beforeEach();
    expect.assertions(2);
    jest.spyOn(sessionManager, 'emit').mockImplementation((event, data) => {
      expect(event).toBe('rtcSessionError');
      expect(data).toBe('Cannot accept session because it is not pending or does not exist');
    });
    sessionManager.expose.acceptRtcSession({});
  });

  test('acceptRtcSession should emit message if session provided', () => {
    expect.assertions(4);
    const { sessionManager } = _beforeEach();
    sessionManager.pendingSessions = {
      session1: {
        from: {
          toString: () => { }
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
    jest.spyOn(sessionManager, 'emit').mockImplementation((event, data) => {
      expect(event).toBe(emitObjects[counter].event);
      expect(data).toEqual(emitObjects[counter].data);
      counter++;
    });
    sessionManager.expose.acceptRtcSession('session1');
  });

  test('rejectRtcSession should emit error if no session provided', () => {
    const { sessionManager } = _beforeEach();
    expect.assertions(2);
    jest.spyOn(sessionManager, 'emit').mockImplementation((event, data) => {
      expect(event).toBe('rtcSessionError');
      expect(data).toBe('Cannot reject session because it is not pending or does not exist');
    });
    sessionManager.expose.rejectRtcSession('asdf', false);
  });

  test('rejectRtcSession not send anything if ignore is true', () => {
    const { sessionManager } = _beforeEach();
    jest.spyOn(sessionManager, 'emit');
    sessionManager.pendingSessions['asdf'] = {};
    sessionManager.expose.rejectRtcSession('asdf', true);
    expect(sessionManager.ignoredSessions.get('asdf')).toBe(true);
    expect(sessionManager.emit).not.toHaveBeenCalled();
  });

  test('rejectRtcSession will send two reject messages', () => {
    const { sessionManager } = _beforeEach();
    jest.spyOn(sessionManager, 'emit');
    sessionManager.pendingSessions['asdf'] = { from: 'someone-else@test.com' };
    sessionManager.expose.rejectRtcSession('asdf', false);
    expect(sessionManager.emit).toHaveBeenCalledTimes(2);
    expect(sessionManager.emit).toHaveBeenNthCalledWith(1, 'send', {
      to: sessionManager.jid.bare,
      reject: {
        id: 'asdf'
      }
    }, true);
    expect(sessionManager.emit).toHaveBeenNthCalledWith(2, 'send', {
      to: 'someone-else@test.com',
      reject: {
        id: 'asdf'
      }
    }, true);
    expect(typeof sessionManager.pendingSessions['asdf']).toBe('undefined');
  });

  test('requestStateDump should emit statedump', () => {
    const requestId = '44sddk';

    const { sessionManager } = _beforeEach();
    jest.spyOn(sessionManager, 'emit');

    const mediaSession = sessionManager.jingleJs.prepareSession({
      peerID: 'somebody@example.com',
      applicationTypes: []
    });

    sessionManager.expose.requestStateDump(mediaSession, requestId);

    expect(sessionManager.emit).toHaveBeenNthCalledWith(1, 'send', {
      to: `${mediaSession.peerID}`,
      from: sessionManager.jid.bare,
      type: 'set',
      jingle: {
        action: 'session-info',
        sid: mediaSession.sid,
        statedump: {
          requestId
        }
      }
    });
  });

  test('notifyScreenShareStart should emit screenstart', () => {
    const { sessionManager } = _beforeEach();
    jest.spyOn(sessionManager, 'emit');

    const mediaSession = sessionManager.jingleJs.prepareSession({
      peerID: 'somebody@example.com',
      applicationTypes: []
    });

    sessionManager.expose.notifyScreenShareStart(mediaSession);

    expect(sessionManager.emit).toHaveBeenNthCalledWith(1, 'send', {
      to: `${mediaSession.peerID}`,
      from: sessionManager.jid.bare,
      type: 'set',
      jingle: {
        action: 'session-info',
        sid: mediaSession.sid,
        screenstart: {}
      }
    });
  });

  test('notifyScreenShareStop should emit screenstop', () => {
    const { sessionManager } = _beforeEach();
    jest.spyOn(sessionManager, 'emit');

    const mediaSession = sessionManager.jingleJs.prepareSession({
      peerID: 'somebody@example.com',
      applicationTypes: []
    });

    sessionManager.expose.notifyScreenShareStop(mediaSession);

    expect(sessionManager.emit).toHaveBeenNthCalledWith(1, 'send', {
      to: `${mediaSession.peerID}`,
      from: sessionManager.jid.bare,
      type: 'set',
      jingle: {
        action: 'session-info',
        sid: mediaSession.sid,
        screenstop: {}
      }
    });
  });

  /* Exposed Methods on the extension */

  test('exposeEvents should return an array of jingleEvents', () => {
    const { sessionManager } = _beforeEach();
    const actual = sessionManager.exposeEvents;
    const expected = [
      'services',
      'propose',
      'retract',
      'accept',
      'proceed',
      'reject'
    ];
    expect(actual).toEqual(expected);
  });

  test('setIceServers and getIceServers cooperate', () => {
    const { sessionManager } = _beforeEach();
    const mockIceServers = [{ urls: [] }];
    sessionManager.expose.setIceServers(mockIceServers);
    expect(sessionManager.jingleJs.iceServers).toBe(mockIceServers);
    expect(sessionManager.expose.getIceServers()).toBe(mockIceServers);
  });

  test('refreshIceServers will call getServices on stanzaio and setIceServers with the result', async () => {
    const { sessionManager } = _beforeEach();
    const mockStunServers = [{ host: 'asdf.exmple.com', port: 3297, transport: 'udp', type: 'stun' }];
    const mockTurnServers = [{ host: 'asdf.example.com', port: 3297, username: 'asdfk', password: 'qwerty', transport: 'udp', type: 'turn' }];
    jest.spyOn(sessionManager.client._stanzaio, 'getServices').mockImplementation(function (jid, type) {
      if (type === 'stun') {
        return Promise.resolve({ to: 'asdf', from: 'qwery', services: { services: mockStunServers } });
      }
      if (type === 'turn') {
        return Promise.resolve({ to: 'asdf', from: 'qwery', services: { services: mockTurnServers } });
      }
    });
    jest.spyOn(sessionManager.expose, 'setIceServers');
    await sessionManager.expose.refreshIceServers();
    expect(sessionManager.client._stanzaio.getServices).toHaveBeenCalledTimes(2);
    console.warn(sessionManager.jingleJs.iceServers);
    expect(sessionManager.jingleJs.iceServers.find(s => s.type === 'turn')).toEqual({
      type: 'turn',
      urls: `turn:asdf.example.com:3297`,
      username: 'asdfk',
      credential: 'qwerty'
    });
  });

  test('constructor will call refreshIceServers immediately if the client is connected', async () => {
    const client = new MockClient('somejid@example.com');
    const mockStunServers = [{ host: 'asdf.exmple.com', port: 3297, transport: 'udp', type: 'stun' }];
    const mockTurnServers = [{ host: 'asdf.example.com', port: 3297, username: 'asdfk', password: 'qwerty', transport: 'udp', type: 'turn' }];
    client.logger = { debug () { } } as any;
    client.connected = true;
    client._stanzaio.getServices = jest.fn().mockImplementation(function (jid, type) {
      if (type === 'stun') {
        return Promise.resolve({ to: 'asdf', from: 'qwery', services: { services: mockStunServers } });
      }
      if (type === 'turn') {
        return Promise.resolve({ to: 'asdf', from: 'qwery', services: { services: mockTurnServers } });
      }
    });
    const sessionManager = new SessionManager(client);
    expect(sessionManager.client._stanzaio.getServices).toHaveBeenCalledTimes(2);
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(sessionManager.jingleJs.iceServers.find(s => s.type === 'turn')).toEqual({
      type: 'turn',
      urls: `turn:asdf.example.com:3297`,
      username: 'asdfk',
      credential: 'qwerty'
    });
  });

  test('constructor will call refreshIceServers when the client becomes connected', async () => {
    const { sessionManager } = _beforeEach();
    const mockStunServers = [{ host: 'asdf.exmple.com', port: 3297, transport: 'udp', type: 'stun' }];
    // different than standard to test other code paths
    const mockTurnServers = [{ host: 'asdf.example.com', transport: 'tcp', type: 'turn' }];
    jest.spyOn(sessionManager.client._stanzaio, 'getServices').mockImplementation(function (jid, type) {
      if (type === 'stun') {
        return Promise.resolve({ to: 'asdf', from: 'qwery', services: { services: mockStunServers } });
      }
      if (type === 'turn') {
        return Promise.resolve({ to: 'asdf', from: 'qwery', services: { services: mockTurnServers } });
      }
    });
    expect(sessionManager.client._stanzaio.getServices).not.toHaveBeenCalled();
    sessionManager.client._stanzaio.emit('connected');
    expect(sessionManager.client._stanzaio.getServices).toHaveBeenCalledTimes(2);
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(sessionManager.jingleJs.iceServers.find(s => s.type === 'turn')).toEqual({
      type: 'turn',
      urls: `turn:asdf.example.com?transport=tcp`
    });
  });

  test('on and off hook up to the session manager directly', () => {
    expect.assertions(1);
    const { sessionManager } = _beforeEach();
    const handler = () => { expect(true).toBe(true) };
    sessionManager.expose.on('someEvent', handler);
    sessionManager.emit('someEvent');
    sessionManager.expose.off('someEvent', handler);

    // it shouldn't fire again now
    sessionManager.emit('someEvent');
  });

  /* stanzaCheckers --- Predicate functions that check each stanza */
  test('jingleMessageInit should evaluate services and jingle message', () => {
    const { sessionManager } = _beforeEach();
    expect(
      sessionManager.stanzaCheckers.jingleMessageInit(jingleMessageInitStanza.toJSON())
    ).toBe(true);
    expect(
      sessionManager.stanzaCheckers.jingleMessageInit(jingleMessageRetractStanza.toJSON())
    ).toBe(false);
  });

  test('jingleMessageRetract should evaluate services and jingle message', () => {
    const { sessionManager } = _beforeEach();
    expect(
      sessionManager.stanzaCheckers.jingleMessageRetract(jingleMessageRetractStanza.toJSON())
    ).toBe(true);
    expect(
      sessionManager.stanzaCheckers.jingleMessageRetract(jingleMessageInitStanza.toJSON())
    ).toBe(false);
  });

  test('jingleMessageAccept should evaluate services and jingle message', () => {
    const { sessionManager } = _beforeEach();
    expect(
      sessionManager.stanzaCheckers.jingleMessageAccept(jingleMessageAcceptStanza.toJSON())
    ).toBe(true);
    expect(
      sessionManager.stanzaCheckers.jingleMessageAccept(jingleMessageProceedStanza.toJSON())
    ).toBe(false);
  });

  test('jingleMessageProceed should evaluate services and jingle message', () => {
    const { sessionManager } = _beforeEach();
    expect(
      sessionManager.stanzaCheckers.jingleMessageProceed(jingleMessageProceedStanza.toJSON())
    ).toBe(true);
    expect(
      sessionManager.stanzaCheckers.jingleMessageProceed(jingleMessageRejectStanza.toJSON())
    ).toBe(false);
  });

  test('jingleMessageReject should evaluate services and jingle message', () => {
    const { sessionManager } = _beforeEach();
    expect(
      sessionManager.stanzaCheckers.jingleMessageReject(jingleMessageRejectStanza.toJSON())
    ).toBe(true);
    expect(
      sessionManager.stanzaCheckers.jingleMessageReject(jingleMessageProceedStanza.toJSON())
    ).toBe(false);
  });

  /* stanzaCheckers --- Predicate functions that check each stanza */

  /* stanzaHandlers */

  test('jingle should return if it receives an error or result for a stanza it did not send', () => {
    const { sessionManager } = _beforeEach();
    jest.spyOn(sessionManager.jingleJs, 'process');
    const stanzaData = jingleActionStanza.toJSON();
    stanzaData.type = 'error';
    sessionManager.stanzaHandlers.jingle(stanzaData);
    stanzaData.type = 'result';
    sessionManager.stanzaHandlers.jingle(stanzaData);
    expect(sessionManager.jingleJs.process).not.toHaveBeenCalled();
  });

  test('jingle should attach the pendingIq jingle data before processing for an error or result', () => {
    const { sessionManager } = _beforeEach();
    jest.spyOn(sessionManager.jingleJs, 'process');
    const stanzaData = jingleActionStanza.toJSON();
    const pendingData = { jingle: stanzaData.jingle };
    stanzaData.jingle = null;
    stanzaData.type = 'error';
    sessionManager.pendingIqs[stanzaData.id] = pendingData;

    sessionManager.stanzaHandlers.jingle(stanzaData);
    expect(sessionManager.jingleJs.process).toHaveBeenCalledTimes(1);

    stanzaData.jingle = pendingData.jingle;
    expect(sessionManager.jingleJs.process).toHaveBeenCalledWith(stanzaData);
  });

  test('jingleMessageInit should return without emitting an event if it is from another client of the same user', () => {
    const { sessionManager } = _beforeEach();
    jest.spyOn(sessionManager, 'emit');
    const stanzaData = jingleMessageInitStanza.toJSON();
    stanzaData.from = sessionManager.jid.bare;
    sessionManager.stanzaHandlers.jingleMessageInit(stanzaData);

    stanzaData.from = '';
    stanzaData.ofrom = sessionManager.jid.bare;
    sessionManager.stanzaHandlers.jingleMessageInit(stanzaData, jingleMessageInitStanza);

    expect(sessionManager.emit).not.toHaveBeenCalled();
  });

  test('jingleMessageInit should emit message', () => {
    const { sessionManager } = _beforeEach();
    expect.assertions(2);
    jest.spyOn(sessionManager, 'emit');
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
    expect(sessionManager.emit).toHaveBeenCalledTimes(1);
    expect(sessionManager.emit).toHaveBeenCalledWith(events.REQUEST_INCOMING_RTCSESSION, {
      sessionId: 'proposeId1',
      conversationId: undefined,
      autoAnswer: false,
      persistentConnectionId: undefined,
      roomJid: 'o art thou',
      fromJid: 'o art thou'
    });
  });

  test('jingleMessageInit should emit message with a different from address', () => {
    expect.assertions(2);
    const { sessionManager } = _beforeEach();
    jest.spyOn(sessionManager, 'emit');
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
    expect(sessionManager.emit).toHaveBeenCalledTimes(1);
    expect(sessionManager.emit).toHaveBeenCalledWith(events.REQUEST_INCOMING_RTCSESSION, {
      sessionId: 'proposeId1',
      conversationId: undefined,
      autoAnswer: true,
      persistentConnectionId: undefined,
      roomJid: 'o art thou',
      fromJid: 'o art thou'
    });
  });

  test('jingleMessageRetract should emit a cancel event and remove the pendingSession', () => {
    const { sessionManager } = _beforeEach();
    const stanzaData = jingleMessageRetractStanza.toJSON();
    jest.spyOn(sessionManager, 'emit');
    sessionManager.pendingSessions[stanzaData.retract.id] = {};
    sessionManager.stanzaHandlers.jingleMessageRetract(stanzaData);
    expect(sessionManager.emit).toHaveBeenCalledTimes(1);
    expect(sessionManager.emit).toHaveBeenCalledWith(events.CANCEL_INCOMING_RTCSESSION, stanzaData.retract.id);
    expect(typeof sessionManager.pendingSessions[stanzaData.retract.id]).toBe('undefined');
  });

  test('jingleMessageAccept should emit an accept event and remove the pendingSession', () => {
    const { sessionManager } = _beforeEach();
    const stanzaData = jingleMessageAcceptStanza.toJSON();
    stanzaData.from = sessionManager.jid.toString() + '/other-client';
    jest.spyOn(sessionManager, 'emit');
    sessionManager.pendingSessions[stanzaData.accept.id] = {};
    sessionManager.stanzaHandlers.jingleMessageAccept(stanzaData);
    expect(sessionManager.emit).toHaveBeenCalledTimes(1);
    expect(sessionManager.emit).toHaveBeenCalledWith(events.HANDLED_INCOMING_RTCSESSION, stanzaData.accept.id);
    expect(typeof sessionManager.pendingSessions[stanzaData.accept.id]).toBe('undefined');
  });

  test('jingleMessageAccept should return without emitting an event if it is from another client of the same user', () => {
    const { sessionManager } = _beforeEach();
    jest.spyOn(sessionManager, 'emit');
    const stanzaData = jingleMessageAcceptStanza.toJSON();
    stanzaData.from = sessionManager.jid.toString();
    sessionManager.stanzaHandlers.jingleMessageAccept(stanzaData);
    expect(sessionManager.emit).not.toHaveBeenCalled();
  });

  test('jingleMessageProceed should emit a proceed event and not remove the pendingSession', () => {
    const { sessionManager } = _beforeEach();
    const stanzaData = jingleMessageProceedStanza.toJSON();
    jest.spyOn(sessionManager, 'emit');
    sessionManager.pendingSessions[stanzaData.proceed.id] = {};
    sessionManager.stanzaHandlers.jingleMessageProceed(stanzaData);
    expect(sessionManager.emit).toHaveBeenCalledTimes(1);
    expect(sessionManager.emit).toHaveBeenCalledWith(events.OUTGOING_RTCSESSION_PROCEED, stanzaData.proceed.id, 'romeo@montague.lit');
    expect(sessionManager.pendingSessions[stanzaData.proceed.id]).toBeTruthy();
  });

  test('jingleMessageReject should return without emitting an event if it is from another client of the same user', () => {
    const { sessionManager } = _beforeEach();
    jest.spyOn(sessionManager, 'emit');
    const stanzaData = jingleMessageRejectStanza.toJSON();
    stanzaData.from = sessionManager.jid.toString();
    sessionManager.stanzaHandlers.jingleMessageReject(stanzaData);
    expect(sessionManager.emit).not.toHaveBeenCalled();
  });

  test('jingleMessageReject should emit a handled event if it is from another client of the same user (incoming)', () => {
    const { sessionManager } = _beforeEach();
    const stanzaData = jingleMessageRejectStanza.toJSON();
    stanzaData.from = sessionManager.jid.bare;
    jest.spyOn(sessionManager, 'emit');
    sessionManager.pendingSessions[stanzaData.reject.id] = {};
    sessionManager.stanzaHandlers.jingleMessageReject(stanzaData);
    expect(sessionManager.emit).toHaveBeenCalledTimes(1);
    expect(sessionManager.emit).toHaveBeenCalledWith(events.HANDLED_INCOMING_RTCSESSION, stanzaData.reject.id);
    expect(typeof sessionManager.pendingSessions[stanzaData.reject.id]).toBe('undefined');
  });

  test('jingleMessageReject should emit a handled event if it is from another client of the same user (outgoing)', () => {
    const { sessionManager } = _beforeEach();
    const stanzaData = jingleMessageRejectStanza.toJSON();
    jest.spyOn(sessionManager, 'emit');
    sessionManager.pendingSessions[stanzaData.reject.id] = {};
    sessionManager.stanzaHandlers.jingleMessageReject(stanzaData);
    expect(sessionManager.emit).toHaveBeenCalledTimes(1);
    expect(sessionManager.emit).toHaveBeenCalledWith(events.OUTGOING_RTCSESSION_REJECTED, stanzaData.reject.id);
    expect(typeof sessionManager.pendingSessions[stanzaData.reject.id]).toBe('undefined');
  });
});

/* stanzaHandlers */
