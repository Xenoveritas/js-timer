/**
 * A module for creating timers. The core module is simply a constructor that
 * provides a method of receiving a notification roughly every second.
 * @module timer
 */

(function (root, factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define([], factory);
	} else if (typeof module === 'object' && module.exports) {
		// Node. Does not work with strict CommonJS, but
		// only CommonJS-like environments that support module.exports,
		// like Node.
		module.exports = factory();
	} else {
		// Browser globals (root is window)
		root.Timer = factory();
	}
}(this, function () {

/**
 * Very basic timer function that receives notifications every second.
 * Override ontick to receive the notification.
 * @constructor
 * @alias module:timer
 */
function Timer() {
	this.timeout = false;
}

Timer.prototype = {
	/**
	 * Start the timer.
	 */
	start: function() {
		if (this.timeout === false) {
			var me = this;
			me.timeout = 1;
			function tick() {
				var now = new Date();
				// Round now up, as the timeout may be called slightly early.
				var t = now.getTime() + 500;
				// And chop off the uneven milliseconds - useful for countdown
				// timers.
				t -= t % 1000;
				now.setTime(t);
				me.ontick(now);
				var next = 1000 - (new Date().getTime() % 1000);
				if (next < 50) {
					// If it's really close, just jump to the next second, as we'll
					// have "rounded" to this second anyway.
					next += 1000;
				}
				// We need to check if we're still going, as stop() may have
				// stopped the timeout.
				if (me.timeout !== false)
					me.timeout = setTimeout(tick, next);
			}
			tick();
		}
	},
	/**
	 * Stop the timer.
	 */
	stop: function() {
		if (this.timeout !== false) {
			clearTimeout(this.timeout);
			this.timeout = false;
		}
	},
	/**
	 * Called once a second with the current time. (Note: the Date object given
	 * will have a different time from the one given by <code>new Date()</code>,
	 * as the time when ontick is called may not be exactly on the second. By
	 * using the given date, the timer will update "close enough" to the correct
	 * second.)
	 * @param date {Date} the current time.
	 */
	ontick: function(date) {
	}
};

/**
 * Utility function to 0-pad a two-digit number, since this comes up so often.
 */
Timer.zeropad = function(d) {
	return d < 10 ? '0' + d : d.toString();
}

/**
 * Returns an interval between two dates.
 *
 * @param {Date} firstDate the first date
 * @param {Date} secondDate the second date
 * @return {Timer.Interval} interval between the two.
 */
Timer.difference = function(firstDate, secondDate) {
	if (firstDate instanceof Date)
		firstDate = firstDate.getTime();
	if (secondDate instanceof Date)
		secondDate = secondDate.getTime();
	return new Timer.Interval(firstDate - secondDate);
}

/**
 * An interval of time - sort of like a `Date()` but for different
 * periods of time. Given a number of milliseconds, this calculates the number
 * of weeks, days, hours, minutes, and seconds between the two. Useful for
 * creating a countdown to a given time.
 * @constructor
 * @param {Number} interval
 *         the initial interval in milliseconds
 */
Timer.Interval = function(interval) {
	// Step 0: Deal with negative intervals. Intervals only make sense using
	// positive numbers, but include a flag if it's in the past.
	/**
	 * Indicates that the interval occurred in the past.
	 */
	this.isInPast = interval < 0;
	// And make it absolute.
	interval = Math.abs(interval);
	// Step 1: convert to seconds.
	var t = Math.floor(interval / 1000); // 1000 ms = 1 seconds

	/**
	 * The number of milliseconds in the interval. For a 1500ms interval, this
	 * is 500. This is almost never useful but is included anyway.
	 */
	this.millis = (interval - (t * 1000));
	/**
	 * The number of seconds in the interval. For a 90 second interval, this is
	 * 30.
	 */
	this.seconds = t % 60; // 60 seconds = 1 minute
	t = Math.floor(t / 60);
	/**
	 * The number of minutes in the interval. For a 90 minute interval, this is
	 * 30.
	 */
	this.minutes = t % 60; // 60 minutes = 1 hour
	t = Math.floor(t / 60);
	/**
	 * The number of hours in the interval. For a 1.5 day interval, this is 12.
	 */
	this.hours = t % 24; // 24 hours = 1 day
	t = Math.floor(t / 24);
	/**
	 * The number of days in the interval. For a 10 day interval, this is 3 and
	 * {@linkcode module:timer.Interval#weeks weeks} will be 1.
	 */
	this.days = t % 7; // 7 days = 1 week
	/**
	 * The number of weeks in the interval. There are no larger spans of time
	 * calculated at present. Months make no sense at this level: how long is a
	 * month? 28 days? Depends on when the interval starts? Years may be added
	 * in the future, but years have a similar problem: How long is a year?
	 * 365 days? What about leap years?
	 */
	this.weeks = Math.floor(t / 7); // And enough
};

Timer.Interval.prototype.toString = function() {
	return '[' + this.weeks + ' weeks ' + this.days + ' days ' + this.hours +
		' hours ' + this.minutes + ' minutes ' + this.seconds + ' seconds]';
}

return Timer;
}));
