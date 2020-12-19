import Timer, { ProtoTimer, convertTimer } from './timer';

/**
 * The set of fields the timer cares about and that should survive
 * JSON-crushing. Note that this does NOT include the "subtimers" field as
 * that's only valid on the top-level field.
 */
const TIMER_FIELDS = new Set<string>(["start", "end", "name", "type", "showDuration", "info", "note", "endLabel"]);

/**
 * Strips any field out of the timer that isn't used by the actual timer code.
 */
export function stripIgnoredFields(timer: Timer, allowSubtimer = true): void {
  // We want to pull the keys and delete them while iterating over them, so:
  const keys = Object.keys(timer);
  keys.forEach(function(key) {
    if (!TIMER_FIELDS.has(key)) {
      if (key === 'subtimers' && allowSubtimer) {
        // We actually want to recurse into this.
        if (Array.isArray(timer['subtimers'])) {
          timer['subtimers'].forEach(function(subtimer) {
            // Subtimers aren't allowed on subtimers. You can only nest once.
            stripIgnoredFields(subtimer, false);
          });
        }
        return;
      }
      // Otherwise, delete it.
      delete timer[key];
    }
  });
}

/**
 * Determines if a timer is past the given oldest time.
 * @param timer the timer to check
 * @param oldest the oldest timer that should be kept
 */
function isTimerOld(timer: Timer, oldest: number): boolean {
  // If the end time is after oldest, it is definitely not old
  if ('end' in timer && timer.end > oldest) {
    return false;
  }
  // If the start time is after the oldest, it is definitely not old
  if ('start' in timer && timer.start > oldest) {
    return false;
  }
  // Otherwise, if the timer is marked indefinite, it can never be too old
  return timer.indefinite === true;
}

export function parseTimers(json: unknown, oldest: number): Timer[] {
  const timers: Timer[] = [];
  // Fairly simple: just merge the timer data as necessary.
  let ts: ProtoTimer[];
  if (Array.isArray(json)) {
    ts = json;
  } else if (typeof json === 'object' && Array.isArray(json['timers'])) {
    ts = json['timers'];
  } else {
    throw new Error("Invalid JSON object given");
  }
  ts.forEach(function(timerDef) {
    const timer = convertTimer(timerDef);
    // Exclude timers that are too old:
    if (!isTimerOld(timer, oldest)) {
      timers.push(timer);
    }
  });
  return timers;
}
