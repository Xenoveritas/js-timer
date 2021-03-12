import * as request from 'request';
import * as cheerio from 'cheerio';
import * as moment from 'moment';
import * as url from 'url';
import { debuglog, format } from 'util';
import Timer from './timer';

/**
 * Defines the guaranteed entries of a timer produced by the scraper.
 */
export interface LodestoneTimer extends Timer {
  /**
   * The UNIX timestamp of when the entry was loaded.
   */
  loadedAt: number;
  /**
   * The source URL for the entry, which describes the specific news article used to generate the entry.
   */
  sourceURL: string;
}

export type Logger = (message: string, ...optionalParams: unknown[]) => void;

export type Time = moment.Moment | string | number;

export interface LodestoneScraperOptions {
  cache?: LodestoneTimer[] | null;
  lodestoneURL?: string;
  ignoredURLs?: string[];
  skipScrapeBefore?: Time;
  skipTimerBefore?: Time;
}

function parseTime(time: Time): number {
  if (typeof time === 'string') {
    return moment(time).valueOf();
  } else if (typeof time === 'object') {
    return time.valueOf();
  } else {
    return time;
  }
}

/**
 * Instance of the scraper.
 */
export class LodestoneScraper {
  cache = new Map<string, LodestoneTimer>();
  log = {
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
  };
  skipScrapeBefore: number;
  skipTimerBefore: number;
  lodestoneURL: string;
  ignoredURLs: string[];
  constructor(options?: LodestoneScraperOptions) {
    if (options?.cache) {
      for (const entry of options.cache) {
        this.cache.set(entry.sourceURL, entry);
      }
    }
    // Default to skipping all posts posted more than a week ago.
    this.skipScrapeBefore = options?.skipScrapeBefore ? parseTime(options.skipScrapeBefore) : (new Date().getTime() - (7 * 24 * 60 * 60 * 1000));
    // Default to skipping all timers that are more than 24 hours old
    this.skipTimerBefore = options?.skipTimerBefore ? parseTime(options.skipTimerBefore) : (new Date().getTime() - (24 * 60 * 60 * 1000));
    this.lodestoneURL = options?.lodestoneURL ? options.lodestoneURL : 'https://na.finalfantasyxiv.com/lodestone/';
    this.ignoredURLs = options?.ignoredURLs ? options.ignoredURLs : [];
  }

  setLogs(errorLog: Logger, warningLog: Logger, infoLog: Logger, aVerboseLog: Logger) {
    this.log.error = errorLog;
    this.log.warn = warningLog;
    this.log.info = infoLog;
    this.log.verbose = aVerboseLog;
  }
  
  parseLodestoneDate(str: string, previous?: moment.Moment): moment.Moment {
    // Cheat:
    str = str.replace(/([AaPp])\.[Mm]\./g, function(_, ap) { return ap.toLowerCase() + 'm'; });
    // It's possible for the end time NOT to include the date. If we're given
    // the previous time and have no date component, use that.
    this.log.verbose('Parsing time [%s]', str);
    var rv = moment.utc(str, 'MMM. D, YYYY h:mm a');
    if (!rv.isValid() && previous) {
      rv = moment.utc(str, 'h:mm a');
      if (rv !== null) {
        rv.year(previous.year()).month(previous.month()).date(previous.date());
      }
    }
    return rv;
  }

  /**
   * Checks if a given URL is on the ignore list.
   * @param url the URL to check
   * @returns whether or not the URL is ignored
   */
  isIgnored(url: string) {
    // The assumption is that the igore list will always be quite small and it'll actually be faster to do this
    // than attempt a Set
    return this.ignoredURLs.indexOf(url) >= 0;
  }
  
