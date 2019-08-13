type JingleRoles = 'initiator' | 'responder';
type JingleDirections = 'outgoing' | 'incoming';
type JingleSenders = 'sendonly' | 'recvonly' | 'sendrecv' | 'inactive' | 'responder' | 'initiator' | 'both' | 'none';
type JingleApplicationType = 'rtp' | 'datachannel' | string;

interface Jingle {
  sid?: string;
  sdp?: string;
  name?: string;
  action?: string;
  initiator?: boolean;
  responder?: string;
  reason?: string;
  contents?: JingleContent[];
  candidate?: RTCIceCandidateInit;
}

interface JingleAnswerOffer {
  type: 'offer' | 'answer';
  jingle: Jingle;
  sdp?: string;
}

// interface JingleChanges {
//   sid?: string;
//   action?: string;
//   initiator?: boolean;
//   responder?: string;
//   reason?: string;
//   contents?: JingleApplication[]
// }


interface JingleUpdate {
  contents?: any;
  jingle?: Jingle;
  candidate?: RTCIceCandidateInit;
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

interface JingleContent {
  name: 'video' | string;
  creator?: string;
  senders?: JingleSenders;
  transport?: JingleTransport;
  application?: JingleApplication;
}

interface JingleApplication {
  applicationType?: JingleApplicationType;
  media?: 'audio' | 'video' | string;
  googConferenceFlag?: boolean;
  mux?: boolean;
  rsize?: boolean;
  feedback?: JingleFeedback[];
  offer?: { hash?: { alog: string } }
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
    parameters: { [key: string]: string }[];
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
  parameters?: { [key: string]: string | number }[];
}
