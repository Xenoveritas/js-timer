import * as cheerio from 'cheerio';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import duration from 'dayjs/plugin/duration.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import Logger from './logger.mjs';
import { Timer } from './timer.mjs';

// Debug log
const log = new Logger('lodestone');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);
dayjs.extend(customParseFormat);

interface KnownEvent {
  name: string;
  pattern: RegExp;
  type: string;
}
/**
 * List of known events to the type used for them
 */
const KNOWN_EVENTS: KnownEvent[] = Object.entries({
  //"Free Login Campaign": "campaign free-login",
  "Heavensturn": "event heavensturn",
  "Valentione's Day": "event valentiones-day",
  "Little Ladies' Day": "event little-ladies-day",
  "Hatching-tide": "event hatchingtide",
  "The Make It Rain Campaign": "event make-it-rain",
  "Moonfire Faire": "event moonfire-faire",
  "The Rising": "event the-rising",
  "All Saints' Wake": "event all-saints-wake",
  "Starlight Celebration": "event starlight-celebration",
}).map(([name, type]) => {
  return {
    name: name.replace("'", "\u2019"),
    pattern: new RegExp(name.replace("'", "['\u2019]")),
    type: type
  };
});

const TIMEZONES = new Map<string, string>([
  ["PDT", 'Etc/GMT+7'],
  ["PST", 'Etc/GMT+8']
]);

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
  /**
   * Allow unknown elements.
   */
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
  defaultTimezone: string;
  skipScrapeBefore: Time;
  skipTimerBefore: Time;
  refetchTime: Duration;
}

