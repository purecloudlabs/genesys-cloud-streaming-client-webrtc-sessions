'use strict';

const test = require('ava');
const sinon = require('sinon');

const {
  logger,
  guard
} = require('../../utils');

let sandbox;
test.beforeEach(() => {
  sandbox = sinon.sandbox.create();
  sandbox.stub(logger, 'debug');
  sandbox.stub(logger, 'warn');
  sandbox.stub(logger, 'error');
  sandbox.stub(logger, 'info');
});

test.afterEach(() => {
  sandbox.restore();
});

test('debug should print debug level information to the console', t => {
  logger.debug('I am some debugging information');
  t.is(logger.debug.called, true);
});

test('warn should print warning level information to the console', t => {
  logger.warn('A warning has been issued');
  t.is(logger.warn.called, true);
});

test('error should print error level information to the console', t => {
  logger.error('An error has been logged');
  t.is(logger.error.called, true);
});

test('info should print info level information to the console', t => {
  logger.info('An info level log has been issued');
  t.is(logger.info.called, true);
});

test('guard should return a value if there is a value and it is not null', t => {
  t.plan(2);
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
