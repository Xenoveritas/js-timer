/**
 * Handles the actual build process. Designed so that in theory it can be hooked into build tools.
 */

import crushJSON from './crush-json.mjs';
import { stripIgnoredFields, parseTimers } from './parse-timer.mjs';
import { Timer } from './timer.mjs';
import LodestoneScraper, { DEFAULT_OPTIONS as DEFAULT_LODESTONE_OPTIONS, LodestoneScraperOptions, TimerCache } from './scrape-lodestone.mjs';

export interface CompileTimerOptions {
  sort: boolean;
  stripUnusedFields: boolean;
  crush: boolean;
  oldest: number;
  lodestone: LodestoneScraperOptions | false;
}

export interface CompileTimerResults {
  timers: Timer[];
  cache?: TimerCache;
}

const DEFAULT_OPTIONS: CompileTimerOptions = {
  sort: true,
  stripUnusedFields: true,
  crush: true,
  oldest: 24*60*60*1000,
  lodestone: DEFAULT_LODESTONE_OPTIONS
};

/**
 * Compiles timers. Optionally loads timers from the Lodestone.
 * @param timersJson the JSON data describing timers
 * @returns 
 */
export async function compileTimers(timersJson: unknown, options?: Partial<CompileTimerOptions>): Promise<CompileTimerResults> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const timers = parseTimers(timersJson, new Date().getTime() - opts.oldest);
  const result: CompileTimerResults = {
    timers: timers
  };
  if (opts.lodestone) {
    const scraper = new LodestoneScraper(opts.lodestone);
    const lodestoneTimers = await scraper.loadLodestone();
    timers.push(...lodestoneTimers);
    result.cache = scraper.getCacheJSON();
  }
  if (opts.sort) {
    // Sort the timers by start time before writing them. Earlier timers
    // should be higher on the list.
    timers.sort(function (a, b) {
      const d = a['start'] - b['start'];
      if (d != 0)
        return d;
      // Sort by effective title instead (either the title field, if set, or the name field, if not)
      const aTitle = a.title ?? a.name ?? '', bTitle = b.title ?? b.name ?? '';
      return aTitle < bTitle ? -1 : (aTitle == bTitle ? 0 : 1);
    });
  }
  if (opts.stripUnusedFields) {
    timers.forEach((timer) => { stripIgnoredFields(timer); });
  }
  return result;
}

export function buildTimersJson(timers: Timer[], options?: Partial<CompileTimerOptions>): string {
  const json = { timers: timers };
  return (options?.crush ?? DEFAULT_OPTIONS.crush) ? crushJSON(json) : JSON.stringify(json, null, 2);
}

export default async function compileTimersJson(timersJson: unknown, options?: Partial<CompileTimerOptions>): Promise<string> {
  const timers = await compileTimers(timersJson, options);
  return buildTimersJson(timers.timers, options);
}