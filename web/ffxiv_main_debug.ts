import FFXIVCountdown from './ffxiv_countdown';
import DebugClock from '../src/clock-debug';
import './ffxiv_builtins';
import './ffxiv_timer.scss';

import timerURL from '/timers.json?url';

/**
 * Starts timers in any element that has a data-ffxiv-timer attribute set on it.
 */
export function startTimers() {
	const timers: string | TimerDefinition[] = (typeof timerURL === 'string' ? timerURL : timerURL?.timers) ?? [];
	// Get any element that has a timer declared on it
	const elements = document.querySelectorAll("*[data-ffxiv-timer-src]");
	for (let idx = 0; idx < elements.length; idx++) {
		if (elements[idx] instanceof HTMLElement) {
			const element: HTMLElement = elements[idx] as HTMLElement;
			FFXIVCountdown.create(element, element.dataset["ffxivTimerSrc"], { clock: new DebugClock('FFXIV Clock') });
		}
	}
	const timerElements = document.querySelectorAll("*[data-ffxiv-timer]");
	for (let idx = 0; idx < timerElements.length; idx++) {
		if (timerElements[idx] instanceof HTMLElement) {
			const element: HTMLElement = timerElements[idx] as HTMLElement;
			FFXIVCountdown.create(element, timers, { clock: new DebugClock('FFXIV Clock') });
		}
	}
}

// From http://youmightnotneedjquery.com/, sort of
if (document.readyState != 'loading') {
	startTimers();
} else {
	document.addEventListener('DOMContentLoaded', startTimers);
}