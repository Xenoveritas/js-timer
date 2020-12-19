/**
 * Loader that will scrape the Lodestone, potentially ignoring timers, and
 * generate a new JSON file that contains the timers within them.
 */

import { getOptions } from 'loader-utils';
import * as moment from 'moment';
import Timer, { ProtoTimer } from '../lib/timer';
import { loadLodestone, setLogs } from '../lib/scrape-lodestone';

interface LodestoneOptions {
  scrapeTimeLimit: moment.Duration;
  timeLimit: moment.Duration;
  cacheTime: moment.Duration;
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

export default function loader(source: string) {
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
  }
  const callback = this.async();

  // Grab whatever configuration we can from the source we're given
  const data = JSON.parse(source);
  const existingTimers: ProtoTimer[] = typeof data === 'object' && data !== null && Array.isArray(data['timers']) ? data['timers'] : [];

  // try {
  //   var stats = fs.statSync(dest);
  //   // See if this is recent
  //   if (stats.mtime.getTime() + options.cacheTime > new Date().getTime()) {
  //     grunt.log.ok("Skipping " + dest + ": still within cache time.");
  //     return;
  //   }
  // } catch (ex) {
  //   // If the file doesn't exist, we don't care
  //   if (ex.code !== 'ENOENT') {
  //     grunt.log.errorlns("Error checking destination \"" + dest + "\": " + ex);
  //   }
  // }
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

  loadLodestone(options.url, skipScrapeBefore, skipTimerBefore, ignoredURLs).then((timers) => {
    console.log("Kept %d timer%s after removing old timers.", timers.length, timers.length === 1 ? '' : 's');
    const result: Array<Timer | ProtoTimer> = existingTimers;
    callback(null, JSON.stringify({ timers: result.concat(timers) }, null, 2));
  }).catch(callback);
}
