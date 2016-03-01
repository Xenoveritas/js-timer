/**
 * Module for the actual clock.
 */
define(['timer'], function(Timer) {
function FFXIVCountdown(container, timers, addBuiltins) {
	if (arguments.length < 2) {
		timers = [];
	}
	if (arguments.length < 3)
		addBuiltins = true;
	this.container = container;
	this.addBuiltins = addBuiltins;
	if (typeof timers == 'string') {
		// Assume it's a URL and try and pull it using AJAX
		this.load(timers);
		return;
	}
	this._init(timers);
}
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
	_init: function(timers) {
		if (this.addBuiltins) {
			// Insert our recurring timers.
			// Weekly reset is every Tuesday at 1AM PST/4AM EST/08:00 UTC
			// Daily reset is every day at 7AM PST/10AM EST/15:00 UTC
			// Daily "duty finder jerk" reset is apparently every day at
			// 9AM PDT/12PM EDT/16:00 UTC
			// Right now I'm not going to bother including it.
			// I also wonder if that's a patch note typo and they meant "8AM PDT"
			// to match the daily reset and screwed up their Daylight Saving
			// Time conversion.
			timers.push({
				'name': 'Weekly Reset',
				'popover': 'On the weekly reset, the following resets:<ul><li>Allagan tomestones of lore</li><li>Alexander Midas</li><li>The quest "Primal Focus"</li><li>PvP Weekly Performance</li><li>Challenge Log challenges</li></ul>',
				'type': 'reset',
				// Period in MS for this event
				'every': 7*24*60*60*1000,
				// Over "every" recurrence is based on the UNIX epoch, which started on a
				// Thursday. Since the reset is on Tuesday, that's 5 days off.
				'offset': (5*24+8)*60*60*1000
			}, {
				'name': 'Crafting Scrips Reset',
				'popover': "After this reset, the total number of red crafters' and gathers' scrips is reset",
				'type': 'reset',
				'every': 7*24*60*60*1000,
				// Helpfully this reset takes place on the same day as the UNIX epoch!
				'offset': 8*60*60*1000
			}, {
				'name': 'Daily Reset',
				'popover': 'On the daily reset, the following resets:<ul><li>Beastman daily quest allowances</li><li>Duty Roulette daily bonuses</li><li>Alexandrite Map repeatable quest</li></ul>',
				'type': 'reset',
				'every': 24*60*60*1000,
				'offset': 15*60*60*1000
			});
		}
		var now = new Date().getTime();
		for (var i = 0; i < timers.length; i++) {
			var t = timers[i];
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
		var timer = new Timer();
		timer.ontick = function(now) {
			var now = now.getTime(), time;
			for (var i = 0; i < timers.length; i++) {
				var t = timers[i];
				if (now <= t.start) {
					t.div.className = t.beforeClass;
					time = new Timer.Interval(t.start - now + 1000);
				} else if (now <= t.end) {
					t.div.className = t.activeClass;
					time = new Timer.Interval(t.end - now + 1000);
					if (t.removeOnActive) {
						// Remove this from the list.
						timers.splice(i, 1);
						i--;
						t.div.parentNode.removeChild(t.div);
					}
				} else {
					if (t.every) {
						// Recurring timer, so reset it.
						t.end = (Math.floor(((now+1000) - t.offset) / t.every) + 1) * t.every + t.offset;
						time = new Timer.Interval(t.end - now + 1000);
					} else {
						// Otherwise, end it entirely.
						t.div.className = t.afterClass;
						t.timerDiv.innerHTML = '(over)';
						// Remove this from the list.
						timers.splice(i, 1);
						i--;
						if (t.removeOnComplete) {
							t.div.parentNode.removeChild(t.div);
						}
						continue;
					}
				}
				var m = '';
				if (time.weeks > 0) {
					m = '<span class="weeks">' + time.weeks + (time.weeks > 1 ? ' weeks' : 'week') + ', </span>';
				}
				if (time.days > 0) {
					m += '<span class="days">' + time.days + (time.days > 1 ? ' days' : ' day') + ', </span>';
				}
				m += '<span class="hours">' + Timer.zeropad(time.hours) + ':' + Timer.zeropad(time.minutes) + ':' + Timer.zeropad(time.seconds) + '</span>';
				t.timerDiv.innerHTML = m;
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
			var lasts = new Timer.Interval(t.end - t.start);
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
		if (t.popover) {
			var popover = document.createElement('div');
			popover.className = 'popover';
			popover.innerHTML = t.popover;
			div.appendChild(popover);
			div.onmouseenter = function(event) {
				popover.style.left = div.offsetLeft + "px";
				popover.style.top = div.offsetTop + "px";
				popover.className = 'popover visible';

			};
			div.onmouseleave = function(event) {
				popover.className = 'popover hidden';
			};
		}
		return div;
	}
};
return FFXIVCountdown;
});
