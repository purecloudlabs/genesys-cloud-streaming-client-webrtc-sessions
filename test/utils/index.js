'use strict';

function MockRTCPeerConnection () {
  const RTCPeerConnection = function () {
    return {
      addEventListener: () => {},
      addStream: () => {},
      createOffer: () => Promise.resolve(),
      setLocalDescription: () => {},
      setRemoteDescription: () => {},
      createAnswer: () => Promise.resolve(),
      gatherStats: () => {},
      getStats: () => {
        return {
          then: () => {}
        };
      },
      gotStats: () => {},
      getRemoteStreams: () => {},
      createDataChannel: () => {
        return {
          onmessage: null,
          addEventListener: () => {}
        };
      },
      offer: () => {},
      getLocalStreams: function () {},
      onIceCandidate: function () {},
      onIceEndOfCandidates: function () {},
      onIceStateChange: function () {}
    };
  };
  return RTCPeerConnection;
}

function MockMediaSession () {
  const MyMediaSession = function () {};
  return new MyMediaSession();
}

module.exports = {
  MockRTCPeerConnection,
  MockMediaSession
};
