import constants from '../../src/constants';

describe('Constants', () => {
  test('events object should render proper labels', () => {
    expect.assertions(14);
    let events: any = constants.events;
    events = Object.keys(events).map((event: any) => {
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
      expect(value.event).toBe(eventLabels[index]);
    });
  });

  test('labels object should render proper labels', () => {
    expect.assertions(1);
    let labels: any = constants.labels;
    labels = Object.keys(labels).map(label => {
      return {
        indicatorLabel: labels[label]
      };
    });

    const indicatorLabels = [
      'success'
    ];

    labels.forEach((value, index, array) => {
      expect(value.indicatorLabel).toBe(indicatorLabels[index]);
    });
  });

  test('jingleEvents should render proper events', () => {
    expect.assertions(6);
    let jingleEvents: any = constants.jingleEvents;
    jingleEvents = Object.keys(jingleEvents).map(event => {
      return {
        event: jingleEvents[event]
      };
    });
    const eventLabels = [
      'services',
      'propose',
      'retract',
      'accept',
      'proceed',
      'reject'
    ];
    jingleEvents.forEach((value, index, array) => {
      expect(value.event).toBe(eventLabels[index]);
    });
  });

  test('stanzaTypes should render proper types', () => {
    expect.assertions(3);
    let stanzaTypes: any = constants.stanzaTypes;
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
      expect(value.types).toBe(typeLabels[index]);
    });
  });

  test('stanzaNamespaces should render proper labels', () => {
    expect.assertions(1);
    let stanzaNamespaces: any = constants.stanzaNamespaces;
    stanzaNamespaces = Object.keys(stanzaNamespaces).map(namespace => {
      return {
        types: stanzaNamespaces[namespace]
      };
    });
    const nameSpaceLabels = [
      'urn:xmpp:jingle-message:0'
    ];
    stanzaNamespaces.forEach((value, index, array) => {
      expect(value.types).toBe(nameSpaceLabels[index]);
    });
  });
});
