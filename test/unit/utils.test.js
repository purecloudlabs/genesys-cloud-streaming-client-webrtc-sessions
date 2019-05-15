'use strict';

const test = require('ava');
const sinon = require('sinon');
let sandbox;

const {
  logger
} = require('../../utils');

test.before(() => {
  sandbox = sinon.createSandbox();
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
