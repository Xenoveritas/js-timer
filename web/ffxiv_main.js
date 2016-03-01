requirejs.config({
	paths: {
		timer: '../timer'
	}
});
requirejs(['ffxiv_countdown'], function(FFXIVCountdown) {
	function startTimers() {
		new FFXIVCountdown(document.getElementById('timers'), 'timers.json');
	}
	// From http://youmightnotneedjquery.com/, sort of
	if (document.readyState != 'loading') {
		startTimers();
	} else {
		document.addEventListener('DOMContentLoaded', startTimers);
	}
});
