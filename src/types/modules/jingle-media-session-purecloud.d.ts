
declare module 'jingle-media-session-purecloud' {
  import WildEmitter from 'wildemitter';
  import SessionManager from 'jingle-purecloud';

  type SessionState = 'starting' | 'pending' | 'active' | 'ended';
  type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'interrupted';

  type AllowedActions =
    'session-inititate' |
    'session-accept' |
    'content-add' |
    'content-remove' |
    'content-reject' |
    'content-accept' |
    'content-modify' |
    'transport-replace' |
    'transport-reject' |
    'transport-accept' |
    'source-add' |
    'source-remove';

  export interface PCMediaSessionConstructOptions {
    stream?: MediaStream;
    sid?: string;
    peerID?: any; // opts.peerID || this.peer.full || this.peer;
    isInitiator?: boolean;
    initiator?: boolean;
    parent?: MediaSession; // opts.parent
    pendingApplicationTypes?: string[]; // opts.applicationTypes
    applicationTypes?: string[];
    iceTransportPolicy?: RTCIceTransportPolicy;
    signalEndOfCandidates: boolean;
    signalIceConnected: boolean;
    disableEOCShortCircuit: boolean;
    iceServers?: RTCIceServer[];
    allowIPv6?: boolean;
  }

  export default class MediaSession extends WildEmitter {
    /* jingle-session */
    sid: string;
    peer: any;
    peerID: any;
    isInitiator: boolean; //default false
    parent: SessionManager;
    state: SessionState; // default = 'starting';
    connectionState: string; // default = 'starting';
    processinQueue: any; // function
    pendingAction: AllowedActions | boolean;
    pendingApplicationTypes: string[];
    lastNChannel: RTCDataChannel;
    readonly starting: boolean;
    readonly pending: boolean;
    readonly active: boolean;
    readonly ended: boolean;
    readonly connected: boolean;
    readonly connecting: boolean;
    readonly disconnected: boolean;
    readonly interrupted: boolean;
    _sessionState: SessionState;
    _connectionState: SessionState;

    /* jingle-media-session-purecloud */
    pc: { isInitiator: boolean } & any; // RTCPeerConnection // TODO: type this
    _ringing: boolean;
    ringing: boolean;
    readonly streams: MediaStream[];
    readonly tracks: MediaStreamTrack[];

    constructor (options: PCMediaSessionConstructOptions);

    /* jingle-media-session-purecloud */
    start (offerOptions: any, next?: (() => void)): void;
    accept (opts?: { constraints: RTCOfferOptions } | (() => void), next?: (() => void)): void;
    end (reason: string | 'success', silent?: boolean): void;
    ring (): void;
    mute (creator: any, name: any): void;
    unmute (creator: any, name: any): void;
    hold (): void;
    resume (): void;
    findTransceiverForTrack (track: MediaStreamTrack, failIfNotFound: boolean): any; // transeiver from this.pc.pc.getTransceivers().find
    addTrack (trackOfKind: MediaStreamTrack | string): any; // this.pc.pc.addTrack(trackOrKind); OR this.pc.pc.getTransceivers().find(...).sender.replaceTrack();
    removeTrack (track: MediaStreamTrack): any; // transceiver.sender.replaceTrack(newTrack);
    switchTrack (oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack | null): any; // transceiver.sender.replaceTrack(newTrack);
    addStream (stream: MediaStream, renegotiate?: RTCOfferOptions | boolean, cb?: ((err?: any) => void)): void;
    addStream2 (stream: MediaStream, cb?: ((err?: any) => void)): void;
    removeStream (stream: MediaStream, renegotiate?: RTCOfferOptions | boolean, cb?: ((err?: any) => void)): void;
    removeStream2 (stream: MediaStream, cb?: ((err?: any) => void)): void;
    switchStream (oldStream: MediaStream, newStream: MediaStream, cb?: ((err?: any) => void)): void;
    onIceCandidate (opts: any, candidate: any): void; // TODO: type this better. Comes from pc.on('ice');
    onIceCandidate (this: MediaSession, ...args: any[]): void;
    onIceEndOfCandidates (opts: any): void;
    onIceStateChange (opts: any): void;
    onAddTrack (event: { track: MediaStreamTrack }): void;
    onRemoveTrack (event: { track: MediaStreamTrack }): void;
    onIceStateChange (opts: any): void;
    onAddStream (event: { track: MediaStream }): void;
    onRemoveStream (event: { track: MediaStream }): void;
    onSessionInitiate (changes: any, cb: ((err?: any) => void)): void;
    onSessionAccept (changes: any, cb: ((err?: any) => void)): void;
    onSessionTerminate (changes: { reason: string }, cb: ((err?: any) => void)): void;
    onSessionInfo (info: { ringing: boolean, hold: boolean, active: boolean, mute: boolean, unmute: boolean }, cb: (() => void)): void;
    onTransportInfo (changes: any, cb: (() => void)): void;
    onSourceAdd (changes: { contents: Array<{ name: string, application: { sources?: string[] } }> }, cb: ((err?: { condition: string }) => void)): void;
    onSourceRemove (changes: { contents: Array<{ name: string, application: { sources?: string[] } }> }, cb: ((err?: { condition: string }) => void)): void;
    onAddChannel (channel: RTCDataChannel): void;

    /* jingle-session */
    _log (level: string, message: string): void;
    send (action: string, data: any): void;
    process (action: string, changes: any, cb: Function): void;
    // start (): void; // overridden
    accept (): void;
    cancel (): void;
    decline (): void;
    // end (reason: string | 'success', silent: boolean): void; // overridden
    onSessionTerminate (changes: { reason: string }, cb: Function): void;
    onSessionInfo (changes: { reason: string }, cb: Function): void;
    onDescriptionInfo (changes: { reason: string }, cb: Function): void;
    onTransportInfo (changes: { reason: string }, cb: Function): void;
    onContentAdd (changes: { reason: string }, cb: Function): void;
    onTransportReplace (changes: { reason: string }, cb: Function): void;
  }
}
