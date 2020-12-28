/**
 * A module for creating clocks. The core module is simply a constructor that
 * provides a method of receiving a notification roughly every second.
 * @module clock
 */

// There is no integer type, so create one for documentation purposes
type integer = number;

/**
 * An interval of time - sort of like a `Date()` but for different
 * periods of time. Given a number of milliseconds, this calculates the number
 * of weeks, days, hours, minutes, and seconds between the two. Useful for
 * creating a countdown to a given time.
 */
export class Interval {
	/**
	 * Indicates that the interval occurred in the past.
	 */
	isInPast: boolean;
	/**
	 * The number of weeks in the interval. There are no larger spans of time
	 * calculated at present. Months make no sense at this level: how long is a
	 * month? 28 days? Depends on when the interval starts? Years may be added
	 * in the future, but years have a similar problem: How long is a year?
	 * 365 days? What about leap years?
	 */
	weeks: integer = 0;
	/**
	 * The number of days in the interval. For a 10 day interval, this is 3 and
	 * {@linkcode module:timer.Interval#weeks weeks} will be 1.
	 */
	days: integer = 0;
	/**
	 * The number of hours in the interval. For a 1.5 day interval, this is 12.
	 */
	hours: integer = 0;
	/**
	 * The number of minutes in the interval. For a 90 minute interval, this is
	 * 30.
	 */
	minutes: integer = 0;
	/**
	 * The number of milliseconds in the interval. For a 1500ms interval, this
	 * is 500. This is almost never useful but is included anyway.
	 */
	millis: integer;
	/**
	 * The number of seconds in the interval. For a 90 second interval, this is
	 * 30.
	 */
	seconds: integer = 0;
	/**
	 * 
	 * @param {Number} interval
	 *         the initial interval in milliseconds
	 * @param {integer|boolean} periods
	 *         number of periods to split the interval into. Defaults to 5:
	 *         include weeks, days, hours, minutes, seconds. Milliseconds is always
	 *         included and values less than 1 are treated as seconds. Decrease
	 *         to reduce the number of fields in that order: 4 omits weeks,
	 *         3 will only return hours, minute, and seconds, etc. `false`
	 *         can be used as a "shortcut" for 4 to treat the parameter as
	 *         "include weeks". Note that the fields not calculated will still be
	 *         present, they'll just be set to 0.
	 */
	constructor(interval: number, periods?: number | boolean) {
		if (arguments.length < 2 || periods === true) {
			periods = 5;
		} else if (periods === false) {
			periods = 4;
		}
		// Step 0: Deal with negative intervals. Intervals only make sense using
		// positive numbers, but include a flag if it's in the past.
		this.isInPast = interval < 0;
		// And make it absolute.
		interval = Math.abs(interval);
		// Step 1: convert to seconds.
		let t = Math.floor(interval / 1000); // 1000 ms = 1 seconds
		this.millis = (interval - (t * 1000));
		if (periods < 2) {
			this.seconds = t;
			return;
		}
		this.seconds = t % 60; // 60 seconds = 1 minute
		t = Math.floor(t / 60);
		if (periods < 3) {
			this.minutes = t;
			return;
		}
		this.minutes = t % 60; // 60 minutes = 1 hour
		t = Math.floor(t / 60);
		if (periods < 4) {
			this.hours = t;
			return;
		}
		this.hours = t % 24; // 24 hours = 1 day
		t = Math.floor(t / 24);
		if (periods < 5) {
			this.days = t;
			return;
		}
		this.days = t % 7; // 7 days = 1 week
		this.weeks = Math.floor(t / 7); // And enough
	}
	toString(): string {
		return '[' + this.weeks + ' weeks ' + this.days + ' days ' + this.hours +
			' hours ' + this.minutes + ' minutes ' + this.seconds + ' seconds]';
	}
};

/**
 * Very basic clock object that receives tick notifications ever second.
 * Override ontick to receive the notification.
 * @constructor
 * @alias module:clock
 */
