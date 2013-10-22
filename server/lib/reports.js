"use strict";

var config = require('./configuration'),
data = require('./data'),
db = require('./db'),
util = require('./util');

/**
 * Reports mean number of sites logged in
 * @param {String} segmentation segmentation type or null for none
 * @param {Integer} start Unix timestamp of start time or null for none
 * @param {Integer} end Unix timestamp of end time or null for none
 */
exports.sites = function(segmentation, start, end, callback) {
  var dbOptions = {
    group: true
  };

  if(segmentation) {
    if(start) {
      // Note that the key is in an array, and
      // we are omitting the second key (segment).
      dbOptions.startkey = [ util.getDateStringFromUnixTime(start) ];

    }
    if(end) {
      dbOptions.endkey = [ util.getDateStringFromUnixTime(end) ];
    }

    db.view('sites_' + segmentation, dbOptions, function(response) {
      var result = {};
      response.forEach(function(row) {
        var date = row.key[0],
        segment = row.key[1],
        mean = row.value.sum / row.value.count;

        if(! (segment in result)) {
          result[segment] = [];
        }

        result[segment].push({
          category: date,
          value: mean
        });
      });

      callback(result);
    });
  } else {
    if(start) {
      dbOptions.startkey = util.getDateStringFromUnixTime(start);
    }
    if(end) {
      dbOptions.endkey = util.getDateStringFromUnixTime(end);
    }

    db.view('sites', dbOptions, function(response) {
      var dates = [];
      response.forEach(function(row) {
        var stats = row.value;
        dates.push({
          category: row.key, // date
          value: stats.sum / stats.count // mean
        });
      });

      callback({ Total: dates });
    });
  }
};


/**
 * Reports total number of assertions generated
 * @param {String} segmentation segmentation type or null for none
 * @param {Integer} start Unix timestamp of start time or null for none
 * @param {Integer} end Unix timestamp of end time or null for none
 */
exports.assertions = function(segmentation, start, end, callback) {
  var dbOptions = {
    group: true
  };

  // Convert timestamps to dates
  if(start) {
    dbOptions.startkey = util.getDateStringFromUnixTime(start);
  }
  if(end) {
    dbOptions.endkey = util.getDateStringFromUnixTime(end);
  }

  if(segmentation) {
    db.view('assertions_' + segmentation, dbOptions, function(response) {
      var result = {};
      response.forEach(function(row) {
        var date = row.key;
        var segments = Object.keys(row.value);
        segments.forEach(function(segment) {
          if(! (segment in result)) {
            result[segment] = [];
          }

          result[segment].push({
            category: date,
            value: row.value[segment]
          });
        });
      });

      callback(result);
    });
  } else {
    db.view('assertions', dbOptions, function(response) {
      var result = { Total:
                     response.map(function(row) {
                       return { category: row.key, value: row.value };
                     })
                   };

      callback(result);
    });
  }
};

exports.new_user_success = function(segmentation, start, end, callback) {
  var dbOptions = {
    group: true
  };

  if(segmentation) {
    if(start) {
      // Note that the key is in an array, and
      // we are omitting the second key (segment).
      dbOptions.startkey = [ util.getDateStringFromUnixTime(start) ];
    }
    if(end) {
      dbOptions.endkey = [ util.getDateStringFromUnixTime(end) ];
    }

    db.view('new_user_success_' + segmentation, dbOptions, function(response) {
      var result = {};
      response.forEach(function(row) {
        var date = row.key[0],
        segment = row.key[1],
        mean = row.value.sum / row.value.count;

        if(! (segment in result)) {
          result[segment] = [];
        }

        result[segment].push({
          category: date,
          value: mean
        });
      });

      callback(result);
    });
  } else {
    if(start) {
      dbOptions.startkey = util.getDateStringFromUnixTime(start);
    }
    if(end) {
      dbOptions.endkey = util.getDateStringFromUnixTime(end);
    }

    db.view('new_user_success', dbOptions, function(response) {
      var dates = [];
      response.forEach(function(row) {
        var stats = row.value;
        dates.push({
          category: row.key, // date
          value: stats.sum / stats.count // mean
        });
      });

      callback({ Total: dates });
    });
  }
};

