declare module 'jingle-purecloud' {
  import WildEmitter from 'wildemitter';
  import MediaSession, { PCMediaSessionConstructOptions } from 'jingle-media-session-purecloud';

  interface Req {
    jingle: {
      sid: string;
      contents: string[]; // TODO: this may be duplicated
    }
  }

  interface PCSessionManagerConfig {
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

  interface PCSessionManagerConstructOptions {
    jid?: string | { full: string }; // TODO: type this better
    selfID?: string;
    applcationTypes?: 'rtp' | 'filetransfer' | string;
    prepareSession?: (options: PCMediaSessionConstructOptions) => MediaSession;
    iceServers?: RTCIceServer[];
    iceTransportPolicy?: RTCIceTransportPolicy;
    disableEOCShortCircuit?: boolean;
    signalIceConnected?: any;
    performTieBreak?: (session: MediaSession, req: Req) => boolean;
  }

  export default class SessionManager extends WildEmitter {
    jid: string;
    selfID: string;
    sessions: {
      [key: string]: MediaSession;
    }; // TODO: type this
    peers: {
      [key: string]: MediaSession[]; // TODO: type this
    }; // TODO: type this
    prepareSession: MediaSession;
    performTieBreak: (session: MediaSession, req: Req) => boolean;
    screenSharingSupport: any; // TODO: type this -> webrtc.screenSharing
    capabilities: string[];
    config: PCSessionManagerConfig;
    iceServers: RTCIceServer[];


    constructor (conf: PCSessionManagerConstructOptions);
    addICEServer (server: RTCIceServer | string): void;
    addSession (session: MediaSession): MediaSession;
    createMediaSession (peer: MediaSession, sid: string, stream: MediaStream): MediaSession; // TODO: make sure peer is correct
    createFileTransferSession (peer: MediaSession, sid: string): MediaSession;
    endPeerSessions (peer: MediaSession, reason?: string, silent?: boolean): void;
    endAllSessions (reason?: string, silent?: boolean): void;
    _createIncomingSession (meta: any, req: Req): MediaSession; // TODO: what are these params?
    _sendError (to: string, id: string, data: any): void;
    _log (level: string, message: string): void;
    process (req: Req): void;


  }
}