  /**
   * Attempts to scrape the Lodestone using the options given at construction time.
   * @returns a Promise that resolves to any loaded timers
   */
  loadLodestone(): Promise<LodestoneTimer[]> {
    this.log.verbose('Pulling %s...', this.lodestoneURL);
    return new Promise((resolve, reject) => {
      request({
        method: 'GET',
        uri: this.lodestoneURL,
        gzip: true
      }, (error, response, body) => {
        if (error) {
          this.log.error('%o', error);
          reject(error);
        }
        if (response.statusCode === 200) {
          const links = { };
          try {
            this.scrapeLodestone(body, links);
          } catch (ex) {
            this.log.error("Unable to parse Lodestone: " + ex);
            reject(ex);
            return;
          }
          const timers: LodestoneTimer[] = [];
          // We now want to iterate through the links but we want to pull them
          // sequentially, so this ends up being a bit horrible. All we care
          // about are the object keys.
          const urls = Object.keys(links);
          this.log.info('Found %s URL%s to check.', urls.length, urls.length === 1 ? '' : 's');
          const loadURL = (i: number): void => {
            this.loadPost(url.resolve(this.lodestoneURL, urls[i])).then((timer) => {
              if (error === null && timer !== null) {
                if (timer.end <= this.skipTimerBefore) {
                  this.log.verbose('Skipping timer "%s": it is too old', timer.title);
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
          this.log.error("Got error response from the Lodestone: " + response.statusCode + ' ' + response.statusMessage);
        }
      });
    });
  }

  scrapeLodestone(html: string, links) {
    const $ = cheerio.load(html);
    const cutoff = moment(this.skipScrapeBefore).format();
    // Sweet lord is the FFXIV Lodestone HTML terrible
    $('a.ic__maintenance--list').each((i, e) => {
      // See if this is a maintenance news item.
      const item = cheerio(e);
      const title = item.find('p.news__list--title');
      if (title.length > 0) {
        const tag = title.find('.news__list--tag');
        const href = item.attr('href');
        const postURL = url.resolve(this.lodestoneURL, href);
        // TODO: Possibly look this up in a more efficient fashion (although
        // it's almost always going to be an empty list)
        if (this.isIgnored(postURL)) {
          this.log.verbose("Ignoring %s: it is on the ignore list.", postURL);
          return;
        }
        const name = title.text();
        if (/^\s*\[\s*Follow-up\s*\]\s*$/.test(tag.text())) {
          // TODO: Update previous items with follow-up data. For now, though,
          // just ignore them.
          this.log.verbose("Skipping %s: it is a follow-up.", name);
          return;
        }
        // See if we can pull the time out of it. Obnoxiously the time is hidden
        // in a script element.
        const script = item.find("time > script").text();
        const m = /ldst_strftime\s*\(\s*(\d+)\s*,\s*['"]YMD['"]\s*\)/.exec(script);
        if (m) {
          // Time on the Lodestone is helpfully stored as a UNIX timestamp in seconds and then formatted in JS
          const time = parseInt(m[1]) * 1000;
          if (time < this.skipScrapeBefore) {
            this.log.verbose('Skipping "%s" its time (%s) is before cutoff %s', name, moment(time).format(), cutoff);
          } else {
            if (href in links) {
              if (links[href] != name) {
                this.log.warn("Link to %s title changed from %s to %s", href, links[href], name);
              }
            } else {
              links[href] = name;
              this.log.verbose('Adding "%s" => "%s"', name, href);
            }
          }
        } else {
          this.log.verbose('Unable to locate time for "%s": not following.', name);
        }
      }
    });
  }

  loadPost(postURL: string): Promise<LodestoneTimer | null> {
    this.log.info("Pulling %s...", postURL);
    return new Promise((resolve, reject) => {
      request({
        method: 'GET',
        uri: postURL,
        gzip: true
      }, (error, response, body) => {
        if (error) {
          this.log.error('%o', error);
          reject(error);
        }
        if (response.statusCode == 200) {
          const timer = this.parsePost(body, postURL);
          if (timer == null)
            this.log.error("Unable to parse post.");
          else
            this.log.info("Generated a " + timer.type + " timer");
          resolve(timer);
        }
      });
    });
  }

  parsePost(html: string, postURL: string): LodestoneTimer | null {
    const $ = cheerio.load(html);
    const title = $('header.news__header > h1');
    let tag = title.find('.news__header__tag').text().toLowerCase();
    tag = tag.replace(/^\s*\[\s*|\s*\]\s*$/g, '');
    // Remove the maintenance tag
    title.find('.news__header__tag').remove();
    const post = $('div.news__detail__wrapper').text();
    let m = /\[\s*Date\s+&(?:amp)?;?\s+Time\s*\]\s*\r?\n?\s*(?:From\s+)?(.*)\s+to\s+(.*)\s*\((\w+)\)/.exec(post);
    if (m) {
      const start = this.parseLodestoneDate(m[1]),
        end = this.parseLodestoneDate(m[2], start);
      let offset = 0;
      if (m[3] == "PDT") {
        offset = -7;
      } else if (m[3] == "PST") {
        offset = -8;
      } else {
        this.log.warn("Unknown time zone %s: skipping this.", m[3]);
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
      this.log.verbose("Added timer for %s from %s until %s", titleStr, start.format(), end.format());
      return {
        name: name,
        // For debugging (mostly) keep the raw title and URL
        title: titleStr,
        sourceURL: postURL,
        type: tag,
        start: start.valueOf(),
        end: end.valueOf(),
        // For debuggin (mostly) keep the text versions
        startText: start.format(),
        endText: end.format(),
        loadedAt: new Date().getTime()
      };
    } else {
      this.log.verbose("Did not find times.");
    }
    return null;
  }
}

export default LodestoneScraper;