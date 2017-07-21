'use strict';

const test = require('ava');

test('bareJid should return the bareJid', t => {
  const stanzaio = {
    jid: {
      bare: String.prototype.toString.call('user@example.com')
    }
  };
  const bareJid = require('../../utils').bareJid;
  const actual = bareJid(stanzaio);
  const expected = 'user@example.com';
  t.is(actual, expected);
});

test('guard should return undefined if value is undefined', t => {
  const guard = require('../../utils').guard;
  const actual = guard(undefined);
  const expected = undefined;
  t.is(actual, expected);
});

test('guard should return a value if there is a value and it is not null', t => {
  t.plan(2);
  const guard = require('../../utils').guard;
  const actual = guard(
    {
      jid: 'myuniquejid@somebody.com'
    },
    v => v
  );
  const expected = {
    jid: 'myuniquejid@somebody.com'
  };
  t.deepEqual(actual, expected);

  const actual2 = guard(
    {
      data: '1234abvdffd@@55555555'
    },
    d => d.data
  );
  const expected2 = '1234abvdffd@@55555555';
  t.is(actual2, expected2);
});
