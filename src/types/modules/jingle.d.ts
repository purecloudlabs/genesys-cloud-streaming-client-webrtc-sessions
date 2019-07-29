type JingleRoles = 'initiator' | 'responder';
type JingleDirections = 'outgoing' | 'incoming';
type JingleSenders = 'sendonly' | 'recvonly' | 'sendrecv' | 'inactive' | 'responder' | 'initiator' | 'both' | 'none';
type JingleApplicationType = 'rtp' | 'datachannel' | string;

interface Jingle {
  sid?: string;
  sdp?: string;
  name?: string;
  contents: JingleContent[];
}

interface JingleAnswerOffer {
  type: 'offer' | 'answer';
  sdp: string;
  jingle: Jingle;
}

interface JingleContent {
  name: 'video' | string;
  creator?: string;
  senders?: JingleSenders;
  transport?: JingleTransport;
  application?: JingleApplication;
}

interface JingleTransport {
  transportType: 'iceUdp' | string;
  fingerprints: {
    hash: string;
    value: string;
    setup?: string;
  }[];
  ufrag?: string;
  pwd?: string;
  sctp?: {
    number: string;
    protocol: string;
    streams: string;
  }[];
  candidates?: JingleIceCandidate[];
}

interface JingleIceCandidate extends RTCIceCandidate {
  generation: string;
  id?: string;
}

interface JingleApplication {
  applicationType?: JingleApplicationType;
  media?: string;
  googConferenceFlag?: boolean;
  mux?: boolean;
  rsize?: boolean;
  feedback?: JingleFeedback[];
  headerExtensions?: {
    id: string;
    senders: JingleSenders;
    uri: string;
  }[];
  encryption?: {
    tag: string;
    cipherSuite: string;
    keyParams: string;
    sessionParams: string;
  }[];
  payloads?: {
    id: string;
    name: string;
    clockrate?: string;
    channels?: string;
    parameters: KeyValue<string>[];
    feedback: JingleFeedback[];
  }[];
  bandwidth?: {
    type: string | 'AS';
    bandwidth: string | number;
  };
  sources?: JingleSource[];
  sourceGroups?: {
    semantices: string;
    sources: JingleSource[];
  }[];
}

interface JingleFeedback {
  id: string;
  type: string;
  value: string;
  subtype: string;
  parameters: string;
}

interface JingleSource {
  ssrc: string;
  parameters?: KeyValue<string | number>[];
}
