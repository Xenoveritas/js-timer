requirejs.config({
	paths: {
		clock: '../clock'
	}
});
requirejs(['ffxiv_countdown', 'ffxiv_builtins'], function(FFXIVCountdown) {
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
