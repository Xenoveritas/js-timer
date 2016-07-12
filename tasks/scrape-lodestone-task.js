module.exports = function(grunt) {
  var request = require('request'),
    cheerio = require('cheerio'),
    url = require('url'),
    moment = require('moment'),
    fs = require('fs');
  function parseLodestoneDate(str, previous) {
    // Cheat:
    str = str.replace(/([AaPp])\.[Mm]\./g, function(_, ap) { return ap.toLowerCase() + 'm'; });
    // It's possible for the end time NOT to include the date. If we're given
    // the previous time and have no date component, use that.
    grunt.verbose.writeln("Parsing time [" + str + "]");
    var rv = moment.utc(str, 'MMM. D, YYYY h:mm a');
    if (!rv.isValid() && arguments.length >= 2) {
      rv = moment.utc(str, 'h:mm a');
      if (rv !== null) {
        rv.year(previous.year()).month(previous.month()).date(previous.date());
      }
    }
    return rv;
  }
  function strip(str) {
    return str.replace(/^\s+|\s+$/g, '');
  }
  function loadLodestone(lodestoneURL, skipScrapeBefore, skipTimerBefore, callback) {
    grunt.log.write('Pulling ' + lodestoneURL + '... ');
    request({
      method: 'GET',
      uri: lodestoneURL,
      gzip: true
    }, function(error, response, body) {
      if (error) {
        grunt.log.error('ERROR: ' + error);
        callback(null);
      }
      if (response.statusCode == 200) {
        var links = { };
        grunt.log.ok();
        scrapeLodestone(body, lodestoneURL, skipScrapeBefore, links);
        var timers = [];
        // We now want to iterate through the links but we want to pull them
        // sequentially, so this ends up being a bit horrible. All we care
        // about are the object keys.
        var urls = Object.keys(links), loadURL;
        loadURL = function(i) {
          loadPost(url.resolve(lodestoneURL, urls[i]), function(error, timer) {
            if (error === null && timer !== null) {
              if (timer['end'] <= skipTimerBefore) {
                grunt.verbose.writeln('Skipping timer "' + timer['title'] + '": it is too old');
              } else {
                timers.push(timer);
              }
            }
            // Regardless of outcome:
            i++;
            if (i < urls.length) {
              // Keep going
              loadURL(i);
            } else {
              // Otherwise, we're done
              callback(timers);
            }
          });
        }
        if (urls.length > 0) {
          loadURL(0);
        } else {
          callback([]);
        }
      }
    });
  }
  function scrapeLodestone(html, lodestoneURL, skipBefore, links) {
    var $ = cheerio.load(html);
    var cutoff = moment(skipBefore).format();
    $('dl.news_list').each(function(i, e) {
      // See if this is a maintenance news item.
      var item = cheerio(this);
      var title = item.find('dt.ic_maintenance');
      if (title.length > 0) {
        var tag = title.find('.tag');
        // Grab the link out of it.
        var a = title.find('a');
        var href = a.attr('href');
        var name = a.text();
        if (/^\s*\[\s*Follow-up\s*\]\s*$/.test(tag.text())) {
          // TODO: Update previous items with follow-up data. For now, though,
          // just ignore them.
          grunt.verbose.writeln("Skipping " + name + ": it is a follow-up.");
          return;
        }
        // See if we can pull the time out of it. Obnoxiously the time is hidden
        // in a script element.
        var script = item.find("span[id^='datetime-']+script").text();
        var m = /ldst_strftime\s*\(\s*(\d+)\s*,\s*['"]YMD['"]\s*\)/.exec(script);
        if (m) {
          var time = parseInt(m[1]) * 1000;
          if (time < skipBefore) {
            grunt.verbose.writeln("Skipping \"" + name + "\" - its time (" + moment(time).format() + ") is before cutoff " + cutoff);
          } else {
            if (href in links) {
              if (links[href] != name) {
                grunt.log.writeln("Warning: link to " + href + " title changed from " + links[href] + " to " + name);
              }
            } else {
              links[href] = name;
            }
          }
        }
      }
    });
  }
  function loadPost(postURL, callback) {
    grunt.log.write("Pulling " + postURL + "... ");
    request({
      method: 'GET',
      uri: postURL,
      gzip: true
    }, function(error, response, body) {
      if (error) {
        grunt.log.error('ERROR: ' + error);
        callback(error);
      }
      if (response.statusCode == 200) {
        grunt.log.ok();
        callback(null, parsePost(body, postURL));
      }
    });
  }
  function parsePost(html, postURL) {
    var $ = cheerio.load(html);
    var title = $('div.topics_detail_txt');
    var tag = title.find('.topics_detail_tag').text().toLowerCase();
    tag = tag.replace(/^\s*\[\s*|\s*\]\s*$/g, '');
    // Remove the maintenance tag
    title.find('.topics_detail_tag').remove();
    var post = $('div.area_inner_cont').text();
    var m = /\[\s*Date\s+&(?:amp)?;?\s+Time\s*\]\s*\r?\n?\s*(.*)\s+to\s+(.*)\s*\((\w+)\)/.exec(post);
    if (m) {
      var start = parseLodestoneDate(m[1]),
        end = parseLodestoneDate(m[2], start),
        offset = 0;
      if (m[3] == "PDT") {
        offset = -7;
      } else if (m[3] == "PST") {
        offset = -8;
      } else {
        grunt.log.writeln("Warning: Unknown time zone " + m[3] + ": skipping this.");
        return null;
      }
      // Apply the offset to make the time correct
      start.add(-offset, 'h');
      end.add(-offset, 'h');
      title = strip(title.text());
      var name = '<a href="' + postURL + '">' + title + '</a>';
      // See if it's for a patch.
      m = /\bPatch\s+(\d+\.\d+(?:\s+Hotfixes)?)\b/i.exec(post);
      if (m) {
        // See if it's a hotfix patch
        name += ' (Patch ' + m[1] + ')';
      }
      grunt.verbose.writeln("Added timer for " + title + " from " + start.format() + " until " + end.format());
      return {
        name: name,
        // For debugging (mostly) keep the raw title and URL
        title: title,
        href: postURL,
        type: tag,
        start: start.valueOf(),
        end: end.valueOf(),
        // For debuggin (mostly) keep the text versions
        startText: start.format(),
        endText: end.format()
      };
    } else {
      grunt.verbose.writeln("Did not find times.");
    }
    return null;
  }

  grunt.registerMultiTask('scrapelodestone', function() {
    // This task doesn't really work with files, so use data instead
    var data = this.data;
    var options = this.options({
      // Don't scrape any news item posted this number of millis before
      // You know what, if S-E is going to start posting patch notices THAT far
      // in advance...
      scrapeTimeLimit: moment.duration(1, 'month'),
      timeLimit: moment.duration(1, 'day'),
      cacheTime: moment.duration(1, 'hour'),
      url: "http://na.finalfantasyxiv.com/lodestone/"
    });
    // Convert any moment durations into milliseconds
    ['scrapeTimeLimit', 'timeLimit', 'cacheTime'].forEach(function(k) {
      if (moment.isDuration(options[k]))
        options[k] = options[k].asMilliseconds();
    });
    var dest = data.dest;
    // Check to see if our destination file is stale
    try {
      var stats = fs.statSync(dest);
      // See if this is recent
      if (stats.mtime.getTime() + options.cacheTime > new Date().getTime()) {
        grunt.log.ok("Skipping " + dest + ": still within cache time.");
        return;
      }
    } catch (ex) {
      // If the file doesn't exist, we don't care
      if (ex.code !== 'ENOENT') {
        grunt.log.errorlns("Error checking destination \"" + dest + "\": " + ex);
      }
    }
    var lodestoneURL = options.url,
      skipScrapeBefore = new Date().getTime() - options.scrapeTimeLimit,
      skipTimerBefore = new Date().getTime() - options.timeLimit;
    var done = this.async();
    loadLodestone(lodestoneURL, skipScrapeBefore, skipTimerBefore, function(timers) {
      if (timers !== null) {
        grunt.file.write(data.dest, JSON.stringify({ timers: timers }, null, 2));
        grunt.log.ok("Found " + timers.length + " " +
          grunt.util.pluralize(timers.length, "timer/timers") + ".");
      }
      done();
    });
  });
}
