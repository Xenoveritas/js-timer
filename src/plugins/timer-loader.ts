/**
 * Loads and crushes the timer data, doing the final set of preparations before output.
 */

import { getOptions } from 'loader-utils';
import crushJSON from '../lib/crush-json';
import * as moment from 'moment';
import { stripIgnoredFields, parseTimers } from '../lib/parse-timer';

export default function compile(source) {
  const webpackOptions = getOptions(this);
  let sort = true, stripUnusedFields = true, crush = true, oldest = moment.duration(1, 'day');
  if (typeof webpackOptions === 'object' && webpackOptions !== null) {
    if (typeof webpackOptions.sort === 'boolean')
      sort = webpackOptions.sort;
    if (typeof webpackOptions.stripUnusedFields === 'boolean')
      stripUnusedFields = webpackOptions.stripUnusedFields;
    if (typeof webpackOptions.crush === 'boolean')
      crush = webpackOptions.crush;
    if (typeof webpackOptions.oldest === 'string') {
      oldest = moment.duration(webpackOptions.oldest);
    }
  }
  const timers = parseTimers(JSON.parse(source), new Date().getTime() - oldest.asMilliseconds());
  if (sort) {
    // Sort the timers by start time before writing them. Earlier timers
    // should be higher on the list.
    timers.sort(function(a,b) {
      var d = a['start'] - b['start'];
      if (d != 0)
        return d;
      // Sort by title instead.
      if ('title' in a && 'title' in b) {
        return a['title'] < b['title'] ? -1 : (a['title'] == b['title'] ? 0 : 1);
      } else {
        // Otherwise, sort by the name field.
        return a['name'] < b['name'] ? -1 : (a['name'] == b['name'] ? 0 : 1);
      }
    });
  }
  if (stripUnusedFields) {
    timers.forEach((timer) => { stripIgnoredFields(timer); });
  }
  return crushJSON({timers: timers});
}