/**
 * Reports the number of users at each step in the sign-in flow for new users
 * @param {String} segmentation segmentation type or null for none
 * @param {Integer} start Unix timestamp of start time or null for none
 * @param {Integer} end Unix timestamp of end time or null for none
 */
exports.new_user = function(segmentation, start, end, callback) {

  if(segmentation) {
    var dbOptions = {
      group : true
    };
    
    // Convert timestamps to dates
    // We're indexing by both date and segmentation, filtering by just date
    if(start) {
      dbOptions.startkey = [util.getDateStringFromUnixTime(start)];
    }
    if(end) {
      dbOptions.endkey = [util.getDateStringFromUnixTime(end)];
    }
    
    db.view('new_user_' + segmentation, dbOptions, function(response) {      
      var result = {};
      response.forEach(function(row) {
        var segment = row.key[1];
        var steps = Object.keys(row.value);
        
        if (!(segment in result)) {
          result[segment] = {};
        }
        
        steps.forEach(function(step) {
          if (!(step in result[segment])) {
            result[segment][step] = row.value[step];
          } else {
            result[segment][step] += row.value[step];
          }
        });
      });
      callback(result);
    });
  } else {
    var dbOptions = {
      group : false
    };
    
    // Convert timestamps to dates
    if(start) {
      dbOptions.startkey = util.getDateStringFromUnixTime(start);
    }
    if(end) {
      dbOptions.endkey = util.getDateStringFromUnixTime(end);
    }
    
    dbOptions.group = false;
    
    db.view('new_user', dbOptions, function(response) {
      if(response.length !== 1) {
        console.log('Error: unexpected result from database', response);
        return;
      }

      var rawData = response[0];

      var steps = Object.keys(rawData.value);
      
      var totals = {};
      steps.forEach(function(step) {
        totals[step] = rawData.value[step];
      });
      
      var result = { Total: totals };

      callback(result);
    });
  }
};

exports.new_user_per_day = function(segmentation, start, end, callback) {
  var dbOptions = {
    group: true
  };
  
  if (segmentation) {
    if(start) {
      dbOptions.startkey = [ util.getDateStringFromUnixTime(start) ];
    }
    if(end) {
      dbOptions.endkey = [ util.getDateStringFromUnixTime(end) ];
    }
    
    db.view('new_user_bounce_' + segmentation, dbOptions, function(response) {
      var graph_data = {};
      
      response.forEach(function(row) {
        var date = row.key[0];
        var segment = row.key[1];
        
        if (!(segment in graph_data)) {
          graph_data[segment] = [];
        }
        
        graph_data[segment].push({
          category: date,
          value: row.value['idp'] + row.value['fallback']
        });
      });
      callback(graph_data);
    });
    
  } else {
    if(start) {
      dbOptions.startkey = util.getDateStringFromUnixTime(start);
    }
    if(end) {
      dbOptions.endkey = util.getDateStringFromUnixTime(end);
    }

    db.view('new_user_bounce', dbOptions, function(response) {
      var graph_data = [];
      response.forEach(function(row) {
        graph_data.push({
          category: row.key,
          value: row.value['idp'] + row.value['fallback']
        });
      });
      callback({ Total: graph_data });
    });
  }
};

/**
 * Reports fraction of users at each step in the new user flow, over time
 * @param {Integer} start Unix timestamp of start time or null for none
 * @param {Integer} end Unix timestamp of end time or null for none
 */
exports.new_user_time = function(start, end, callback) {
  var dbOptions = {
    group: true
  };

  // Convert timestamps to dates
  if(start) {
    dbOptions.startkey = util.getDateStringFromUnixTime(start);
  }
  if(end) {
    dbOptions.endkey = util.getDateStringFromUnixTime(end);
  }

  db.view('new_user', dbOptions, function(response) {

    // Set up container object
    var dataByStep = {};
    var steps = data.newUserStepNames();
    steps.forEach(function(step) {
      dataByStep[step] = {};
    });

    response.forEach(function(row) {
      var date = row.key;
      var total = row.value[steps[0]];
      steps.forEach(function(step) {
        if (step in row.value) {
          dataByStep[step][date] = row.value[step]/total;
        } else {
          dataByStep[step][date] = 0;
        }
      });
    });

    callback(dataByStep);
  });
};

