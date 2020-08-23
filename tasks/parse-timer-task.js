/**
 * Task for loading timer data and then parsing it in some fashion.
 */
module.exports = function(grunt) {

var crushJSON = require('./lib/crush-json'),
  moment = require('moment');

function convertDate(date) {
  try {
    return Date.parse(date);
  } catch (ex) {
    grunt.log.error("Unable to parse time \"" + date + "\": " + ex);
  }
}

/**
 * Given an input timer definition, converts any fields as necessary (basically
 * parse the start/end dates if they're strings and convert them to UNIX-style
 * time-stamps).
 */
function convertTimer(timer) {
  if (grunt.util.kindOf(timer['start']) === 'string') {
    timer['start'] = convertDate(timer['start']);
  }
  if (grunt.util.kindOf(timer['end']) === 'string') {
    timer['end'] = convertDate(timer['end']);
  }
}

/**
 * The set of fields the timer cares about and that should survive
 * JSON-crushing. Note that this does NOT include the "subtimers" field as
 * that's only valid on the top-level field.
 */
var TIMER_FIELDS = {
  "start": true,
  "end": true,
  "name": true,
  "type": true,
  "showDuration": true,
  "info": true,
  "note": true,
  "endLabel": true
};

/**
 * Strips any field out of the timer that isn't used by the actual timer code.
 */
function stripIgnoredFields(timer, allowSubtimer) {
  if (arguments.length < 2)
    allowSubtimer = true;
  // We want to pull the keys and delete them while iterating over them, so:
  var keys = Object.keys(timer);
  keys.forEach(function(key) {
    if (!(key in TIMER_FIELDS)) {
      if (key === 'subtimers' && allowSubtimer) {
        // We actually want to recurse into this.
        if (grunt.util.kindOf(timer['subtimers']) === 'array') {
          timer['subtimers'].forEach(function(subtimer) {
            // Subtimers aren't allowed on subtimers. You can only nest once.
            stripIgnoredFields(subtimer, false);
          });
        }
        return;
      }
      // Otherwise, delete it.
      delete timer[key];
    }
  });
}

function parseTimers(timers, filename, oldest) {
  var json = grunt.file.readJSON(filename);
  // Fairly simple: just merge the timer data as necessary.
  var ts;
  if (grunt.util.kindOf(json) === 'array') {
    ts = json;
  } else if (grunt.util.kindOf(json['timers']) === 'array') {
    ts = json['timers'];
  } else {
    grunt.log.error("No timer data in " + filename);
    return;
  }
  ts.forEach(function(t) {
    convertTimer(t);
    if (grunt.util.kindOf(t['subtimers']) === 'array') {
      t['subtimers'].forEach(function(subtimer) {
        convertTimer(subtimer);
      });
    }
    // Exclude timers that are too old:
    if ('end' in t && t['end'] > oldest) {
      // Most timers have an end...
      timers.push(t);
    } else {
      // ...but if it doesn't, base it on the start.
      if ('start' in t && t['start'] > oldest) {
        timers.push(t);
      } else if ('indefinite' in t && t['indefinite']) {
        // Keep timers marked indefinite - they mark onging things that will end
        timers.push(t);
      }
    }
  });
}

grunt.registerMultiTask('parsetimers', 'Parses timer data', function() {
  var options = this.options({
    sort: true,
    stripUnusedFields: true,
    crush: true,
    oldest: moment.duration(1, 'day')
  });
  if (moment.isDuration(options['oldest']))
    options['oldest'] = options['oldest'].asMilliseconds();
  this.files.forEach(function(file) {
    if (file.src.length < 1) {
      grunt.log.error("No input files for " + file.dest);
    } else {
      var timers = [], oldest = new Date().getTime() - options['oldest'];
      file.src.forEach(function(src) {
        parseTimers(timers, src, oldest);
      });
      if (options['sort']) {
        // Sort the timers by start time before writing them. Earlier timers
        // should be higher on the list.
        timers.sort(function(a,b) {
          var d = a['start'] - b['start'];
          if (d != 0)
            return d;
          // Sort by title instead.
          if ('title' in a && 'title' in b) {
            return a['title'] < b['title'] ? -1 : (a['title'] == b['title'] ? 0 : 1);
          } else {
            // Otherwise, sort by the name field.
            return a['name'] < b['name'] ? -1 : (a['name'] == b['name'] ? 0 : 1);
          }
        });
      }
      if (options['stripUnusedFields']) {
        timers.forEach(function(timer) {
          stripIgnoredFields(timer);
        });
      }
      grunt.file.write(file.dest, options['crush'] ?
        crushJSON({ timers: timers }) :
        JSON.stringify({ timers: timers }, null, 2));
      grunt.log.ok("Wrote " + timers.length + " " +
        grunt.util.pluralize(timers.length, "timer/timers") +" to " + file.dest);
    }
  });
});

};
