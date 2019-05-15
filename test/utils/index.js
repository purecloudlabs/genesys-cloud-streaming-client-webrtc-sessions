'use strict';

class MockRTCPeerConnection {
  addEventListener () {}
  addStream () {}
  createOffer () { return Promise.resolve(); }
  setLocalDescription () {}
  setRemoteDescription () {}
  createAnswer () { return Promise.resolve(); }
  gatherStats () {}
  getStats () {
    return {
      then: () => {}
    };
  }
  gotStats () {}
  getRemoteStreams () {}
  createDataChannel () {
    return {
      onmessage: null,
      addEventListener: () => {}
    };
  }
  offer () {}
  getLocalStreams () {}
  onIceCandidate () {}
  onIceEndOfCandidates () {}
  onIceStateChange () {}
}
module.exports = {
  MockRTCPeerConnection,
  MockMediaSession: function () {}
};
