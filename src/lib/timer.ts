import { format } from 'util';

/**
 * The core shared Timer fields.
 */
export interface BaseTimer {
  name?: string;
  type?: string;
  showDuration?: boolean;
  info?: string;
  note?: string;
  endLabel?: string;
  indefinite?: boolean;
}

/**
 * A timer as read from JSON.
 */
export interface ProtoTimer extends BaseTimer {
  name: string;
  type: string;
  start: number | string;
  end: number | string;
  subtimers?: ProtoTimer[];
};

export interface Timer extends BaseTimer {
  title?: string,
  href?: string,
  start: number,
  end?: number,
  startText?: string,
  endText?: string,
  subtimers?: Timer[]
};

function convertDate(date: string): number {
  return Date.parse(date);
}

export function isTimer(o: unknown): o is Timer {
  if (typeof o !== 'object' || o === null)
    return false;
  const obj = o as Record<string, unknown>;
  return typeof o['start'] === 'number' && (typeof o['end'] === 'number' || typeof o['end'] === 'undefined');
}

/**
 * Given an input timer definition, converts any fields as necessary (basically
 * parse the start/end dates if they're strings and convert them to UNIX-style
 * time-stamps). If the dates can't be converted, this raises an exception.
 */
export function convertTimer(timer: ProtoTimer): Timer {
  if (typeof timer.start === 'string') {
    timer.start = convertDate(timer.start);
  }
  if (typeof timer.end === 'string') {
    timer.end = convertDate(timer.end);
  }
  if (isTimer(timer)) {
    const resultTimer = timer as Timer;
    const subtimers = timer['subtimers'];
    if (Array.isArray(subtimers)) {
      resultTimer.subtimers = timer.subtimers.map((subtimer) => convertTimer(subtimer));
    }
    return resultTimer;
  } else {
    throw new Error(format('Invalid timer object: %j', timer));
  }
}


export default Timer;