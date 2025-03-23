import * as cheerio from 'cheerio';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import duration from 'dayjs/plugin/duration.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import Logger from './logger.mjs';
import { Timer } from './timer.mjs';

// Debug log
const log = new Logger('lodestone');

dayjs.extend(utc);
dayjs.extend(duration);
dayjs.extend(customParseFormat);

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

/**
 * The cache as returned by getCacheJSON and which can be restored with the cache option.
 * While this is documented, it should be considered "opaque" as it may change in the future.
 */
export interface TimerCache {
  [key: string]: unknown;
  /**
   * The time the Lodestone was loaded.
   */
  lastLoadedAt: number;
  /**
   * The actual cached timer data.
   */
  timers: LodestoneTimer[];
}

export function isTimerCache(o: unknown): o is TimerCache {
  if (typeof o !== 'object' || o === null)
    return false;
  const cache = o as TimerCache;
  return typeof cache.lastLoadedAt === 'number' && Array.isArray(cache.timers);
}

// A time - if a duration is given, it's used as "time before current date"
export type Time = dayjs.Dayjs | duration.Duration | string | number;
// Duration
export type Duration = duration.Duration | string | number;

export interface LodestoneScraperOptions {
  cache: TimerCache | null;
  lodestoneURL: string;
  ignoredURLs: string[];
  skipScrapeBefore: Time;
  skipTimerBefore: Time;
  refetchTime: Duration;
}

export const DEFAULT_OPTIONS: LodestoneScraperOptions = {
  // Default cache has to be null to indicate a new empty cache should be created per instance
  cache: null,
  lodestoneURL: 'https://na.finalfantasyxiv.com/lodestone/',
  ignoredURLs: [],
  // Default to skipping all posts posted more than a week ago.
  skipScrapeBefore: dayjs.duration({days: 7}),
  // Default to skipping all timers that are more than 24 hours old
  skipTimerBefore: dayjs.duration({days: 1}),
  // Default to refetching after an hour
  refetchTime: dayjs.duration({hours: 1})
};

function parseTimeString(time: string): dayjs.Dayjs | duration.Duration {
  log.verbose('Parsing [%s] as time', time);
  if (time.startsWith('P')) {
    return dayjs.duration(time);
  } else {
    return dayjs(time);
  }
}

/**
 * Parses a time option, returning a timestamp.
 * @param time the time to parse
 * @returns time as milliseconds since the UNIX epoch, i.e., what Date.getTime returns
 */
function parseTime(time: Time, now?: dayjs.Dayjs): number {
  const timeObj = typeof time === 'string' ? parseTimeString(time) : time;
  if (typeof timeObj === 'number') {
    return timeObj;
  }
  if (dayjs.isDuration(timeObj)) {
    // Convert to a timestamp based on now
    return (now || dayjs()).subtract(timeObj).valueOf();
  } else {
    return timeObj.valueOf();
  }
}

/**
 * Converts the given duration to milliseconds
 * @param duration the duration to parse
 * @returns number of milliseconds in the duration
 */
function parseDuration(duration: Duration): number {
  if (typeof duration === 'number') {
    return duration;
  }
  return typeof duration === 'string' ? dayjs.duration(duration).asMilliseconds() : duration.asMilliseconds();
}

/**
 * Instance of the scraper.
 */
