'use strict';

const fs = require('fs');
var jxt = require('jxt').createRegistry();

jxt.use(require('jxt-xmpp-types'));
jxt.use(require('jxt-xmpp'));

const formXML = fs.readFileSync(`${__dirname}/dataform.xml`);
const DataForm = jxt.getDefinition('x', 'jabber:x:data');

module.exports = {
  stanzas: jxt.parse(formXML, DataForm).toJSON()
};
