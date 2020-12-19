import * as request from 'request';
import * as cheerio from 'cheerio';
import * as moment from 'moment';
import * as url from 'url';
import { debuglog, format } from 'util';
import Timer from './timer';

const log = {
  verbose: debuglog('lodestone'),
  info: (message: string, ...optionalParams: unknown[]): void => {
    console.log(message, ...optionalParams);
  },
  warn: (message: string, ...optionalParams: unknown[]): void => {
    console.error('Warning: %s', format(message, ...optionalParams));
  },
  error: (message: string, ...optionalParams: unknown[]): void => {
    console.error('ERROR: %s', format(message, ...optionalParams));
  }
}

export type Logger = (message: string, ...optionalParams: unknown[]) => void;

export function setLogs(errorLog: Logger, warningLog: Logger, infoLog: Logger, aVerboseLog: Logger) {
  log.error = errorLog;
  log.warn = warningLog;
  log.info = infoLog;
  log.verbose = aVerboseLog;
}

export function parseLodestoneDate(str: string, previous?: moment.Moment): moment.Moment {
  // Cheat:
  str = str.replace(/([AaPp])\.[Mm]\./g, function(_, ap) { return ap.toLowerCase() + 'm'; });
  // It's possible for the end time NOT to include the date. If we're given
  // the previous time and have no date component, use that.
  log.verbose('Parsing time [%s]', str);
  var rv = moment.utc(str, 'MMM. D, YYYY h:mm a');
  if (!rv.isValid() && previous) {
    rv = moment.utc(str, 'h:mm a');
    if (rv !== null) {
      rv.year(previous.year()).month(previous.month()).date(previous.date());
    }
  }
  return rv;
}

export function loadLodestone(lodestoneURL: string, skipScrapeBefore: number, skipTimerBefore: number, ignoredURLs: string[]): Promise<Timer[]> {
  log.verbose('Pulling %s...', lodestoneURL);
  return new Promise((resolve, reject) => {
    request({
      method: 'GET',
      uri: lodestoneURL,
      gzip: true
    }, function(error, response, body) {
      if (error) {
        log.error('%o', error);
        reject(error);
      }
      if (response.statusCode == 200) {
        const links = { };
        try {
          scrapeLodestone(body, lodestoneURL, skipScrapeBefore, ignoredURLs, links);
        } catch (ex) {
          log.error("Unable to parse Lodestone: " + ex);
          reject(ex);
          return;
        }
        const timers: Timer[] = [];
        // We now want to iterate through the links but we want to pull them
        // sequentially, so this ends up being a bit horrible. All we care
        // about are the object keys.
        const urls = Object.keys(links);
        log.info('Found %s URL%s to check.', urls.length, urls.length === 1 ? '' : 's');
        const loadURL = function(i: number) {
          loadPost(url.resolve(lodestoneURL, urls[i])).then((timer) => {
            if (error === null && timer !== null) {
              if (timer['end'] <= skipTimerBefore) {
                log.verbose('Skipping timer "' + timer['title'] + '": it is too old');
              } else {
                timers.push(timer);
              }
            }
          }).catch(() => {
            // Do nothing for now
          }).finally(() => {
            // Regardless of outcome:
            i++;
            if (i < urls.length) {
              // Keep going
              loadURL(i);
            } else {
              // Otherwise, we're done
              resolve(timers);
            }
          });
        }
        if (urls.length > 0) {
          loadURL(0);
        } else {
          resolve([]);
        }
      } else {
        log.error("Got error response from the Lodestone: " + response.statusCode + ' ' + response.statusMessage);
      }
    });
  });
}

export default loadLodestone;

