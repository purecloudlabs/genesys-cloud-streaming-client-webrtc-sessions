export function MockRTCPeerConnection () {
  const RTCPeerConnection = function () {
    return {
      addEventListener: () => { },
      addStream: () => { },
      createOffer: () => Promise.resolve({ sdp: '' }),
      setLocalDescription: () => Promise.resolve(),
      setRemoteDescription: () => Promise.resolve(),
      createAnswer: () => Promise.resolve(),
      gatherStats: () => { },
      getStats: () => {
        return {
          then: () => { }
        };
      },
      gotStats: () => { },
      getRemoteStreams: () => { },
      createDataChannel: () => {
        return {
          onmessage: null,
          addEventListener: () => { }
        };
      },
      offer: () => { },
      getLocalStreams: function () { },
      onIceCandidate: function () { },
      onIceEndOfCandidates: function () { },
      onIceStateChange: function () { }
    };
  };
  return RTCPeerConnection;
}

export function MockMediaSession () {
  const MyMediaSession = function () { };
  return new MyMediaSession();
}

export function timeout (ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
