
declare module 'jingle-purecloud' {
  import WildEmitter from 'wildemitter';
  import MediaSession, { MediaSessionOptions } from 'jingle-media-session-purecloud';
  import MediaFileTransferSession from 'jingle-filetransfer-session-purecloud';
  import PeerConnection from 'rtcpeerconnection';
  import BaseSession from 'jingle-session';

  interface SessionManagerConfig {
    debug: boolean;
    peerConnectionConfig: {
      iceServers: RTCIceServer[];
      iceTransportPolicy: RTCIceTransportPolicy;
      disableEOCShortCircuit: boolean;
      signalIceConnected: any; // !conf.signalIceConnected
    },
    peerConnectionConstraints: {
      optional: [
        { DtlsSrtpKeyAgreement: boolean },
        { RtpDataChannels: boolean }
      ]
    },
    media: MediaStreamConstraints;
    [key: string]: any;
  }

  interface SessionManagerConstructOpts {
    jid?: string;
    selfID?: string;
    applcationTypes?: 'rtp' | 'filetransfer' | string;
    prepareSession?: (options: MediaSessionOptions) => BaseSession;
    iceServers?: RTCIceServer[];
    iceTransportPolicy?: RTCIceTransportPolicy;
    disableEOCShortCircuit?: boolean;
    signalIceConnected?: any;
    performTieBreak?: (session: BaseSession, jingle: Jingle) => boolean;
  }

  export default class SessionManager extends WildEmitter {
    jid: string;
    selfID: string;
    sessions: {
      [key: string]: BaseSession;
    }; // TODO: type this
    peers: {
      [key: string]: PeerConnection[];
    }; // TODO: type this
    prepareSession: MediaSession;
    performTieBreak: (session: MediaSession, jingle: Jingle) => boolean;
    screenSharingSupport: any; // TODO: type this -> webrtc.screenSharing
    capabilities: string[];
    config: SessionManagerConfig;
    iceServers: RTCIceServer[];

    constructor (config: SessionManagerConstructOpts);
    addICEServer (server: RTCIceServer | string): void;
    addSession (session: MediaSession): MediaSession;
    createMediaSession (peer: PeerConnection, sid: string, stream: MediaStream): MediaFileTransferSession;
    createFileTransferSession (peer: PeerConnection, sid: string): MediaSession;
    endPeerSessions (peer: PeerConnection, reason?: string, silent?: boolean): void;
    endAllSessions (reason?: string, silent?: boolean): void;
    _createIncomingSession (meta: any, jingle: Jingle): BaseSession; // TODO: what are these params?
    _sendError (to: string, id: string, data: any): void;
    _log (level: string, message: string): void;
    process (jingle: Jingle): void;


  }
}
