'use strict';

const logger = {
  debug: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console)
};

function guard (value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}

module.exports = {
  logger,
  guard
};
