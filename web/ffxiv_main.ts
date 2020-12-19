import FFXIVCountdown from './ffxiv_countdown';
import './ffxiv_builtins';
import './ffxiv_timer.scss';

// FIXME: This is used to make the timers part of the Webpack build process
import './timers.json';

function startTimers() {
	// Get any element that has a timer declared on it
	const elements = document.querySelectorAll("*[data-timer-src]");
	for (let idx = 0; idx < elements.length; idx++) {
		if (elements[idx] instanceof HTMLElement) {
			const element: HTMLElement = elements[idx] as HTMLElement;
			new FFXIVCountdown(element, element.dataset["timerSrc"]);
		}
	}
}

// From http://youmightnotneedjquery.com/, sort of
if (document.readyState != 'loading') {
	startTimers();
} else {
	document.addEventListener('DOMContentLoaded', startTimers);
}