export class Clock {
	timeout: number | boolean = false;
	/**
	 * The offset in milliseconds from real time to use to send to the clock. This
	 * can be used if you want to make a clock that displays ticks based on when
	 * a user clicked the button (by setting it to the number of milliseconds off
	 * the second) or to make a clock that displays a certain amount of time in
	 * the future or past. Changing this will take effect on the *next* tick.
	 *
	 * The offset is added to the time - positive offsets move the values given by
	 * {@link module:clock#ontick ontick()} into the future, negative values move
	 * it into the past.
	 *
	 * Changing this enough to make a tick appear in the past will also trigger an
	 * {@link module:clock#onbackwards onbackwards()} call, just as if the clock
	 * had moved backwards due to external causes.
	 */
	offset = 0;
	/**
	 * Whether or not the clock is still running.
	 *
	 * If set, starts or stops the clock by using
	 * {@link module:clock#start start()} or {@link module:clock#stop stop()} as
	 * appropriate.
	 */
	get running(): boolean {
		return this.timeout !== false;
	}
	set running(value: boolean) {
		if (value) {
			this.start();
		} else {
			this.stop();
		}
	}
	/**
	 * Start the clock. {@link module:clock#ontick ontick()} will be invoked
	 * nearly immediately with the current time and then invoked every second.
	 */
	start(): void {
		if (this.timeout === false) {
			// I suppose lastTime could also be set to 0 on the assumption that no one
			// is going to be running with a clock set to 1970 Jan 1, but... whatever.
			// Go ahead and support weird time travelers.
			let lastTime = new Date().getTime() - 1000;
			this.timeout = true;
			const tick = () => {
				var now = new Date();
				// Round now up, as the timeout may be called slightly early.
				var t = now.getTime() + this.offset + 500;
				// And chop off the uneven milliseconds - useful for countdown
				// timers.
				t -= t % 1000;
				now.setTime(t);
				if (t < lastTime) {
					// Clock has run backwards.
					this.onbackwards(now);
				}
				lastTime = t;
				this.ontick(now);
				var next = 1000 - ((new Date().getTime() + this.offset) % 1000);
				if (next < 50) {
					// If it's really close, just jump to the next second, as we'll
					// have "rounded" to this second anyway.
					next += 1000;
				}
				// We need to check if we're still going, as stop() may have
				// stopped the timeout.
				if (this.timeout !== false)
					this.timeout = window.setTimeout(tick, next);
			}
			tick();
		}
	}
	/**
	 * Stops the clock. No further {@link module:clock#ontick ontick()}s will
	 * be called until the clock is restarted using
	 * {@linkcode module:clock#start start()}.
	 */
	stop(): void {
		if (this.timeout !== false) {
			// Timeout may be true if the clock was started but instantly stopped in ontick.
			if (typeof this.timeout === 'number')
				clearTimeout(this.timeout);
			this.timeout = false;
		}
	}
	/**
	 * Called once a second with the current time.
	 *
	 * Note that the `Date` object given is the time that the clock is being
	 * "ticked" for, and is **not** going to be the exact same time that
	 * `new Date()` would generate. This is because JavaScript engines may call a
	 * callback set by `setTimeout()` or `setInterval()` slightly early or
	 * slightly late. This class deals with that by rounding to the nearest
	 * second and then passing that rounded time to this function.
	 *
	 * If {@link module:clock#offset} is non-zero, the `Date` given will be
	 * adjusted by that.
	 *
	 * The default implementation does nothing.
	 *
	 * @param date {Date} the current time.
	 */
	ontick(date: Date): void {
		// Stub method: does nothing
	}
	/**
	 * Generally speaking it can be assumed that ticks will only ever increase the
	 * current time. This does not need to be true: it is possible for the clock
	 * to run "backwards." The most likely cause is the clock being fast and the
	 * user correcting it or the clock be synced to an NTP server.
	 *
	 * Changing over to Daylight Saving Time will **not** trigger this callback,
	 * it's only used when an {@link module:clock#ontick ontick()} would have
	 * triggered for an earlier time than a previous one.
	 *
	 * Not all clocks need to handle this case, however some clocks may be written
	 * in such a way that elements that happened "in the past" are removed and may
	 * suddenly be required again.
	 *
	 * The default implementation does nothing.
	 *
	 * @param date {Date} the current time, as would have been passed to
	 *   {@code ontick}.
	 */
	onbackwards(date: Date): void {
		// Stub method: does nothing
	}

	/**
	 * Utility function to 0-pad a two-digit number, since this comes up so often.
	 * This will only add a 0 in front of a single digit number and only works with
	 * positive numbers.
	 * @param {number} d digit
	 */
	static zeropad(d: number): string {
		return d < 10 ? '0' + d : d.toString();
	}

	/**
	 * Returns an interval between two dates.
	 *
	 * @param {Date} firstDate the first date
	 * @param {Date} secondDate the second date
	 * @return {Timer.Interval} interval between the two.
	 */
	static difference(firstDate, secondDate) {
		if (firstDate instanceof Date)
			firstDate = firstDate.getTime();
		if (secondDate instanceof Date)
			secondDate = secondDate.getTime();
		return new Interval(firstDate - secondDate);
	}

	static Interval = Interval;
}

export default Clock;
