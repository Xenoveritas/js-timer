/**
 * Loads and crushes the timer data, doing the final set of preparations before output.
 */

import { getOptions } from 'loader-utils';
import crushJSON from '../lib/crush-json.mjs';
import { stripIgnoredFields, parseTimers } from '../lib/parse-timer.mjs';

export default function compile(source) {
  const webpackOptions = getOptions(this);
  let sort = true, stripUnusedFields = true, crush = true;
  // Default to 1 day
  let oldest = 24 * 60 * 60 * 1000;
  if (typeof webpackOptions === 'object' && webpackOptions !== null) {
    if (typeof webpackOptions.sort === 'boolean')
      sort = webpackOptions.sort;
    if (typeof webpackOptions.stripUnusedFields === 'boolean')
      stripUnusedFields = webpackOptions.stripUnusedFields;
    if (typeof webpackOptions.crush === 'boolean')
      crush = webpackOptions.crush;
    // For now, only allow number of ms...
    if (typeof webpackOptions.oldest === 'number') {
      oldest = webpackOptions.oldest;
    }
  }
  const timers = parseTimers(JSON.parse(source), new Date().getTime() - oldest);
  if (sort) {
    // Sort the timers by start time before writing them. Earlier timers
    // should be higher on the list.
    timers.sort(function(a,b) {
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
  return crushJSON({timers: timers});
}

