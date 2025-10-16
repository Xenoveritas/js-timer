/**
 * Vite plugin for loading timers from the Lodestone.
 */
import { FilterPattern, Plugin, createFilter } from 'vite';
import fs from 'fs/promises';
import path from 'path';

import crushJSON from '../lib/crush-json.mjs';
import { stripIgnoredFields, parseTimers } from '../lib/parse-timer.mjs';

export interface CompileTimerOptions {
  sort: boolean;
  stripUnusedFields: boolean;
  crush: boolean;
  oldest: number;
  /** Files to include. Defaults to ** / timers.json. */
  include: FilterPattern;
  exclude: FilterPattern;
}

function resolveId(id: string, baseDir: string): string {
  const resolved = path.resolve(id.startsWith('/') ? id : path.join(baseDir, id));
  const idx = resolved.indexOf('?');
  return idx >= 0 ? resolved.substring(0, idx) : resolved;
}

export default function compileTimers(options?: Partial<CompileTimerOptions>): Plugin {
  const sort = options?.sort ?? true;
  const stripUnusedFields = options?.stripUnusedFields ?? true;
  const crush = options?.crush ?? true;
  // Default to 1 day
  const oldest = options?.oldest ?? 24 * 60 * 60 * 1000;
  const include = options?.include ?? [ /^(.*[\\\/])?timers.json$/ ];
  const filter = createFilter(include, options?.exclude ?? []);
  let emitAssets = true;
  let assetDir = '';
  let baseDir = '';
  return {
    name: 'compile-timers',
    enforce: 'pre',
    configResolved(config) {
      emitAssets = config.command === 'build';
      assetDir = config.build.assetsDir;
      baseDir = config.envDir === false ? '' : config.envDir;
      // console.log('resolved config', config);
    },
    resolveId(id) {
      if (filter(id)) {
        console.log(`Resolved ${id} to virtual module`)
        return {
          id: '\0' + id + '+ffxivtimer',
          external: true
        }
      }
      return null;
    },
    async load(id) {
      // Ignore anything we don't handle
      const m = /^\0(.*)\+ffxivtimer$/.exec(id);
      if (!m) {
        return null;
      }
      const jsonPath = resolveId(m[1], baseDir);
      console.log(`Loading ${jsonPath}...`);
      // Resolve the id
      const src = await fs.readFile(jsonPath, { encoding: 'utf8' });
      const timers = parseTimers(JSON.parse(src), new Date().getTime() - oldest);
      if (sort) {
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
      if (stripUnusedFields) {
        timers.forEach((timer) => { stripIgnoredFields(timer); });
      }
      const code = crush ? crushJSON({ timers: timers }) : JSON.stringify(timers, null, 2);
      if (emitAssets) {
        console.log('Emitting asset...');
        const outputPath = path.join(assetDir, path.basename(id));
        this.emitFile({
          type: 'asset',
          fileName: outputPath,
          source: code
        });
        return {
          code: `export default new URL(${JSON.stringify(outputPath)}).href`
        }
      }
      console.log('Emitting parsed code...');
      return {
        code: `export default ${code}`
      };
    }
  }
}

