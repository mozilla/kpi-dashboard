/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
convict = require('convict'),
fs = require('fs'),
path = require('path'),
urlparse = require('urlparse');

var conf = module.exports = convict({
  data_server: {
    host: 'string = "kpiggybank-stage.personatest.org"',
    port: 'integer = 443',
    path: 'string = "/wsapi/interaction_data"'
  },
  database_server: {
    host: 'string = "localhost"',
    port: 'integer = 5984',
    database: 'string = "kpi_dashboard"',
    username: 'string = "dashboard"',
    password: 'string = "dashboard"'
  },
  verification_server: {
    host: 'string = "verifier.login.persona.org"'
  },
  verification_audience: 'string?',
  client_sessions: {
    cookie_name: 'string = "session_state"',
    secret: 'string = "dashkpidashkpidashkpi"',
    duration: 'integer = 1209600000'
  },
  public_url: {
    doc: "The publically visible URL of the deployment",
    format: 'string = "https://login.persona.org"',
    env: 'PUBLIC_URL'
  },
  segmentations: {
    OS: 'array { string }* = [ "Windows 7", "Windows XP", "etc" ]',
    Browser: 'array { string }* = [ "Firefox", "Chrome", "MSIE", "etc" ]',
    Screen: 'array { string }* = [ "1024×768", "1680×1050", "etc"]',
    Emails: 'array { string }* = [ "0", "1", "2", "3+", "Unknown" ]',
    Locale: 'array { string }* = [ "en-us", "en-US" ]',
    API: 'array { string }* = [ "get", "watch" ]',
    EmailType: 'array { string }* = [ "IdP", "Fallback"]'
  },
  aliases: 'object { } * = {"Windows NT 6.1": "Windows 7"}',
  flows: 'object { } *',
  milestones: 'array { }*'
});

var dev_config_path = path.join(process.cwd(), 'config', 'local.json');

if (! process.env.CONFIG_FILES &&
    fs.existsSync(dev_config_path)) {
  process.env.CONFIG_FILES = dev_config_path;
}

// handle configuration files.  you can specify a CSV list of configuration
// files to process, which will be overlayed in order, in the CONFIG_FILES
// environment variable
if (process.env.CONFIG_FILES) {
  var files = process.env.CONFIG_FILES.split(',');
  files.forEach(function(file) {
    var c = JSON.parse(fs.readFileSync(file, 'utf8'));
    conf.load(c);
  });
}

// Want a port # in the verification url? override in local.json
if (!conf.has('verification_audience')) {
  conf.set('verification_audience', urlparse(conf.get('public_url')).host);
}

// validate the configuration based on the above specification
conf.validate();
