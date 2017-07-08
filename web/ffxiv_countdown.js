/**
 * Module for showing countdown timers to events in FFXIV, or recurring events
 * like when various resets are.
 * @module ffxiv_countdown
 */
define(['clock'], function(Clock) {

/**
 * FFXIV countdown object.
 * @constructor
 * @alias module:ffxiv_countdown
 * @param {Element} container
 *   the DOM object to place the generated HTML timers in
 * @param {Object|String} timers
 *   if an object, the JSON object describing the timers; if a string, a URL
 *   that will be fetched containing the JSON object describing the timers
 * @param {Boolean} addBuiltins
 *   when `true` (the default), adds the set of builtin timers defined in
 *   {@link module:ffxiv_countdown.builtins FFXIVCountdown.builtins}
 * @param {Boolean} showWeeks
 *   when `true`, show weeks instead of just days
 */
function FFXIVCountdown(container, timers, addBuiltins, showWeeks) {
	if (arguments.length < 2) {
		timers = [];
	}
	if (arguments.length < 3)
		addBuiltins = true;
	if (arguments.length < 4)
		showWeeks = false;
	this.container = container;
	this.addBuiltins = addBuiltins;
	this.showWeeks = showWeeks;
	if (typeof timers == 'string') {
		// Assume it's a URL and try and pull it using AJAX
		this.load(timers);
	} else {
		this._init(timers);
	}
}

/**
 * Maximum age (in milliseconds) before a timer won't be shown any more.
 */
FFXIVCountdown.MAX_TIMER_AGE = (24*60*60*1000);

/**
 * Global array of "built-in" timers. By default this is empty. To populate it
 * with actual builtins, require the
 * {@link module:ffxiv_builtins ffxiv_builtins} module.
 */
FFXIVCountdown.builtins = [];

FFXIVCountdown.prototype = {
	/**
	 * Reload timers from the initial URL if there was one or a NO-OP if
	 * there wasn't.
	 */
	reload: function() {
		if (this.updateURL) {
			this.load(this.updateURL);
		}
	},
	/**
	 * Load timers from the given URL. When constructed with a URL, this is called
	 * automatically.
	 */
	load: function(url) {
		this.updateURL = url;
		var xhr = new XMLHttpRequest();
		var me = this;
		// Firefox will indefinitely cache the JSON file, even though the server
		// is configured to require it to revalidate. Because... who cares.
		// Add junk to the end of the URL to force Firefox to treat it like a
		// new document and clutter up the caches of browsers that pay attention
		// to "Cache-Control: must-revalidate"
		url = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'v=' + Math.floor(new Date().getTime() / 3600000).toString(36);
		try {
			xhr.open("GET", url);
			xhr.onreadystatechange = function() {
				if (xhr.readyState == 4) {
					// All set.
					var timers = xhr.response;
					if (typeof timers == 'string') {
						// avoid infinite recursion and re-sending things
						try {
							timers = JSON.parse(timers);
						} catch (ex) {
							error("Unable to parse timer data.");
							console.log(xhr.response);
							return;
						}
					}
					if (typeof timers != 'object') {
						error("Unable to parse timer data (bad JSON type).");
						console.log(xhr.response);
						return;
					}
					if (!'timers' in timers) {
						error("No timers present in data sent from server.");
						console.log(xhr.response);
						return;
					}
					me._init(timers['timers']);
				}
			}
			xhr.responseType = "json";
			xhr.send(null);
		} catch (ex) {
			error('Unable to load timer data: ' + ex.toString());
			// In this case, go ahead and do the built-ins
			me._init([]);
		}
		function error(message) {
			console.log(message);
			me.container.appendChild(me.makeError(message));
		}
	},
	/**
	 * An internal method to constuct the actual UI.
	 * @private
	 */
	_init: function(timers) {
		if (this.addBuiltins) {
			Array.prototype.push.apply(timers, FFXIVCountdown.builtins);
		}
		var now = new Date().getTime(), skipTimersBefore = now - FFXIVCountdown.MAX_TIMER_AGE;
		for (var i = 0; i < timers.length; i++) {
			timers[i] = new FFXIVCountdown.Timer(this, timers[i]);
			var t = timers[i];
			if ('end' in t && t['end'] <= skipTimersBefore) {
				// Remove out of date timers from the list.
				timers.splice(i, 1);
				i--;
				continue;
			}
			var div = this.makeTimer(t, 'timer');
			this.container.appendChild(div);
			t.div = div;
			if (t.every) {
				if (!('offset' in t)) {
					t.offset = 0;
				}
				// Recurring timer, so set the start to 0
				t.start = 0;
				// And set the end correctly.
				t.end = (Math.floor((now - t.offset) / t.every) + 1) * t.every + t.offset;
			}
			if (t.subtimers) {
				// If we have subtimers, add them.
				for (var si = 0; si < t.subtimers.length; si++) {
					var st = t.subtimers[si];
					// If there's no end, set it to the end timer from the parent.
					if (!st.end) {
						st.end = t.end;
						st.type = (st.type ? st.type + ' ' : '') + 'ends-with-parent';
					}
					if (!st.type) {
						st.type = '';
					}
					var sdiv = this.makeTimer(st, 'subtimer');
					div.appendChild(sdiv);
					st.div = sdiv;
				}
				// Splice the subtimers into the timer list.
				timers.splice.apply(timers, [i, 0].concat(t.subtimers));
				// And move i past the timers we just added
				i += t.subtimers.length;
			}
			// Debug:
			//t.start = now + (3+i) * 1000;
			//t.end = now + (6+i) * 1000;
		}
		var timer = new Clock();
		timer.ontick = function(now) {
			var now = now.getTime(), time;
			for (var i = 0; i < timers.length; i++) {
				if (!timers[i].update(now)) {
					// Remove from the list.
					timers.splice(i, 1);
					i--;
				}
			}
			if (timers.length == 0) {
				// If we've killed all the timers, just stop.
				timer.stop();
			}
		}
		timer.start();
	},
	makeError: function(message) {
		var div = document.createElement('div');
		div.className = "error";
		div.appendChild(document.createTextNode(message));
		return div;
	},
	makeTimer: function(t, type) {
		// Parse dates if necessary.
		if (typeof t.start == 'string') {
			t.start = Date.parse(t.start);
		}
		if (typeof t.end == 'string') {
			t.end = Date.parse(t.end);
		}
		var div = document.createElement('div');
		div.className = type;
		var d = document.createElement('div');
		d.innerHTML = t.name;
		d.className = 'title';
		div.appendChild(d);
		t.titleDiv = d;
		d = document.createElement('div');
		d.className = 'countdown';
		div.appendChild(d);
		t.timerDiv = d;
		if (!t.type) {
			t.type = '';
		}
		t.beforeClass = type + ' before ' + t.type;
		t.activeClass = type + ' active ' + t.type;
		t.afterClass = type + ' after ' + t.type;
		if (t.type == 'maintenance' || t.showDuration) {
			d = document.createElement('div');
			div.appendChild(d);
			d.className = 'duration';
			var lasts = new Clock.Interval(t.end - t.start);
			var m = [];
			if (lasts.weeks > 0) {
				m.push(lasts.weeks + (lasts.weeks > 1 ? ' weeks' : ' week'));
			}
			if (lasts.days > 0) {
				m.push(lasts.days + (lasts.days > 1 ? ' days' : ' day'));
			}
			if (lasts.hours > 0) {
				m.push(lasts.hours + (lasts.hours > 1 ? ' hours' : ' hour'));
			}
			if (lasts.minutes > 0) {
				m.push(lasts.minutes + (lasts.minutes > 1 ? ' minutes' : ' minute'))
			}
			d.appendChild(document.createTextNode('Lasts ' + m.join(', ')));
		}
		if (t.note) {
			div.appendChild(d = document.createElement('div'));
			d.className = 'note';
			d.appendChild(document.createTextNode(t.note));
		}
		if (t.info) {
			this._makePopover(div, t.info);
		}
		return div;
	},
	/**
	 * Internal function for generating the popover.
	 * @private
	 */
	_makePopover: function(div, popoverHTML) {
		var popover = document.createElement('div'), visible = false, sticky = false;
		popover.className = 'info';
		popover.innerHTML = popoverHTML;
		div.appendChild(popover);
		function toggle() {
			if (visible || sticky) {
				popover.style.left = div.offsetLeft + "px";
				popover.style.top = div.offsetTop + "px";
				popover.className = 'info visible';
			} else {
				popover.className = 'info hidden';
			}
		}
		div.onmouseenter = function(event) {
			visible = true;
			toggle();
		};
		div.onmouseleave = function(event) {
			visible = false;
			toggle();
		};
		// For compatibility with touch devices, also allow clicking on items to
		// make the popup "sticky"
		div.onclick = function(event) {
			if (sticky) {
				// If currently sticky, force it to be hidden
				visible = sticky = false;
			} else {
				// Otherwise, force it to be visible
				visible = sticky = true;
			}
			toggle();
		};
	}
};

/**
 * A single timer.
 */
FFXIVCountdown.Timer = function(controller, definition) {
	this.controller = controller;
	// Copy over definition fields:
	this.start = definition['start'];
	this.end = definition['end'];
	this.name = definition['name'];
	this.info = definition['info'];
	this.note = definition['note'];
	this.type = definition['type'];
	this.every = definition['every'];
	this.offset = definition['offset'];
	this.showDuration = definition['showDuration'];
	this.removeOnActive = definition['removeOnActive'];
	this.removeOnComplete = definition['removeOnComplete'];
}

FFXIVCountdown.Timer.prototype = {
	update: function(now) {
		if (now <= this.start) {
			this.div.className = this.beforeClass;
			time = new Clock.Interval(this.start - now + 1000, this.controller.showWeeks);
		} else if (now <= this.end) {
			this.div.className = this.activeClass;
			time = new Clock.Interval(this.end - now + 1000);
			if (this.removeOnActive) {
				this.div.parentNode.removeChild(this.div);
				return false;
			}
		} else {
			if (this.every) {
				// Recurring timer, so reset it.
				this.end = (Math.floor(((now+1000) - this.offset) / this.every) + 1) * this.every + this.offset;
				time = new Clock.Interval(this.end - now + 1000);
			} else {
				// Otherwise, end it entirely.
				this.div.className = this.afterClass;
				this.timerDiv.innerHTML = '(over)';
				if (this.removeOnComplete) {
					this.div.parentNode.removeChild(this.div);
				}
				return false;
			}
		}
		var m = '';
		if (time.weeks > 0) {
			m = '<span class="weeks">' + time.weeks + (time.weeks > 1 ? ' weeks' : ' week') + ', </span>';
		}
		if (time.days > 0) {
			m += '<span class="days">' + time.days + (time.days > 1 ? ' days' : ' day') + ', </span>';
		}
		m += '<span class="hours">' + Clock.zeropad(time.hours) + ':' + Clock.zeropad(time.minutes) + ':' + Clock.zeropad(time.seconds) + '</span>';
		this.timerDiv.innerHTML = m;
		return true;
	}
}

return FFXIVCountdown;
});
