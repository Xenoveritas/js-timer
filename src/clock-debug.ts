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

import Clock from './clock';

let clockCount = 0;

function createTextField(form: HTMLFormElement, label: string | undefined, size: number): HTMLInputElement {
	if (typeof label === 'string' && label.length > 0) {
		form.appendChild(document.createTextNode(label));
	}
	const field = document.createElement('input');
	field.setAttribute('type', 'text');
	field.setAttribute('size', size.toString());
	form.appendChild(field);
	return field;
}

function createButton(form: HTMLFormElement, label: string, onclick: () => void) {
	const button = document.createElement('button');
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
function parseField(field: HTMLInputElement, name: string) {
	var rv = Number(field.value);
	if (isNaN(rv))
		throw new Error("Bad value \"" + field.value + "\" for " + name);
	return rv;
}

/**
 * Creates a debug clock - a clock that can be started, stopped, and have its
 * time set via a UI.
 * @constructor
 * @alias module:clock-debug
 * @param {String} name a name for the clock, to display in the UI
 */
export class DebugClock extends Clock {
	_name: string;
	_year: HTMLInputElement;
	_month: HTMLInputElement;
	_day: HTMLInputElement;
	_hour: HTMLInputElement;
	_minute: HTMLInputElement;
	_second: HTMLInputElement;
	_stopButton: HTMLButtonElement;
	constructor(name: string) {
		super();
		clockCount++;
		this._name = name ? name : "Clock " + clockCount;
		const form = document.createElement('form');
		document.body.appendChild(form);
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

	_parseDate(): Date {
		try {
			return new Date(
				parseField(this._year, 'year'),
				parseField(this._month, 'month') - 1,
				parseField(this._day, 'day'),
				parseField(this._hour, 'hour'),
				parseField(this._minute, 'minute'),
				parseField(this._second, 'second')
			);
		} catch (ex) {
			alert("Unable to parse date: " + ex);
			// Return now, I guess
			return new Date();
		}
	};

	_updateUI(): void {
		const now = new Date();
		this._year.value = now.getFullYear().toString();
		this._month.value = (now.getMonth() + 1).toString();
		this._day.value = now.getDate().toString();
		this._hour.value = now.getHours().toString();
		this._minute.value = now.getMinutes().toString();
		this._second.value = now.getSeconds().toString();
	}
}

export default DebugClock;
