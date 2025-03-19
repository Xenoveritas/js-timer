/**
 * Build tools by handling file system operations directly.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { buildTimersJson, compileTimers } from './lodestone-tool.mjs';
import { DEFAULT_OPTIONS as DEFAULT_LODESTONE_OPTIONS, LodestoneScraperOptions, TimerCache } from './scrape-lodestone.mjs';
import Logger from './logger.mjs';

const log = new Logger('lodestone');

export type LodestoneScraperCLIOptions = Omit<LodestoneScraperOptions, 'cache'> & { cache: string | null | undefined | false };

export interface LodestoneToolCLIOptions {
  sort: boolean;
  stripUnusedFields: boolean;
  crush: boolean;
  oldest: number;
  lodestone: LodestoneScraperCLIOptions | null | false;
}

export type PartialLodestoneToolCLIOptions = Partial<Omit<LodestoneToolCLIOptions, 'lodestone'>> & { lodestone?: Partial<LodestoneScraperCLIOptions> | null | false };

async function loadLodestoneOptions(options: PartialLodestoneToolCLIOptions["lodestone"] | undefined): Promise<LodestoneScraperOptions | false> {
  // If the lodestone options are explicitly disabled, return false.
  if (options === null || options === false) {
    return false;
  }
  // If they're undefined, return the default options
  if (options === undefined) {
    return DEFAULT_LODESTONE_OPTIONS;
  }
  // Otherwise, we may need to load the cache
  let cache: LodestoneScraperOptions["cache"] = null;
  if (typeof options.cache === 'string') {
    log.verbose('Loading cache from %s...', options.cache);
    try {
      cache = JSON.parse(await fs.readFile(options.cache, { encoding: 'utf8' })) as TimerCache;
    } catch (e) {
      // Ignore the error if the cache doesn't exist
      if (typeof e !== 'object' || e?.code !== 'ENOENT') {
        throw e;
      }
      log.verbose('Cache file did not exist, cache is empty.');
    }
  }
  return { ...DEFAULT_LODESTONE_OPTIONS, ...options, cache };
}

/**
 * Runs the tool.
 */
export default async function lodestoneTool(timersJsonPath: string, outputPath: string, options?: PartialLodestoneToolCLIOptions): Promise<void> {
  // First, load the timer data, if any
  const timersJson = JSON.parse(await fs.readFile(timersJsonPath, { encoding: 'utf8' }));
  const cachePath = typeof options?.lodestone === 'object' && options.lodestone?.cache;
  const lodestoneOpts = await loadLodestoneOptions(options?.lodestone);
  const toolOpts = { ...options, lodestone: lodestoneOpts };
  const result = await compileTimers(timersJson, toolOpts);
  log.verbose('Writing %s...', outputPath);
  // Write the result
  // Make sure the directory exists
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buildTimersJson(result.timers, toolOpts), { encoding: 'utf8' });
  if (cachePath) {
    // Write the cache back out
    // Make sure the directory exists
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify(result.cache), { encoding: 'utf8' });
  }
}
