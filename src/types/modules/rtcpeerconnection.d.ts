declare module 'rtcpeerconnection' {
  import WildEmitter from 'wildemitter';

  interface RTCConfig {
    iceServers?: RTCIceServer[];
    logger?: ILogger;
  }

  interface RTCConstraints {
    optional: any[];
    enableChromeNativeSimulcast: boolean;
    enableMultiStreamHacks: boolean;
    andyetRestrictBandwidth: number;
    andyetBatchIce: number;
    andyetFasterICE: boolean;
    andyetDontSignalCandidates: boolean;
    andyetAssumeSetLocalSuccess: boolean;
    andyetFirefoxMakesMeSad: number;
  }

  export interface PeerConnectionConfig {
    debug: boolean;
    sid: string;
    isInitiator: boolean;
    sdpSessionID: Date;
    useJingle: boolean;
    bundlePolicy?: string | 'max-bundle';
    rtcpMuxPolicy?: string | 'required';
    [key: string]: any;
  }

  export default class PeerConnection extends WildEmitter {
    enableChromeNativeSimulcast: boolean;
    enableMultiStreamHacks: boolean;
    restrictBandwidth: number;
    batchIceCandidates: number;
    batchedIceCandidates: Jingle[];
    eliminateDuplicateCandidates: boolean;
    dontSignalCandidates: boolean;
    assumeSetLocalSuccess: boolean;
    wtFirefox: number;
    firefoxcandidatebuffer: RTCIceCandidateInit[];
    pc: RTCPeerConnection;
    isInitiator: boolean;
    localDescription: Jingle;
    remoteDescription: Jingle;
    config: PeerConnectionConfig & RTCConfig;
    iceCredentials: {
      local: any;
      remote: any;
    };
    hadLocalStunCandidate: boolean;
    hadRemoteStunCandidate: boolean;
    hadLocalRelayCandidate: boolean;
    hadRemoteRelayCandidate: boolean;
    hadLocalIPv6Candidate: boolean;
    hadRemoteIPv6Candidate: boolean;
    localStream: MediaStream;
    private _remoteDataChannels: RTCDataChannel[];
    private _localDataChannels: RTCDataChannel[];
    private _candidateBuffer: any[];

    readonly signalingState: RTCSignalingState;
    readonly iceConnectionState: RTCIceConnectionState;

    constructor (config: PeerConnectionConfig, constraints: RTCConstraints);
    getLocalStreams (): MediaStream[];
    getRoles (): RTCRtpSender[];
    getRemoteStreams (): MediaStream[];
    getReceivers (): RTCRtpReceiver[];
    addStream (stream: MediaStream): void;
    removeStream (stream: MediaStream): void;
    removeTrack (track: MediaStreamTrack): void;
    processIce (update: JingleUpdate, cb?: (() => void)): void;
    offer (constraints: RTCOfferOptions, cb?: ((err?: string | null, expendedOffer?: JingleAnswerOffer) => void)): void;
    handleOffer (offer: JingleAnswerOffer, cb?: (() => void)): void;
    answerAudioOnly (cd?: ((err?: any | null, response?: JingleAnswerOffer) => void)): void;
    answerBroadcastOnly (cd?: ((err?: any | null, response?: JingleAnswerOffer) => void)): void;
    answer (constraints: RTCAnswerOptions, cd?: ((err?: any | null, response?: JingleAnswerOffer) => void)): void;
    handleAnswer (answer: JingleAnswerOffer, cd?: ((err?: any | null, response?: JingleAnswerOffer) => void)): void; // fix this type (not Offer but Answer)
    createDataChannel (label: string, dataChannelDict?: RTCDataChannelInit): RTCDataChannel;
    getStats (selectorOrCallback?: MediaStreamTrack | ((err?: any, response?: RTCStatsReport) => void)): Promise<RTCStatsReport> | void;
    close (): void;

    on (name: 'removeStream', callback: (event: MediaStreamEvent) => void): void;
    on (name: 'removeTrack', callback: (event: MediaStreamTrackEvent) => void): void;
    on (name: 'addStream', callback: (event: MediaStreamEvent) => void): void;
    on (name: 'addTrack', callback: (event: RTCTrackEvent) => void): void;
    on (name: 'negotiationNeeded', callback: (event: Event) => void): void;
    on (name: 'iceConnectionStateChange', callback: (event: Event) => void): void;
    on (name: 'signalingStateChange', callback: (event: Event) => void): void;
    on (name: 'offer', callback: (event: JingleAnswerOffer) => void): void;
    on (name: 'answer', callback: (event: JingleAnswerOffer) => void): void;
    on (name: 'ice', callback: (event: Jingle) => void): void;
    on (name: 'endOfCandidates'): void;
    on (name: 'addChannel', callback: (event: RTCDataChannel) => void): void;
    on (name: 'error', callback: (err?: any) => void): void;
    on (name: 'close'): void;
    on (name: string, ...args: any[]): void;

    _answer (constraints: RTCAnswerOptions, cb?: ((err?: any | null, response?: JingleAnswerOffer) => void)): void;
    _onIce (event: RTCPeerConnectionIceEvent): void;
    _onDataChannel (event: RTCDataChannelEvent): void;
    _role (): JingleRoles;
    _checkLocalCandidate (candidate: string): void;
    _checkRemoteCandidate (candidate: string): void;
  }
}
