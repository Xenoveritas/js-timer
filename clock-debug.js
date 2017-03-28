/**
 * A debug module for debugging clocks created via the main
 * {@link module:clock clock} module. This is intended to be used either
 * instead of the {@link module:clock clock} module (if used through require.js
 * or Node) or after loading the clock module if used directly in the browser
 * without require.js.
 *
 * When used outside a module, this creates a new class called `DebugClock` that
 * can be used instead of `Clock`.
 * @module clock-debug
 */

(function (root, factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define(['clock'], factory);
	} else if (typeof module === 'object' && module.exports) {
		// Node. Does not work with strict CommonJS, but
		// only CommonJS-like environments that support module.exports,
		// like Node.
		module.exports = factory(require('clock'));
	} else {
		// Browser globals (root is window)
		if (typeof root.Clock != 'function') {
			throw new Error("Missing required module Clock (load BEFORE clock-debug)");
		}
		root.DebugClock = factory(root.Clock);
	}
}(this, function(Clock) {

var clockCount = 0;

/**
 * Creates a debug clock - a clock that can be started, stopped, and have its
 * time set via a UI.
 * @constructor
 * @alias module:clock-debug
 * @param {String} name a name for the clock, to display in the UI
 */
function DebugClock(name) {
	Clock.apply(this, arguments);
	clockCount++;
	this._name = name ? name : "Clock " + clockCount;
	this._createUI();
}

DebugClock.prototype = new Clock();

function createTextField(form, label, size) {
	if (label) {
		form.appendChild(document.createTextNode(label));
	}
	var field = document.createElement('input');
	field.setAttribute('type', 'text');
	field.setAttribute('size', size);
	form.appendChild(field);
	return field;
}

function createButton(form, label, onclick) {
	var button = document.createElement('button');
	form.appendChild(button);
	button.appendChild(document.createTextNode(label));
	button.onclick = function() {
		try {
			onclick();
		} catch (ex) {
			console.log(ex);
		}
		return false;
	};
	return button;
}

/**
 * Internal function to parse a field into an integer while raising an error if
 * the value can't be parsed rather than doing nothing.
 */
function parseField(field, name) {
	var rv = Number(field.value);
	if (isNaN(rv))
		throw new Error("Bad value \"" + field.value + "\" for " + name);
	return rv;
}

DebugClock.prototype._createUI = function() {
	var form;
	document.body.appendChild(form = document.createElement('form'));
	form.className = "clock-debug";
	form.setAttribute("style", "position: fixed; top: 0; right: 0; padding: 0.5em; font-family: sans-serif; font-size: 14px; background-color: white; color: black;");
	this._year = createTextField(form, this._name + ' ', 4);
	this._month = createTextField(form, '-', 2);
	this._day = createTextField(form, '-', 2);
	this._hour = createTextField(form, ' ', 2);
	this._minute = createTextField(form, ':', 2);
	this._second = createTextField(form, ':', 2);
	createButton(form, 'Set', (function(me) {
		return function() {
			var now = new Date(), wanted = me._parseDate();
			me.offset = wanted.getTime() - now.getTime();
		}
	})(this));
	this._stopButton = createButton(form, 'Stop', (function(me) {
		return function() {
			if (me.running) {
				me.stop();
				me._stopButton.innerHTML = 'Start';
			} else {
				me.start();
				me._stopButton.innerHTML = 'Stop';
			}
		};
	})(this));
	this._updateUI();
};

DebugClock.prototype._parseDate = function() {
	try {
		return new Date(
			parseField(this._year, 'year'),
			parseField(this._month, 'month') - 1,
			parseField(this._day, 'day'),
			parseField(this._hour, 'hour'),
			parseField(this._minute, 'minute'),
			parseField(this._second, 'second'));
	} catch (ex) {
		alert("Unable to parse date: " + ex.message);
	}
};

DebugClock.prototype._updateUI = function() {
	var now = new Date();
	this._year.value = now.getFullYear();
	this._month.value = now.getMonth() + 1;
	this._day.value = now.getDate();
	this._hour.value = now.getHours();
	this._minute.value = now.getMinutes();
	this._second.value = now.getSeconds();
};

return DebugClock;
}));
