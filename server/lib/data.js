"use strict";

var config = require('./configuration'),
    util = require('./util'),
    querystring = require('querystring'),
    https = require('https');

/**
 * Reads data from kpiggybank, using location from config file.
 * @param {string} start timestamp (in milliseconds) of
 *   earliest acceptable data point or null if any start time
 *   is acceptable
 * @param {string} end timestamp (in milliseconds) of latest
 *   acceptable data point or null if any end time is acceptable
 * @param {function} callback function that will be callled with the data
 */
exports.getData = function(options, callback) {
  var dataConfig = config.get('data_server');
  var params = {
    host: dataConfig.get('host'),
    port: dataConfig.get('port'),
    path: dataConfig.get('path') + "?" + querystring.stringify(options)
  };

  https.get(params, function(res) {
      res.setEncoding('utf8');
      var body = '';
      res.on('data', function(chunk) {
          body += chunk;
      });
      res.on('end', function() {
          callback(JSON.parse(body));
      });
  }).on('error', function(e) {
      throw(e);
  });
};

/**
 * Given a data point, returns its timestamp (in seconds)
 * @param {Object} datum data point to extract information from
 * @return {Integer} seconds since epoch
 */
exports.getTimestamp = function(datum) {
  // XXX: kpiggybank has timestamps in milliseconds, so convert them to seconds.
  // If we fix that, this will need to change. See mozilla/browserid/issues/1732
  return Math.floor(datum.value.timestamp / 1000);
};

/**
 * Returns the date of the given data point, in the format YYYY-MM-DD
 */
exports.getDate = function(datum) {
    return util.getDateStringFromUnixTime(exports.getTimestamp(datum));
};

/**
 * Given a data point, returns number of sites logged in
 * @param {Object} datum data point to extract information from
 * @return {Integer} number of sites logged in, or 0 if this field is missing
 */
exports.getNumberSitesLoggedIn = function(datum) {
    return datum.value.number_sites_logged_in || 0;
};

/**
 * Returns the various segmentations of the data, loaded from the config file.
 * @return {Object} of the form
 *     { <segmentation>: [<segment>, <segment>, ...], ...}
 *     e.g., { "Browser": [ "Firefox", "Chrome", "MSIE", "Safari" ] }
 * TODO: eventually, we'll probably want to generate these based on the data
 *     (e.g., find and return the top 5 for each category)
 */
exports.getSegmentations = function() {
    if(config.get('segmentations')) {
      return config.get('segmentations');
    } else {
      throw new Error('segmentations not yet loaded');
    }
};

/**
 * Given a data point, returns the value of the given metric.
 *     Acceptable metrics are those for which we have segmentations.
 * @param {String} metric the name of the metric
 * @param {Object} datum data point to extract information from
 * @return the desired value or null if it doesn't exist
 */
exports.getSegmentation = function(metric, datum) {
  var value = null;

  switch(metric) {
    case "OS":
      if('user_agent' in datum.value) value = datum.value.user_agent.os;
      break;
    case "Browser":
      if('user_agent' in datum.value) value = datum.value.user_agent.browser;
      break;
    case "Screen":
      if('screen_size' in datum.value && 'width' in datum.value.screen_size) {
        value = datum.value.screen_size.width + '×' +
                datum.value.screen_size.height;
      } else {
        value = "Unknown";
      }
      break;
    case "Emails":
      if('number_emails' in datum.value) {
        if(datum.value.number_emails < 3) {
          value = datum.value.number_emails.toString();
        } else if(datum.value.number_emails >= 3) {
          value = "3+";
        }
      } else {
        value = "Unknown";
      }
      break;
      case "Locale":
        value = datum.value.lang;
        break;
    }

    if(value !== null && value in config.get('aliases')) {
      value = config.get('aliases')[value];
    }

    return value;
};

/**
 * For given data point, returns value of given metric, if it is known
 *     (i.e., listed in the config file). Otherwise, returns "Other".
 * @see getSegmentation
 */
exports.getKnownSegmentation = function(metric, datum) {
    var segments = exports.getSegmentations()[metric];
    var segment = exports.getSegmentation(metric, datum);
    return segments.indexOf(segment) === -1 ? 'Other' : segment;
};

/**
 * Given a data point, returns a list of [only the] names of
 * all events it contains.
 */
function eventList(datum) {
    return datum.value.event_stream.map(function(eventPair) {
        return eventPair[0];
    });
}

/**
 * Returns the names of all steps in the new user flow that were completed
 *     in the given data point.
 */
exports.newUserSteps = function(datum) {
    var steps = [];
    var events = eventList(datum);

    if(events.indexOf('screen.set_password') === -1) { // not a new user
        return steps;
    }

    config.get('flows').new_user.forEach(function(step) {
        if(events.indexOf(step[1]) !== -1) {
            steps.push(step[0]);
        }
    });

    return steps;
};

/** Returns the names of all steps in the new user flow */
exports.newUserStepNames = function() {
    return config.get('flows').new_user.map(function(step) {
        return step[0];
    });
};

/**
 * Returns the names of all steps in the password reset flow that were completed
 *     in the given data point.
 */
exports.passwordResetSteps = function(datum) {
    var steps = [];
    var events = eventList(datum);

    if(events.indexOf('screen.reset_password') === -1) { // not a password reset
        return steps;
    }

    config.get('flows').password_reset.forEach(function(step) {
        if(events.indexOf(step[1]) !== -1) {
            steps.push(step[0]);
        }
    });

    return steps;
};

/** Returns the names of all steps in the password reset flow */
exports.passwordResetStepNames = function() {
    return config.get('flows').password_reset.map(function(step) {
        return step[0];
    });
};
