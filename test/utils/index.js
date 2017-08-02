'use strict';

function MockRTCPeerConnection () {
  const ZombieRTCPeerConnection = require('../../node_modules/zombese/lib/webrtc/ZombieRTCPeerConnection.js');
  return new ZombieRTCPeerConnection();
}

function MockMediaSession () {
  const ZombieRTCPeerConnection = require('../../node_modules/zombese/lib/webrtc/ZombieRTCPeerConnection.js');
  class MyMediaSession extends ZombieRTCPeerConnection {}
  return new MyMediaSession();
}

module.exports = {
  MockRTCPeerConnection,
  MockMediaSession
};
