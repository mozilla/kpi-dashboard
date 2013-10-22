"use strict";

var config = require('./configuration'),
data = require('./data');
var cradle = require('cradle');

var dbConfig = config.get('database_server');
var conn = new (cradle.Connection)(dbConfig.host, dbConfig.port, {
  auth: {
    username: dbConfig.username,
    password: dbConfig.password
  }
});

var db = conn.database(dbConfig.database);

/*** DATABASE STRUCTURE AND SETUP ***/

/** Name of the design document */
var NAME = 'data';

/** Views used to access data */
var VIEWS = {
  password_reset: {
    map: function(doc) {
      if(doc.passwordResetSteps.length > 0) {
        var steps = {};
        doc.passwordResetSteps.forEach(function(step) {
          steps[step] = 1;
        });
        emit(doc.date, steps);
      }
    },

    reduce: function(keys, values, rereduce) {
      return values.reduce(function(accumulated, current) {
        var steps = Object.keys(current);
        steps.forEach(function(step) {
          if(!accumulated.hasOwnProperty(step)) {
            accumulated[step] = 0;
          }

          accumulated[step] = accumulated[step] + current[step];
        });

        return accumulated;
      }, {});
    }
  },

  new_user: {
    map: function(doc) {
      if(doc.newUserSteps.length > 0) { // Only count new users
        var steps = {};
        doc.newUserSteps.forEach(function(step) {
          steps[step] = 1;
        });
        emit(doc.date, steps);
      }
    },

    reduce: function(keys, values, rereduce) {
      return values.reduce(function(accumulated, current) {
        var steps = Object.keys(current);
        steps.forEach(function(step) {
          if(!accumulated.hasOwnProperty(step)) {
            accumulated[step] = 0;
          }

          accumulated[step] = accumulated[step] + current[step];
        });

        return accumulated;
      }, {});
    }
  },

  assertions: {
    map: function(doc) {
      emit(doc.date, 1);
    },

    reduce: '_count'
  },

  sites: {
    map: function(doc) {
      emit(doc.date, doc.number_sites_logged_in);
    },

    reduce: '_stats'
  },

  general_progress: {
    map: function(doc) {
      if(doc.generalProgressSteps.length > 0) { // Only count new users
        var steps = {};
        doc.generalProgressSteps.forEach(function(step) {
          steps[step] = 1;
        });
        emit(doc.date, steps);
      }
    },

    reduce: function(keys, values, rereduce) {
      return values.reduce(function(accumulated, current) {
        var steps = Object.keys(current);
        steps.forEach(function(step) {
          if(!accumulated.hasOwnProperty(step)) {
            accumulated[step] = 0;
          }

          accumulated[step] = accumulated[step] + current[step];
        });

        return accumulated;
      }, {});
    }
  },
  
  new_user_bounce: {
    map: function(doc) {
      var events = doc.event_stream.map(function(eventPair) {
        return eventPair[0];
      });

      if (doc.generalProgressSteps.indexOf('1 - Dialog shown') !== -1) {
        if (doc.generalProgressSteps.indexOf('2 - User engaged') === -1) {
            emit(doc.date, {"assertion":0, "bounce":1, "fail":0, "fallback":0, "idp":0});
        } else if (events.indexOf('assertion_generated') !== -1 ) {
          if (doc.newUserSteps.length !== 0) {
        	emit(doc.date, {"assertion":0, "bounce":0, "fail":0, "fallback":1, "idp":0});
          } else if (doc.new_account && events.indexOf('screen.provision_primary_user') !== -1) {
            emit(doc.date, {"assertion":0, "bounce":0, "fail":0, "fallback":0, "idp":1});
          } else {
            emit(doc.date, {"assertion":1, "bounce":0, "fail":0, "fallback":0, "idp":0});
          }
        } else {
            emit(doc.date, {"assertion":0, "bounce":0, "fail":1, "fallback":0, "idp":0});
        }
      }
    },
    
    reduce: function (keys, values, rereduce) {         
      return values.reduce(function(accumulated, current) {
        var outcomes = Object.keys(current);
        outcomes.forEach(function(outcome) {
          accumulated[outcome] = accumulated[outcome] + current[outcome];
        });
        return accumulated;
      });
    }
  }
};

