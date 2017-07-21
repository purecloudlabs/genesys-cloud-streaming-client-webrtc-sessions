'use strict';

function bareJid (stanzaio) {
  return stanzaio.jid.bare;
}

function guard (value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}

exports.bareJid = bareJid;
exports.guard = guard;
