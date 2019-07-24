import jingleStanza from 'jingle-stanza';

export default {
  jingleActionStanza: jingleStanza.getXml(
    {
      'jingle': {
        'action': 'session-initiate',
        'initiator': '+17408565809@gjoll.us-east-1.ininsca.com/i-1e9e4387',
        'sid': '7e0217a6-bb7c-4165-b07a-97a4b04225b8',
        'contents': [
          {
            'creator': 'initiator',
            'disposition': 'session',
            'name': 'audio',
            'senders': 'both',
            'application': {
              'applicationType': 'rtp',
              'media': 'audio',
              'mux': true,
              'payloads': [
                {
                  'channels': '2',
                  'clockrate': '48000',
                  'id': '96',
                  'name': 'opus',
                  'parameters': [
                    {
                      'key': 'minptime',
                      'value': '10'
                    },
                    {
                      'key': 'useinbandfec',
                      'value': '1'
                    }
                  ]
                },
                {
                  'clockrate': '48000',
                  'id': '101',
                  'name': 'telephone-event',
                  'parameters': [
                    {
                      'key': 'bitrate',
                      'value': '0'
                    }
                  ]
                }
              ]
            },
            'transport': {
              'transportType': 'iceUdp',
              'pwd': 'P62ia7epc3ZxbNRbfehstg+C',
              'ufrag': 'vv61TWnosYuaS02T',
              'fingerprints': [
                {
                  'hash': 'sha-256',
                  'setup': 'actpass',
                  'value': 'D1:84:C2:1C:9F:CE:9F:59:E7:6D:D0:A5:B6:0E:31:EB:34:9F:D6:38:EC:8B:30:51:13:2F:89:D4:20:E2:E6:BE'
                }
              ]
            }
          }
        ]
      },
      'id': '14',
      'to': '535ff640d210c22a6f58667a@inin.orgspan.com/emberchat-8248',
      'from': '+17408565809@gjoll.us-east-1.ininsca.com/i-1e9e4387',
      'type': 'set'
    }
  ),
  iceServersStanza: jingleStanza.getXml({
    'services': {
      'services': [
        {
          'host': 'somestun',
          'port': '3478',
          'transport': 'udp'
        },
        {
          'host': 'turnHost',
          'port': '3478',
          'transport': 'udp',
          'type': 'turn',
          'username': '1456358669:turnuser',
          'password': 'test'
        }
      ]
    },
    'id': '56ccf38d00001d1131d342e7',
    'to': 'someperson@example.org/client-1',
    'from': '',
    'type': 'result'
  }),
  jingleMessageInitStanza: jingleStanza.getMessageXml({
    'id': 'mmsageInit1',
    'from': 'romeo@montague.lit',
    'ofrom': 'o art thou',
    'to': 'juliet@capulet.com',
    'propose': {
      'id': 'proposeId1'
    }
  }),
  jingleMessageRetractStanza: jingleStanza.getMessageXml({
    'id': 'mmsageInit1',
    'from': 'romeo@montague.lit',
    'to': 'juliet@capulet.com',
    'retract': {
      'id': 'retractId1'
    }
  }),
  jingleMessageAcceptStanza: jingleStanza.getMessageXml({
    'id': 'mmsageInit1',
    'from': 'romeo@montague.lit',
    'to': 'juliet@capulet.com',
    'accept': {
      'id': 'acceptId1'
    }
  }),
  jingleMessageProceedStanza: jingleStanza.getMessageXml({
    'id': 'mmsageInit1',
    'from': 'romeo@montague.lit',
    'to': 'juliet@capulet.com',
    'proceed': {
      'id': 'proceedId1'
    }
  }),
  jingleMessageRejectStanza: jingleStanza.getMessageXml({
    'id': 'mmsageInit1',
    'from': 'romeo@montague.lit',
    'to': 'juliet@capulet.com',
    'reject': {
      'id': 'rejectId1'
    }
  }),
  upgradeErrorStanza: {
    '_name': 'presence',
    'type': 'error',
    'originalType': 'upgradeMedia',
    'to': 'turntostone@joewalsh.net',
    'from': 'rocknroll@conference.net'
  }
};