function scrapeLodestone(html: string, lodestoneURL, skipBefore, ignoredURLs, links) {
  var $ = cheerio.load(html);
  var cutoff = moment(skipBefore).format();
  // Sweet lord is the FFXIV Lodestone HTML terrible
  $('a.ic__maintenance--list').each(function(i, e) {
    // See if this is a maintenance news item.
    var item = cheerio(this);
    var title = item.find('p.news__list--title');
    if (title.length > 0) {
      var tag = title.find('.news__list--tag');
      var href = item.attr('href');
      var postURL = url.resolve(lodestoneURL, href);
      // TODO: Possibly look this up in a more efficient fashion (although
      // it's almost always going to be an empty list)
      if (ignoredURLs.indexOf(postURL) >= 0) {
        log.verbose("Ignoring " + postURL + ": it is on the ignore list.");
        return;
      }
      var name = title.text();
      if (/^\s*\[\s*Follow-up\s*\]\s*$/.test(tag.text())) {
        // TODO: Update previous items with follow-up data. For now, though,
        // just ignore them.
        log.verbose("Skipping " + name + ": it is a follow-up.");
        return;
      }
      // See if we can pull the time out of it. Obnoxiously the time is hidden
      // in a script element.
      var script = item.find("time > script").text();
      var m = /ldst_strftime\s*\(\s*(\d+)\s*,\s*['"]YMD['"]\s*\)/.exec(script);
      if (m) {
        var time = parseInt(m[1]) * 1000;
        if (time < skipBefore) {
          log.verbose("Skipping \"" + name + "\" - its time (" + moment(time).format() + ") is before cutoff " + cutoff);
        } else {
          if (href in links) {
            if (links[href] != name) {
              log.warn("Link to " + href + " title changed from " + links[href] + " to " + name);
            }
          } else {
            links[href] = name;
            log.verbose("Adding \"" + name + "\" => \"" + href + "\"");
          }
        }
      } else {
        log.verbose('Unable to locate time for "%s": not following.', name);
      }
    }
  });
}

function loadPost(postURL: string): Promise<Timer | null> {
  log.info("Pulling %s...", postURL);
  return new Promise((resolve, reject) => {
    request({
      method: 'GET',
      uri: postURL,
      gzip: true
    }, function(error, response, body) {
      if (error) {
        log.error('%o', error);
        reject(error);
      }
      if (response.statusCode == 200) {
        const timer = parsePost(body, postURL);
        if (timer == null)
          log.error("Unable to parse post.");
        else
          log.info("Generated a " + timer.type + " timer");
        resolve(timer);
      }
    });
  });
}

function parsePost(html, postURL): Timer | null {
  const $ = cheerio.load(html);
  const title = $('header.news__header > h1');
  let tag = title.find('.news__header__tag').text().toLowerCase();
  tag = tag.replace(/^\s*\[\s*|\s*\]\s*$/g, '');
  // Remove the maintenance tag
  title.find('.news__header__tag').remove();
  const post = $('div.news__detail__wrapper').text();
  let m = /\[\s*Date\s+&(?:amp)?;?\s+Time\s*\]\s*\r?\n?\s*(?:From\s+)?(.*)\s+to\s+(.*)\s*\((\w+)\)/.exec(post);
  if (m) {
    const start = parseLodestoneDate(m[1]),
      end = parseLodestoneDate(m[2], start);
    let offset = 0;
    if (m[3] == "PDT") {
      offset = -7;
    } else if (m[3] == "PST") {
      offset = -8;
    } else {
      log.warn("Unknown time zone %s: skipping this.", m[3]);
      return null;
    }
    // Apply the offset to make the time correct
    start.add(-offset, 'h');
    end.add(-offset, 'h');
    const titleStr = title.text().trim();
    var name = '<a href="' + postURL + '">' + titleStr + '</a>';
    // See if it's for a patch.
    m = /\bPatch\s+(\d+\.\d+(?:\s+Hotfixes)?)\b/i.exec(post);
    if (m) {
      // See if it's a hotfix patch
      name += ' (Patch ' + m[1] + ')';
    }
    log.verbose("Added timer for %s from %s until %s", titleStr, start.format(), end.format());
    return {
      name: name,
      // For debugging (mostly) keep the raw title and URL
      title: titleStr,
      href: postURL,
      type: tag,
      start: start.valueOf(),
      end: end.valueOf(),
      // For debuggin (mostly) keep the text versions
      startText: start.format(),
      endText: end.format()
    };
  } else {
    log.verbose("Did not find times.");
  }
  return null;
}