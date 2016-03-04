module.exports = function(grunt) {
  var request = require('request'),
    cheerio = require('cheerio'),
    url = require('url'),
    moment = require('moment'),
    fs = require('fs');
  function parseLodestoneDate(str) {
    // Cheat:
    str = str.replace(/([AaPp]\.[Mm]\.)/g, function(_, ap) { return ap.toLowerCase() + 'm'; });
    return moment.utc(str, 'MMM. D, YYYY h:mm a');
  }
  function strip(str) {
    return str.replace(/^\s+|\s+$/g, '');
  }
  function loadLodestone(lodestoneURL, skipBefore, callback) {
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
        scrapeLodestone(body, lodestoneURL, skipBefore, links);
        var timers = [];
        // We now want to iterate through the links but we want to pull them
        // sequentially, so this ends up being a bit horrible. All we care
        // about are the object keys.
        var urls = Object.keys(links), loadURL;
        loadURL = function(i) {
          loadPost(url.resolve(lodestoneURL, urls[i]), function(error, timer) {
            if (error === null && timer !== null) {
              timers.push(timer);
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
        loadURL(0);
      }
    });
  }
  function scrapeLodestone(html, lodestoneURL, skipBefore, links) {
    var $ = cheerio.load(html);
    $('dl.news_list').each(function(i, e) {
      // See if this is a maintenance news item.
      var item = cheerio(this);
      var title = item.find('dt.ic_maintenance');
      if (title.length > 0) {
        // Grab the link out of it.
        var a = title.find('a');
        var href = a.attr('href');
        var name = a.text();
        // See if we can pull the time out of it. Obnoxiously the time is hidden
        // in a script element.
        var script = item.find("span[id^='datetime-']+script").text();
        var m = /ldst_strftime\s*\(\s*(\d+)\s*,\s*['"]YMD['"]\s*\)/.exec(script);
        if (m) {
          var time = parseInt(m[1]) * 1000;
          if (time < skipBefore) {
            grunt.verbose.writeln("Skipping \"" + name + "\" - before cutoff");
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
        end = parseLodestoneDate(m[2]),
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
      return {
        name: '<a href="' + postURL + '">' + strip(title.text()) + '</a>',
        type: tag,
        start: start.valueOf(),
        end: end.valueOf()
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
      timeLimit: 24*60*60*1000,
      cacheTime: 60*60*1000,
      url: "http://na.finalfantasyxiv.com/lodestone/"
    });
    var dest = data.dest;
    // First, see if our destination already exists
    try {
      var stats = fs.statSync(dest);
      // See if this is recent
      if (stats.mtime.getTime() + options.cacheTime > new Date().getTime()) {
        grunt.log.writeln("Skipping \"" + dest + "\": still within cache time.");
        return;
      }
    } catch (ex) {
      // If the file doesn't exist, we don't care
      if (ex.code !== 'ENOENT') {
        grunt.log.errorlns("Error checking destination \"" + dest + "\": " + ex);
      }
    }
    var lodestoneURL = options.url,
      skipBefore = new Date().getTime() - options.timeLimit;
    var done = this.async();
    loadLodestone(lodestoneURL, skipBefore, function(timers) {
      if (timers !== null) {
        grunt.file.write(data.dest, JSON.stringify({ timers: timers }, null, 2));
      }
      done();
    });
  });
}
