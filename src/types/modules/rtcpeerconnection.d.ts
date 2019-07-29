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

  interface Update {
    contents?: any;
    jingle?: Jingle;
    candidate?: RTCIceCandidateInit;
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
    localDescription: Jingle;
    remoteDescription: Jingle;
    config: {
      debug: boolean;
      sid: string;
      isInitiator: boolean;
      sdpSessionID: Date;
      useJingle: boolean;
      bundlePolicy?: string | 'max-bundle';
      rtcpMuxPolicy?: string | 'required';
      [key: string]: any;
    };
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
    _remoteDataChannels: RTCDataChannel[];
    _localDataChannels: RTCDataChannel[];
    _candidateBuffer: any[];
    localStream: MediaStream;

    readonly signalingState: RTCSignalingState;
    readonly iceConnectionState: RTCIceConnectionState;

    constructor (config: any, constraints: any);
    getLocalStreams (): MediaStream[];
    getRoles (): RTCRtpSender[];
    getRemoteStreams (): MediaStream[];
    getReceivers (): RTCRtpReceiver[];
    addStream (stream: MediaStream): void;
    removeStream (stream: MediaStream): void;
    removeTrack (track: MediaStreamTrack): void;
    processIce (update: Update, cb?: (() => void)): void;
    offer (constraints: RTCOfferOptions, cb?: ((err?: string | null, expendedOffer?: JingleAnswerOffer) => void)): void;
    handleOffer (offer: JingleAnswerOffer, cb?: (() => void)): void;
    answerAudioOnly (cd?: ((err?: any | null, response?: JingleAnswerOffer) => void)): void;
    answerBroadcastOnly (cd?: ((err?: any | null, response?: JingleAnswerOffer) => void)): void;
    answer (constraints: RTCAnswerOptions, cd?: ((err?: any | null, response?: JingleAnswerOffer) => void)): void;
    handleAnswer (answer: JingleAnswerOffer, cd?: ((err?: any | null, response?: JingleAnswerOffer) => void)): void; // fix this type (not Offer but Answer)
    createDataChannel (label: string, dataChannelDict?: RTCDataChannelInit): RTCDataChannel;
    getStats (selectorOrCallback?: MediaStreamTrack | ((err?: any, response?: RTCStatsReport) => void)): Promise<RTCStatsReport> | void;
    close (): void;

    on (name: 'removeStream', event: MediaStreamEvent): void;
    on (name: 'removeTrack', event: MediaStreamTrackEvent): void;
    on (name: 'addStream', event: MediaStreamEvent): void;
    on (name: 'negotiationNeeded', event: Event): void;
    on (name: 'iceConnectionStateChange', event: Event): void;
    on (name: 'signalingStateChange', event: Event): void;
    on (name: 'offer', event: JingleAnswerOffer): void;
    on (name: 'answer', event: JingleAnswerOffer): void;
    on (name: 'ice', event: Jingle): void;
    on (name: 'endOfCandidates'): void;
    on (name: 'addChannel', channel: RTCDataChannel): void;
    on (name: 'error', err?: any): void;
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
