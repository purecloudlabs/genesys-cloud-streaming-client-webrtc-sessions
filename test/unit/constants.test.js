'use strict';

const test = require('ava');

test('events object should render proper labels', t => {
  t.plan(14);
  let events = require('../../constants').exposeWebrtcEvents.events;
  events = Object.keys(events).map((event, index) => {
    return {
      event: events[event]
    };
  });

  const eventLabels = [
    'requestWebrtcDump',
    'requestIncomingRtcSession',
    'cancelIncomingRtcSession',
    'handledIncomingRtcSession',
    'outgoingRtcSessionProceed',
    'outgoingRtcSessionRejected',
    'rtcIceServers',
    'incomingRtcSession',
    'outgoingRtcSession',
    'rtcSessionError',
    'traceRtcSession',
    'upgradeMediaError',
    'updateMediaPresence',
    'lastNChange'
  ];

  events.forEach((value, index, array) => {
    t.is(value.event, eventLabels[index]);
  });
});

test('labels object should render proper labels', t => {
  t.plan(1);
  let labels = require('../../constants').exposeWebrtcEvents.labels;
  labels = Object.keys(labels).map(label => {
    return {
      indicatorLabel: labels[label]
    };
  });

  const indicatorLabels = [
    'success'
  ];

  labels.forEach((value, index, array) => {
    t.is(value.indicatorLabel, indicatorLabels[index]);
  });
});

test('stanzaEvents should render proper events', t => {
  t.plan(7);
  let stanzaEvents = require('../../constants').exposeWebrtcEvents.stanzaEvents;
  stanzaEvents = Object.keys(stanzaEvents).map(event => {
    return {
      event: stanzaEvents[event]
    };
  });
  const eventLabels = [
    'services',
    'propose',
    'retract',
    'accept',
    'proceed',
    'reject',
    'urn:xmpp:jingle-message:0'
  ];
  stanzaEvents.forEach((value, index, array) => {
    t.is(value.event, eventLabels[index]);
  });
});

test('stanzaTypes should render proper types', t => {
  t.plan(3);
  let stanzaTypes = require('../../constants').exposeWebrtcEvents.stanzaTypes;
  stanzaTypes = Object.keys(stanzaTypes).map(type => {
    return {
      types: stanzaTypes[type]
    };
  });
  const typeLabels = [
    'iq',
    'message',
    'presence'
  ];
  stanzaTypes.forEach((value, index, array) => {
    t.is(value.types, typeLabels[index]);
  });
});
