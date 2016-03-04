/**
 * Task for loading timer data and then parsing it in some fashion.
 */
module.exports = function(grunt) {

var crushJSON = require('./lib/crush-json');

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

function parseTimers(timers, filename) {
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
    timers.push(t);
  });
}

grunt.registerMultiTask('parsetimers', 'Parses timer data', function() {
  this.files.forEach(function(file) {
    if (file.src.length < 1) {
      grunt.log.error("No input files for " + file.dest);
    } else {
      var timers = [];
      file.src.forEach(function(src) {
        parseTimers(timers, src);
      });
      grunt.file.write(file.dest, crushJSON({ timers: timers }));
      grunt.log.ok("Wrote " + timers.length + " " +
        grunt.util.pluralize(timers.length, "timer/timers") +" to " + file.dest);
    }
  });
});

};
