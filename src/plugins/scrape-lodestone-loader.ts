/**
 * Loader that will scrape the Lodestone, potentially ignoring timers, and
 * generate a new JSON file that contains the timers within them.
 */

import { getOptions } from 'loader-utils';
import * as moment from 'moment';
import Timer, { ProtoTimer } from '../lib/timer';
import { LodestoneScraper, LodestoneTimer } from '../lib/scrape-lodestone';
import * as fs from 'fs';
import { debuglog } from 'util';

const verboseLog = debuglog('lodestone');

// Webpack is missing types for the loader interface, which is actually
// declared in loader-runner, which is also missing types. Yay!
type WebpackLoaderCallback = (error: Error | null, result?: Buffer | string) => void;

// Incomplete type to get just enough data to make things work
interface WebpackLoader {
  async: () => WebpackLoaderCallback;
  cacheable: (cacheable: boolean) => void;
  callback: () => WebpackLoaderCallback;
}

interface LodestoneOptions {
  scrapeTimeLimit: moment.Duration;
  timeLimit: moment.Duration;
  cacheTime: moment.Duration;
  cacheFile?: string;
  url: string;
  ignore: string[] | null;
}

function parseDuration(configuration: Record<string, unknown>, options: LodestoneOptions, key: string, defaultUnit: moment.unitOfTime.DurationConstructor = 'day'): void {
  if (key in configuration) {
    const value = configuration[key];
    if (typeof value === 'number') {
      options[key] = moment.duration(value, defaultUnit);
    }
  }
}

function loadCache(filename: string): Promise<LodestoneTimer[]> {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, { encoding: 'utf-8' }, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          verboseLog('No cache file %s, using empty cache', filename);
          // No cache file? Resovle as no timers
          resolve([]);
        } else {
          reject(err);
        }
      } else {
        try {
          const json = JSON.parse(data);
          if (Array.isArray(json)) {
            // In the future maybe there will be more data stored in the cache?
            verboseLog('Restored cache from %s', filename);
            resolve(json as LodestoneTimer[]);
          } else {
            reject(new Error('Invalid type in cache'));
          }
        } catch (ex) {
          reject(ex);
        }
      }
    })
  });
}

function saveCache(filename: string, timers: LodestoneTimer[]): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.writeFile(filename, JSON.stringify(timers), { encoding: 'utf-8' }, (err) => {
      if (err) {
        reject(err);
      } else {
        verboseLog('Saved cache to %s', filename);
        resolve();
      }
    })
  });
}

/**
 * The "real" function, used to ensure that the Promise is handled properly.
 * @param source the source data
 * @param options options
 * @param callback 
 */
export async function scrapeLodestone(source: string, options: LodestoneOptions): Promise<string> {
  // Grab whatever configuration we can from the source we're given
  const data = JSON.parse(source);
  const existingTimers: ProtoTimer[] = typeof data === 'object' && data !== null && Array.isArray(data['timers']) ? data['timers'] : [];
  let cache: LodestoneTimer[] | null = null;

  if (options.cacheFile) {
    // If we have a cache, go ahead and load that.
    try {
      cache = await loadCache(options.cacheFile);
    } catch (ex) {
      // This is fine
      console.error('Unable to restore cache: %o', ex);
    }
  }

  const skipScrapeBefore = new Date().getTime() - options.scrapeTimeLimit.asMilliseconds(),
    skipTimerBefore = new Date().getTime() - options.timeLimit.asMilliseconds();

  const ignoredURLs = Array.isArray(options.ignore) ? options.ignore : [];
  if (typeof data === 'object' && data !== null
    && typeof data.scrapeLoadstone === 'object' && data.scrapeLoadstone !== null
    && Array.isArray(typeof data.scrapeLoadstone.ignore)) {
    // Phew - merge in the ignore if we can
    data.scrapeLoadstone.ignore.forEach((url) => {
      if (typeof url === 'string')
        ignoredURLs.push(url);
    });
  }

  // Create the scraper
  const scraper = new LodestoneScraper({
    lodestoneURL: options.url,
    skipScrapeBefore: skipScrapeBefore,
    skipTimerBefore: skipTimerBefore,
    ignoredURLs: ignoredURLs,
    cache: cache
  });
  const timers = await scraper.loadLodestone();
  if (options.cacheFile) {
    // If we have a cache, go ahead and load that.
    try {
      await saveCache(options.cacheFile, scraper.cachedTimers());
    } catch (ex) {
      // This is fine
      console.error('Unable to save cache: %o', ex);
    }
  }
  // At this point, cache the timer result if we have a cache file set
  console.log("Kept %d timer%s after removing old timers.", timers.length, timers.length === 1 ? '' : 's');
  // This result object exists mostly to change the type for TypeScript
  const result: Array<Timer | ProtoTimer> = existingTimers;
  return JSON.stringify({ timers: result.concat(timers) }, null, 2);
}

export default function loader(this: WebpackLoader, source: string) {
  const webpackOptions = getOptions(this);
  const options: LodestoneOptions = {
    // Don't scrape any news item posted this number of millis before
    // You know what, if S-E is going to start posting patch notices THAT far
    // in advance...
    scrapeTimeLimit: moment.duration(1, 'month'),
    timeLimit: moment.duration(1, 'day'),
    cacheTime: moment.duration(1, 'hour'),
    url: "http://na.finalfantasyxiv.com/lodestone/",
    ignore: null
  };
  if (typeof webpackOptions === 'object') {
    parseDuration(webpackOptions, options, 'scrapeTimeLimit', 'day');
    parseDuration(webpackOptions, options, 'timeLimit', 'day');
    parseDuration(webpackOptions, options, 'cacheTime', 'minute');
    if (typeof webpackOptions['cacheFile'] === 'string') {
      options.cacheFile = webpackOptions['cacheFile'];
    }
  }
  // As this explicitly involves calling web resources, we are very not cacheable
  this.cacheable(false);
  const callback = this.async();

  scrapeLodestone(source, options).then((result) => callback(null, result), (error) => callback(error));
}