/** Initialize new user flow report */
(function() {
  /**
   * Returns a function, to be used in CouchDB to map data by the given
   * segmentation
   *
   *     The map-by-segmentation functions are identical, except for the
   *     segmentation being mapped. Because CouchDB doesn't support closures,
   *     we take the somewhat hacky approach of converting the function to a
   *     string (which was going to happen anyway) and replacing the name of the
   *     segmentation with the one we want.
   */
  var getMapBySegment = function(segmentation) {
    return function(doc) {
      if(doc.newUserSteps.length > 0) {

        var steps = {};
        doc.newUserSteps.forEach(function(step) {
          steps[step] = 1;
        });
        emit([doc.date, doc["---SEGMENTATION---"]], steps);
      }
    }.toString().replace('---SEGMENTATION---', segmentation);
  };

  /**
   * Reduce function to be used in CouchDB to aggregate segmented data
   */
  var reduceBySegment = function(keys, values, rereduce) {
    return values.reduce(function(accumulated, current) {
      var steps = Object.keys(current);
      steps.forEach(function(step) {
        if(!accumulated.hasOwnProperty(step)) {
          accumulated[step] = 0;
        }

        accumulated[step] = accumulated[step] + current[step];
      });

      return accumulated;
    }, {});
  };

  var segmentations = Object.keys(data.getSegmentations());
  segmentations.forEach(function(segmentation) {
    VIEWS['new_user_' + segmentation] = {
      map: getMapBySegment(segmentation),
      reduce: reduceBySegment
    };
  });
})();

/** Initialize assertions report */
(function() {
  var getMapBySegment = function(segmentation) {
    return function(doc) {
      emit(doc.date, doc["---SEGMENTATION---"]);
    }.toString().replace('---SEGMENTATION---', segmentation);
  };

  var reduceBySegment = function(keys, values, rereduce) {
    if(rereduce) {
      return values.reduce(function(accumulated, current) {
        var segments = Object.keys(current);
        segments.forEach(function(segment) {
          if(!accumulated.hasOwnProperty(segment)) {
            accumulated[segment] = 0;
          }

          accumulated[segment] = accumulated[segment] + current[segment];
        });

        return accumulated;
      }, {});
    } else {
      var segments = {};
      values.forEach(function(value) {
        if(!segments.hasOwnProperty(value)) {
          segments[value] = 0;
        }

        segments[value]++;
      });

      return segments;
    }
  };

  var segmentations = Object.keys(data.getSegmentations());
  segmentations.forEach(function(segmentation) {
    VIEWS['assertions_' + segmentation] = {
      map: getMapBySegment(segmentation),
      reduce: reduceBySegment
    };
  });
})();

/** Initialize sites report */
(function() {
  var getMapBySegment = function(segmentation) {
    return function(doc) {
      emit([doc.date, doc["---SEGMENTATION---"]], doc.number_sites_logged_in);
    }.toString().replace('---SEGMENTATION---', segmentation);

  };

  var segmentations = Object.keys(data.getSegmentations());
  segmentations.forEach(function(segmentation) {
    VIEWS['sites_' + segmentation] = {
      map: getMapBySegment(segmentation),
      reduce: '_stats'
    };
  });
})();

