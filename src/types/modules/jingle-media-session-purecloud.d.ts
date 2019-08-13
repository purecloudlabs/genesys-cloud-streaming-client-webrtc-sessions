
declare module 'jingle-media-session-purecloud' {
  import BaseSession, { SessionError, BaseSessionConstructOpts } from 'jingle-session';
  import PeerConnection, { RTCConstraints } from 'rtcpeerconnection';

  export interface MediaSessionOptions extends BaseSessionConstructOpts {
    stream?: MediaStream;
    isInitiator?: boolean;
    initiator?: boolean;
    pendingApplicationTypes?: string[]; // opts.applicationTypes
    signalEndOfCandidates?: boolean;
    signalIceConnected?: boolean;
    disableEOCShortCircuit?: boolean;
    iceServers?: RTCIceServer[];
    iceTransportPolicy?: RTCIceTransportPolicy;
    allowIPv6?: boolean;
    constraints?: RTCConstraints;
  }

  export default class MediaSession extends BaseSession {

    lastNChannel: RTCDataChannel;
    pc: PeerConnection;
    ringing: boolean;
    lastCandidate: Jingle | null;
    readonly streams: MediaStream[];
    readonly tracks: MediaStreamTrack[];

    private _ringing: boolean;

    constructor (options: MediaSessionOptions);

    /* jingle-media-session-purecloud */
    start (offerOptions: any, next?: (() => void)): void;
    accept (optsOrNext?: { constraints: RTCOfferOptions } | (() => void), next?: (() => void)): void;
    end (reason: string | 'success', silent?: boolean): void;
    ring (): void;
    mute (creator: any, name: any): void;
    unmute (creator: any, name: any): void;
    hold (): void;
    resume (): void;
    findTransceiverForTrack (track: MediaStreamTrack, failIfNotFound?: boolean): RTCRtpTransceiver;
    addTrack (trackOrKind: MediaStreamTrack | string): RTCRtpSender;
    removeTrack (track: MediaStreamTrack): void;
    switchTrack (oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack | null): Promise<void>;
    addStream (stream: MediaStream, renegotiate?: RTCOfferOptions | boolean, cb?: ((err?: any) => void)): void;
    addStream2 (stream: MediaStream, cb?: (err?: any) => void): void;
    removeStream (stream: MediaStream, renegotiate?: RTCOfferOptions | boolean, cb?: ((err?: any) => void)): void;
    removeStream2 (stream: MediaStream, cb?: ((err?: any) => void)): void;
    switchStream (oldStream: MediaStream, newStream: MediaStream, cb?: ((err?: any) => void)): void;
    onIceCandidate (this: MediaSession, opts: MediaSessionOptions, candidate: Jingle): void;
    onIceEndOfCandidates (this: MediaSession, opts: MediaSessionOptions): void;
    onIceStateChange (this: MediaSession, opts: MediaSessionOptions): void;
    onAddTrack (this: MediaSession, event: RTCTrackEvent): void;
    onRemoveTrack (this: MediaSession, event: MediaStreamTrackEvent): void;
    onAddStream (this: MediaSession, event: MediaStreamEvent): void;
    onRemoveStream (this: MediaSession, event: MediaStreamEvent): void;

    onSessionInitiate (changes: Jingle, cb: ((err?: any) => void)): void;
    onSessionAccept (changes: Jingle, cb: ((err?: any) => void)): void;
    onSessionTerminate (changes: { reason: string }, cb: ((err?: any) => void)): void;
    onSessionInfo (info: { ringing: boolean, hold: boolean, active: boolean, mute: boolean, unmute: boolean }, cb: (() => void)): void;
    onTransportInfo (changes: any, cb: (() => void)): void;
    onSourceAdd (changes: Jingle, cb: (err?: SessionError) => void): void;
    onSourceRemove (changes: Jingle, cb: (err?: SessionError) => void): void;
    onAddChannel (channel: RTCDataChannel): void;
    // asdfasdfasdfasdf-adfave
    // left here

    // end (reason: string | 'success', silent: boolean): void; // overridden
    onSessionTerminate (changes: { reason: string }, cb: Function): void;
    onSessionInfo (changes: { reason: string }, cb: Function): void;
    onDescriptionInfo (changes: { reason: string }, cb: Function): void;
    onTransportInfo (changes: { reason: string }, cb: Function): void;
    onContentAdd (changes: { reason: string }, cb: Function): void;
    onTransportReplace (changes: { reason: string }, cb: Function): void;
  }
}