export class LodestoneScraper {
  cache = new Map<string, LodestoneTimer>();
  log = log;
  skipScrapeBefore: Time;
  skipTimerBefore: Time;
  refetchAfter: number;
  /**
   * The last time the Lodestone was loaded. Defaults to -Infinity.
   */
  lastLoadedAt = -Infinity;
  lodestoneURL: URL;
  ignoredURLs: string[];
  constructor(options?: Partial<LodestoneScraperOptions>) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    if (opts.cache) {
      this.lastLoadedAt = opts.cache.lastLoadedAt;
      for (const entry of opts.cache.timers) {
        this.cache.set(entry.sourceURL, entry);
      }
    }
    // Default to skipping all posts posted more than a week ago.
    this.skipScrapeBefore = opts.skipScrapeBefore;
    // Default to skipping all timers that are more than 24 hours old
    this.skipTimerBefore = opts.skipTimerBefore;
    this.lodestoneURL = new URL(opts.lodestoneURL);
    // Default to refetching after an hour
    this.refetchAfter = parseDuration(opts.refetchTime);
    this.ignoredURLs = opts.ignoredURLs.slice();
  }

  setLogger(log: Logger) {
    this.log = log;
  }
  
  parseLodestoneDate(str: string, previous?: dayjs.Dayjs): dayjs.Dayjs {
    // Cheat:
    str = str.replace(/([AaPp])\.[Mm]\./g, function(_, ap) { return ap.toLowerCase() + 'm'; });
    // It's possible for the end time NOT to include the date. If we're given
    // the previous time and have no date component, use that.
    // dayjs has a bug where "MMM." is broken. Just remove it
    str = str.replace(/^([A-Za-z]{3})\./, '$1');
    this.log.verbose('Parsing time [%s]', str);
    let rv = dayjs.utc(str, 'MMM D, YYYY h:mm a', true);
    if (!rv.isValid() && previous) {
      this.log.verbose('Could not parse, attempting to parse time alone');
      rv = dayjs.utc(str, 'h:mm a');
      this.log.verbose('Parsed to %s', rv.format());
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

  cacheTimer(timer: LodestoneTimer): void {
    // URL is in the sourceURL field
    this.cache.set(timer.sourceURL, { ...timer });
  }

  latestCacheEntry(): number {
    let result = -Infinity;
    for (const entry of this.cache.values()) {
      if (entry.loadedAt > result)
        result = entry.loadedAt;
    }
    return result;
  }

  /**
   * Gets an array of all cached timers, ready to be reinserted via the cache option.
   */
  cachedTimers(): LodestoneTimer[] {
    return Array.from(this.cache.values());
  }

  getCacheJSON(): TimerCache {
    return {
      lastLoadedAt: this.lastLoadedAt,
      timers: this.cachedTimers()
    };
  }
  
  /**
   * Attempts to scrape the Lodestone using the options given at construction time.
   * @returns a Promise that resolves to any loaded timers
   */
  async loadLodestone(): Promise<LodestoneTimer[]> {
    const now = dayjs();
    const skipTimersBeforeTimestamp = parseTime(this.skipTimerBefore, now);
    const skipScrapingBefore = parseTime(this.skipScrapeBefore, now);
    const mostRecent = this.latestCacheEntry();
    if (mostRecent > now.valueOf() - this.refetchAfter) {
      this.log.verbose('Cache is still fresh (loaded at %s, current time is %s), reusing timer data within the cache.', dayjs(mostRecent).format(), dayjs(now).format());
      return this.cachedTimers().filter((timer) => {
        return timer.end ? timer.end > skipTimersBeforeTimestamp : true;
      });
    }
    this.log.verbose('Pulling %s...', this.lodestoneURL);
    const response = await fetch(this.lodestoneURL.toString());
    if (response.status === 200) {
      const links: Record<string, string> = { };
      try {
        this.scrapeLodestone(await response.text(), links, skipScrapingBefore);
      } catch (ex) {
        this.log.error("Unable to parse Lodestone: " + ex);
        throw ex;
      }
      // Set the last loaded time to be the time when this request started
      this.lastLoadedAt = now.valueOf();
      const timers: LodestoneTimer[] = [];
      // We now want to iterate through the links but we want to pull them
      // sequentially, so this ends up being a bit horrible. All we care
      // about are the object keys.
      const urls = Object.keys(links);
      this.log.info('Found %s URL%s to check.', urls.length, urls.length === 1 ? '' : 's');
      for (const url of urls) {
        try {
          const timer = await this.loadPost(new URL(url, this.lodestoneURL).toString());
          if (timer !== null) {
            // No matter what, we always cache the timer
            this.cacheTimer(timer);
            if (timer.end && timer.end <= skipTimersBeforeTimestamp) {
              this.log.verbose('Skipping timer "%s": it is too old', timer.title);
            } else {
              timers.push(timer);
            }
          }
        } catch (ex) {
          this.log.error('Error fetching %s: %o', url.toString(), ex);
        }
      }
      return timers;
    } else {
      throw new Error("Got error response from the Lodestone: " + response.status + ' ' + response.statusText);
    }
  }

  scrapeLodestone(html: string, links: Record<string, string>, skipBefore?: number): void {
    const $ = cheerio.load(html);
    const cutoff = dayjs(skipBefore ?? parseTime(this.skipScrapeBefore)).format();
    // Sweet lord is the FFXIV Lodestone HTML terrible
    $('a.ic__maintenance--list').each((i, e) => {
      // See if this is a maintenance news item.
      const item = $(e);
      const title = item.find('p.news__list--title');
      if (title.length > 0) {
        const tag = title.find('.news__list--tag');
        const href = item.attr('href');
        if (!href) {
          // Didn't find anything
          return;
        }
        const postURL = new URL(href, this.lodestoneURL).toString();
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
          if (skipBefore && time < skipBefore) {
            this.log.verbose('Skipping "%s" its time (%s) is before cutoff %s', name, dayjs(time).format(), cutoff);
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

  async loadPost(postURL: string): Promise<LodestoneTimer | null> {
    const cachedResult = this.cache.get(postURL);
    if (cachedResult && cachedResult.loadedAt > (new Date().getTime() - this.refetchAfter)) {
      this.log.verbose('Using cached entry for "%s"...', postURL);
      return Promise.resolve(cachedResult);
    }
    this.log.info("Pulling %s...", postURL);
    const response = await fetch(postURL);
    if (response.status == 200) {
      const timer = this.parsePost(await response.text(), postURL);
      if (timer == null)
        this.log.error("Unable to parse post.");
      else
        this.log.info("Generated a " + timer.type + " timer");
      return timer;
    } else {
      throw new Error(`Error response from server: ${response.status} ${response.statusText}`);
    }
  }

  parsePost(html: string, postURL: string): LodestoneTimer | null {
    const $ = cheerio.load(html);
    const title = $('header.news__header > h1');
    let tag = title.find('.news__header__tag').text().toLowerCase();
    tag = tag.replace(/^\s*\[\s*|\s*\]\s*$/g, '');
    // Remove the maintenance tag
    title.find('.news__header__tag').remove();
    const post = $('div.news__detail__wrapper').text();
    let m = /\[\s*Date\s+&(?:amp)?;?\s+Time\s*\]\s*\r?\n?\s*(?:From\s+)?(.*)\s+to\s+(.*?)\s*\((\w+)\)/.exec(post);
    if (m) {
      let start = this.parseLodestoneDate(m[1]),
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
      start = start.add(-offset, 'h');
      end = end.add(-offset, 'h');
      this.log.verbose('Applied %d offset to create final times of %s-%s', offset, start.format(), end.format())
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