/** Initialize new user bounce report */
(function() {
  
  var getMapBySegment = function(segmentation) {
    return function(doc) {
      var events = doc.event_stream.map(function(eventPair) {
        return eventPair[0];
      });

      if (doc.generalProgressSteps.indexOf('1 - Dialog shown') !== -1) {
        if (doc.generalProgressSteps.indexOf('2 - User engaged') === -1) {
            emit([doc.date, doc["---SEGMENTATION---"]], {"assertion":0, "bounce":1, "fail":0, "fallback":0, "idp":0});
        } else if (events.indexOf('assertion_generated') !== -1 ) {
          if (doc.newUserSteps.length !== 0) {
        	emit([doc.date, doc["---SEGMENTATION---"]], {"assertion":0, "bounce":0, "fail":0, "fallback":1, "idp":0});
          } else if (doc.new_account && events.indexOf('screen.provision_primary_user') !== -1) {
            emit([doc.date, doc["---SEGMENTATION---"]], {"assertion":0, "bounce":0, "fail":0, "fallback":0, "idp":1});
          } else {
            emit([doc.date, doc["---SEGMENTATION---"]], {"assertion":1, "bounce":0, "fail":0, "fallback":0, "idp":0});
          }
        } else {
            emit([doc.date, doc["---SEGMENTATION---"]], {"assertion":0, "bounce":0, "fail":1, "fallback":0, "idp":0});
        }
      }
    }.toString().replace(new RegExp('---SEGMENTATION---', 'g'), segmentation);
  };

  var reduceBySegment = function(keys, values, rereduce) {        
    return values.reduce(function(accumulated, current) {
      var outcomes = Object.keys(current);
      outcomes.forEach(function(outcome) {
        accumulated[outcome] = accumulated[outcome] + current[outcome];
      });
      return accumulated;
    });
  };

  var segmentations = Object.keys(data.getSegmentations());
  segmentations.forEach(function(segmentation) {
    VIEWS['new_user_bounce_' + segmentation] = {
      map: getMapBySegment(segmentation),
      reduce: reduceBySegment
    };
  });
})();



/** Design document */
var DOCUMENT = {
  views: VIEWS
};

/**
 * Ensures the database exists and contains the proper views
 */
function initDatabase(callback) {
  db.exists(function(err, exists) {
    if(err) return callback(err);

    if(exists) {
      // Update the views stored in the database to the current version.
      // Does this regardless of the current state of the design document
      // (i.e., even if it is up-to-date).
      db.get('_design/' + NAME, function(err, doc) {
        if(err) return callback(err);

        db.save('_design/' + NAME, doc._rev, DOCUMENT, function(err, res) {
          if(err) return callback(err);

          callback();
        });
      });
    } else {
      // Create database and initialize views
      db.create(function(err) {
        db.save('_design/' + NAME, DOCUMENT, function(err) {
          if(err) return callback(err);

          callback();
        });
      });
    }
  });
}


// On load:
(function() {
  initDatabase(function(err) {
    if (err) {
      return console.log(
                "There was an error initializing the database" + String(err));
    }
    exports.db = db;
  });
})();


/*** DATABASE API ***/

/**
 * Populates the database with data
 */
exports.populateDatabase = function(options) {
  data.getData(options, function(rawData) {
    rawData.forEach(function(datum) {
      // Ignore blobs with empty event streams: they are the result of errors
      if(!datum.value.event_stream || datum.value.event_stream.length === 0) {
        return;
      }

      // Pre-compute certain values for the report (not already in the datum)
      datum.value.newUserSteps = data.newUserSteps(datum);
      datum.value.passwordResetSteps = data.passwordResetSteps(datum);
      datum.value.generalProgressSteps = data.generalProgressSteps(datum);
      datum.value.date = data.getDate(datum);

      // Handle all kinds of sites-logged-in KPIs
      datum.value.number_sites_logged_in = // Make sure there is *some* value.
      datum.value.number_sites_logged_in ||
        datum.value.sites_signed_in ||
        datum.value.number_sites_signed_in ||
        0;

      // including segmentations
      var segmentations = Object.keys(data.getSegmentations());
      segmentations.forEach(function(segmentation) {
        datum.value[segmentation] =
          data.getKnownSegmentation(segmentation, datum);
      });

      // Insert it into the database. Conveniently, it already has a UUID,
      // from the last time it was in CouchDB.
      db.save(datum.id, datum.value);
    });
  });
};

/**
 * Returns the results of a given view
 */
exports.view = function(view, params, callback) {
  db.view(NAME + '/' + view, params, function(err, res) {
    if(err) console.log(err);
    callback(JSON.parse(res));
  });
};