export const DEFAULT_OPTIONS: LodestoneScraperOptions = {
  // Default cache has to be null to indicate a new empty cache should be created per instance
  cache: null,
  lodestoneURL: 'https://na.finalfantasyxiv.com/lodestone/',
  defaultTimezone: 'America/Los_Angeles',
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
  defaultTimezone: string;
  skipScrapeBefore: Time;
  skipTimerBefore: Time;
  refetchAfter: number;
  /**
   * The last time the Lodestone was loaded. Defaults to -Infinity.
   */
  lastLoadedAt = -Infinity;
  lodestoneURL: URL;
  ignoredURLs: string[];
  /**
   * Next timestamp to make a fetch.
   */
  nextFetchTime = -Infinity;
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
    this.defaultTimezone = opts.defaultTimezone;
    this.lodestoneURL = new URL(opts.lodestoneURL);
    // Default to refetching after an hour
    this.refetchAfter = parseDuration(opts.refetchTime);
    this.ignoredURLs = opts.ignoredURLs.slice();
  }

  setLogger(log: Logger) {
    this.log = log;
  }

  parseLodestoneDate(str: string, previous?: dayjs.Dayjs): dayjs.Dayjs {
    // Remove any "at":
    str = str.replace(/\s+at\s+/g, " ");
    // Cheat:
    str = str.replace(/([AaPp])\.[Mm]\./g, (_, ap) => ap.toLowerCase() + 'm');
    // "0:xx a.m."? Really?
    str = str.replace(/\b0(:\d\d am)/g, (_, t) => "12" + t);
    // It's possible for the end time NOT to include the date. If we're given
    // the previous time and have no date component, use that.
    // dayjs has a bug where "MMM." is broken. Just remove it
    str = str.replace(/^([A-Za-z]{3})\./, '$1');
    this.log.verbose('Parsing time [%s]', str);
    // First try the verbose method
    let rv = dayjs.utc(str, 'MMMM D, YYYY h:mm a', true);
    if (!rv.isValid()) {
      // Apparently "MMMM D, YYYY, h:mm a" is also used. Sometimes.
      rv = dayjs.utc(str, 'MMMM D, YYYY, h:mm a', true);
    }
    if (!rv.isValid()) {
      rv = dayjs.utc(str, 'MMM D, YYYY h:mm a', true);
    }
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
   * Wrapper around the actual fetch method. This may (eventually) be used to
   * delay multiple loads.
   * @param input the URL to load
   * @returns
   */
  fetch(input: string | URL): Promise<Response> {
    const now = new Date().valueOf();
    if (now < this.nextFetchTime) {
      // Wait before resolving
      return new Promise<Response>((resolve) => {
        setTimeout(() => {
          this.nextFetchTime = new Date().valueOf() + 1000;
          resolve(fetch(input));
        }, this.nextFetchTime - now);
      });
    } else {
      this.nextFetchTime = now + 1000;
      return fetch(input);
    }
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
    const response = await this.fetch(this.lodestoneURL);
    if (response.status === 200) {
      let urls: Set<string>;
      try {
        urls = this.scrapeLodestone(await response.text(), skipScrapingBefore);
      } catch (ex) {
        this.log.error("Unable to parse Lodestone: " + ex);
        throw ex;
      }
      // Set the last loaded time to be the time when this request started
      this.lastLoadedAt = now.valueOf();
      const timers: LodestoneTimer[] = [];
      // Iterate through found links
      this.log.info('Found %s URL%s to check.', urls.size, urls.size === 1 ? '' : 's');
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

  scrapeLodestone(html: string, skipBefore?: number): Set<string> {
    const links = new Set<string>();
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
            if (links.has(href)) {
              this.log.warn("Link %s found twice (or more)", href);
            } else {
              links.add(href);
              this.log.verbose('Adding "%s"', href);
            }
          }
        } else {
          this.log.verbose('Unable to locate time for "%s": not following.', name);
        }
      }
    });
    $('li.ic__topics--list').each((i, e) => {
      // Try and determine if this event is worth following.
      const item = $(e);
      // Try and get the link
      const href = item.find("p.news__list--title a").attr("href");
      if (href === undefined) {
        // Skip this if there's no link
        return;
      }
      const text = item.text();
      if (KNOWN_EVENTS.some((event) => event.pattern.test(text))) {
        // Looks like it is, add it to the list
        this.log.verbose('Adding event URL %s', href);
        links.add(href);
      }
    });
    return links;
  }

  async loadPost(postURL: string): Promise<LodestoneTimer | null> {
    const cachedResult = this.cache.get(postURL);
    if (cachedResult && cachedResult.loadedAt > (new Date().getTime() - this.refetchAfter)) {
      this.log.verbose('Using cached entry for "%s"...', postURL);
      return Promise.resolve(cachedResult);
    }
    this.log.info("Pulling %s...", postURL);
    const response = await this.fetch(postURL);
    if (response.status == 200) {
      let timer = await this.parsePost(await response.text(), postURL);
      if (timer == null) {
        this.log.error("Unable to parse post.");
      } else {
        this.log.info("Generated a " + timer.type + " timer");
      }
      return timer;
    } else {
      throw new Error(`Error response from server: ${response.status} ${response.statusText}`);
    }
  }

  async parsePost(html: string, postURL: string): Promise<LodestoneTimer | null> {
    const $ = cheerio.load(html);
    const title = $('header.news__header > h1');
    let tag = title.find('.news__header__tag').text().toLowerCase();
    tag = tag.replace(/^\s*\[\s*|\s*\]\s*$/g, '');
    // Remove the maintenance tag
    title.find('.news__header__tag').remove();
    const post = $('div.news__detail__wrapper').text();
    let m = /\[\s*Date\s+&(?:amp)?;?\s+Time\s*\]\s*\r?\n?\s*(?:From\s+)?(.*)\s+to\s+(.*?)\s*(?:\((\w+)\))?\r?\n/.exec(post);
    if (m) {
      if (m[3] === undefined) {
        this.log.error("No timezone given for event! Defaulting to %s", this.defaultTimezone);
      }
      this.log.verbose("Found event time %s to %s (TZ %s)", m[1], m[2], m[3] ?? 'not defined, using default');
      const times = this.parseTime(m[1], m[2], undefined, m[3]);
      if (times === null) {
        this.log.error("Unable to parse times in post.");
        return null;
      }
      const [start, end] = times;
      const titleStr = title.text().trim();
      let name = '<a href="' + postURL + '">' + titleStr + '</a>';
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
      // If no times were found, this may be an event time, and we may need to load another post
      const titleStr = title.text().trim();
        // Check the article title for the event
      let event = KNOWN_EVENTS.find((event) => event.pattern.test(titleStr));
      if (event === undefined) {
        // If nothing, see if it's mentioned in the post text
        event = KNOWN_EVENTS.find((event) => event.pattern.test(post));
      }
      if (event === undefined) {
        this.log.verbose("Did not find any maintenance times and post did not match any known event.");
        this.log.verbose('Event title: %s', titleStr);
        this.log.verbose('Event description: %s', post);
        return null;
      }
      // In this case, find the link
      const href = $('div.news__detail__wrapper a').attr('href');
      if (href === undefined) {
        this.log.verbose("Did not find a link for %s.", event.name);
        return null;
      }
      // Load the link
      const eventUrl = new URL(href, this.lodestoneURL);
      this.log.verbose("Fetching event details page %s", eventUrl.toString());
      const resp = await this.fetch(eventUrl);
      if (resp.ok) {
        const eventPage = cheerio.load(await resp.text());
        const eventText = eventPage("div.content__span").text();
        let m = /(?:From\s+)(?:\w+day,\s+)?(.*?)(?:\s*\((\w+)\))?\s*to\s+(?:\w+day,\s+)?(.*?)\s*\((\w+)\)/.exec(eventText);
        if (m) {
          this.log.verbose("Found event time %s to %s (TZ %s to TZ %s)", m[1], m[3], m[2], m[4]);
          const times = this.parseTime(m[1], m[3], m[2], m[4]);
          if (times != null) {
            const [start, end] = times;
            return {
              name: `<a href="${new URL(resp.url, this.lodestoneURL)}">${event.name}</a>`,
              sourceURL: postURL,
              type: event.type,
              start: start.valueOf(),
              end: end.valueOf(),
              // For debuggin (mostly) keep the text versions
              startText: start.format(),
              endText: end.format(),
              loadedAt: new Date().getTime()
            }
          }
        } else {
          this.log.verbose("Unable to parse event.");
          return null;
        }
      }
      this.log.verbose("Did not find times for %s.", event.name);
      return null;
    }
  }

  parseTime(start: string, end: string, startTZ: string | undefined, endTZ: string | undefined): [dayjs.Dayjs, dayjs.Dayjs] | null {
    let startTime = this.parseLodestoneDate(start),
        endTime = this.parseLodestoneDate(end, startTime);
    // Look up the official end time zone name, defaulting to the endTZ if not
    // in the list, defaulting to the default timezone if no timezone is
    // given.
    endTZ = endTZ ? (TIMEZONES.get(endTZ) ?? endTZ) : this.defaultTimezone;
    // Look up the official start time zone name if a start time zone was
    // given, otherwise use what was given; if no start timezone, use the end
    // timezone from above.
    startTZ = startTZ ? (TIMEZONES.get(startTZ) ?? startTZ) : endTZ;
    // Apply time zones (true meaning "treat existing as local time")
    endTime = endTime.tz(endTZ, true);
    startTime = startTime.tz(startTZ ?? endTZ, true);
    this.log.verbose('With timezone times are now %s, %s (UTC %s, %s)', startTime.format(), endTime.format(), startTime.utc().toISOString(), endTime.utc().toISOString());
    return [startTime, endTime];
  }
}

export default LodestoneScraper;