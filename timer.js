/**
 * Very basic timer function that receives notifications every second.
 * Override ontick to receive the notification.
 * @constructor Create a new initially stopped timer.
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
 * An interval of time - sort of like a <code>Date()</code> but for different
 * periods of time.
 * @constructor Create a new interval.
 * @param interval the initial interval in milliseconds
 */
Timer.Interval = function(interval) {
	// Step 1: convert to seconds.
	var t = Math.floor(interval / 1000); // 1000 ms = 1 seconds
	this.seconds = t % 60; // 60 seconds = 1 minute
	t = Math.floor(t / 60);
	this.minutes = t % 60; // 60 minutes = 1 hour
	t = Math.floor(t / 60);
	this.hours = t % 24; // 24 hours = 1 day
	t = Math.floor(t / 24);
	this.days = t % 7; // 7 days = 1 week
	this.weeks = Math.floor(t / 7); // And enough
};

Timer.Interval.prototype.toString = function() {
	return '[' + this.weeks + ' weeks ' + this.days + ' days ' + this.hours +
		' hours ' + this.minutes + ' minutes ' + this.seconds + ' seconds]';
}