exports.password_reset = function(start, end, callback) {
  var dbOptions = {
    group: true
  };

  // Convert timestamps to dates
  if(start) {
    dbOptions.startkey = util.getDateStringFromUnixTime(start);
  }
  if(end) {
    dbOptions.endkey = util.getDateStringFromUnixTime(end);
  }

  db.view('password_reset', dbOptions, function(dataByDate) {
    // Pivot data
    // (so that it's organized by step, then date; rather than date, step

    // Set up container object
    var dataByStep = {};
    var steps = data.passwordResetStepNames();
    steps.forEach(function(step) {
      dataByStep[step] = {};
    });

    dataByDate.forEach(function(datum) {
      var date = datum.key;

      steps.forEach(function(step) {
        var value;
        if(! (step in datum.value.steps)) { // No data about this step
          // That means no one completed it.
          value = 0;
        } else {
          value = datum.value.steps[step];
        }

        dataByStep[step][date] = value;
      });
    });

    callback(dataByStep);
  });
};

exports.general_progress_time = function(start, end, callback) {
  var dbOptions = {
    group: true
  };
  
  // Convert timestamps to dates
  if(start) {
    dbOptions.startkey = util.getDateStringFromUnixTime(start);
  }
  if(end) {
    dbOptions.endkey = util.getDateStringFromUnixTime(end);
  }
  
  db.view('general_progress', dbOptions, function(response) {

    // Set up container object
    var dataByStep = {};
    var steps = data.generalProgressStepNames();
    steps.forEach(function(step) {
      dataByStep[step] = {};
    });

    response.forEach(function(row) {
      var date = row.key;
      var total = row.value[steps[0]];
      steps.forEach(function(step) {
        if (step in row.value) {
          dataByStep[step][date] = row.value[step]/total;
        } else {
          dataByStep[step][date] = 0;
        }
      });
    });

    callback(dataByStep);
  });
};

exports.bounce_rate = function(segmentation, start, end, callback) {
  var dbOptions = {
    group: true
  };
  
  // Convert timestamps to dates
  if(start) {
    dbOptions.startkey = util.getDateStringFromUnixTime(start);
  }
  if(end) {
    dbOptions.endkey = util.getDateStringFromUnixTime(end);
  }
  
  db.view('general_progress', dbOptions, function(response) {
    var graph_data = [];
    response.forEach(function(row) {
      graph_data.push({
        category: row.key, // date
        value: 1 - (row.value['2 - User engaged'] / row.value['1 - Dialog shown']) // % who don't engage with the dialog
      });
    });
    callback({ Total: graph_data });
  });
};

exports.new_user_bounce = function(segmentation, start, end, callback) {
  var dbOptions = {
    group: true
  };

  if (segmentation) {
    if(start) {
      dbOptions.startkey = [ util.getDateStringFromUnixTime(start) ];
    }
    if(end) {
      dbOptions.endkey = [ util.getDateStringFromUnixTime(end) ];
    }
    db.view('new_user_bounce_' + segmentation, dbOptions, function(response) {
      var graph_data = {};
      
      response.forEach(function(row) {
        var date = row.key[0];
        var segment = row.key[1];
        
        if (!(segment in graph_data)) {
          graph_data[segment] = [];
        }
        
        graph_data[segment].push({
          category: date,
          value: row.value['bounce'] / (row.value['bounce'] + row.value['idp'] + row.value['fallback'] + row.value['fail'])
        });
      });
      callback(graph_data);
    });
  } else {
    if(start) {
      dbOptions.startkey = util.getDateStringFromUnixTime(start);
    }
    if(end) {
      dbOptions.endkey = util.getDateStringFromUnixTime(end);
    }
    db.view('new_user_bounce', dbOptions, function(response) {
      var graph_data = [];
    
      response.forEach(function(row) {
        graph_data.push({
          category: row.key, //date
          // % new users who bounce: assumes most/all failures are new users and most/all open/closes are new users
          value: row.value['bounce'] / (row.value['bounce'] + row.value['idp'] + row.value['fallback'] + row.value['fail'])
        });
      });
      callback({ Total: graph_data });
    });
  }
};

