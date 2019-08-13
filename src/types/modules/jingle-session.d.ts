
declare module 'jingle-session' {
  import WildEmitter from 'wildemitter';
  import SessionManager from 'jingle-purecloud';
  import MediaSession from 'jingle-media-session-purecloud';
  import PeerConnection from 'rtcpeerconnection';
  import async from 'async';

  export interface BaseSessionConstructOpts {
    sid?: string;
    peer?: PeerConnection;
    peerID?: string | unknown;
    initiator?: boolean;
    parent?: MediaSession;
    applicationTypes?: string[];
  }

  interface SendData {
    sid?: string;
    action?: Actions;
    reason?: {
      condition?: string;
      text?: string;
    }
    [key: string]: unknown;
  }
  interface SessionError {
    condition: string;
    type?: string;
    jingleCondition?: string;
  }
  type SessionState = 'starting' | 'pending' | 'active' | 'ended';
  type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'interrupted';
  type Actions =
    'content-accept' |
    'content-add' |
    'content-modify' |
    'content-reject' |
    'content-remove' |
    'description-info' |
    'security-info' |
    'session-accept' |
    'session-info' |
    'session-initiate' |
    'session-terminate' |
    'transport-accept' |
    'transport-info' |
    'transport-reject' |
    'transport-replace' |
    'source-add' |
    'source-remove';
  type ResultsCallback = (err?: SessionError, result?: any) => void;

  export default class BaseSession extends WildEmitter {

    sid: string;
    peer: unknown;
    peerID: string | unknown;
    parent: SessionManager;
    isInitiator: boolean;
    state: SessionState;
    connectionState: ConnectionState;
    pendingAction: Actions | false;
    pendingApplicationTypes: string[];
    processingQueue: async.AsyncQueue<{ action: Actions, changes: Jingle, cb: ResultsCallback }>;

    readonly starting: boolean;
    readonly pending: boolean;
    readonly active: boolean;
    readonly ended: boolean;
    readonly connected: boolean;
    readonly connecting: boolean;
    readonly disconnected: boolean;
    readonly interrupted: boolean;

    private _sessionState: SessionState;
    private _connectionState: ConnectionState;

    constructor (options: BaseSessionConstructOpts);

    _log (level: LoggerMethods, ...args: any[]): void;
    send (action: Actions, data?: SendData): void;
    process (action: Actions, changes: Jingle, cb: ResultsCallback): void;
    start (...args: any[]): void; /* must be overriden */
    accept (): void;
    cancel (): void;
    end (reason?: string, silent?: boolean): void;
    onSessionTerminate (changes: Jingle, callback: (err?: SessionError, results?: any) => void): void;
    onSessionInfo (changes: Jingle, callback: (err?: SessionError, results?: any) => void): void;

    /* these are available action functions, but must be overridden by the extending clas */
    onContentAccept (changes: Jingle, callback: (err?: SessionError, results?: any) => void): void;
    onContentAdd (changes: Jingle, callback: (err?: SessionError, results?: any) => void): void;
    onContentModify (changes: Jingle, callback: (err?: SessionError, results?: any) => void): void;
    onContentReject (changes: Jingle, callback: (err?: SessionError, results?: any) => void): void;
    onContentRemove (changes: Jingle, callback: (err?: SessionError, results?: any) => void): void;
    onDescriptionInfo (changes: Jingle, callback: (err?: SessionError, results?: any) => void): void;
    onSecurityInfo (changes: Jingle, callback: (err?: SessionError, results?: any) => void): void;
    onSessionAccept (changes: Jingle, callback: (err?: SessionError, results?: any) => void): void;
    onSessionInitiate (changes: Jingle, callback: (err?: SessionError, results?: any) => void): void;
    onTransportAccept (changes: Jingle, callback: (err?: SessionError, results?: any) => void): void;
    onTransportInfo (changes: Jingle, callback: (err?: SessionError, results?: any) => void): void;
    onTransportReject (changes: Jingle, callback: (err?: SessionError, results?: any) => void): void;
    onTransportReplace (changes: Jingle, callback: (err?: SessionError, results?: any) => void): void;
    onSourceAdd (changes: Jingle, callback: (err?: SessionError, results?: any) => void): void;
    onSourceRemove (changes: Jingle, callback: (err?: SessionError, results?: any) => void): void;
  }
}
