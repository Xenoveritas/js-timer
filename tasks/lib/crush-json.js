var util = require('util');

function crushNumber(num) {
	var s = num.toString();
	// Is this an integer with a bunch of 0s on the end?
	if (s.indexOf('.') < 0 && s.length > 3 && s.substring(s.length-3) == '000') {
		// Count the 0s on the end
		var i;
		for (i = s.length-3; s.charAt(i) == '0' && i >= 0; i--) {
		}
		// Increment i (it's pointing to the first non-zero)
		i++;
		// And calculate the final result
		s = s.substring(0, i) + 'E' + (s.length-i);
	}
	return s;
}

// Can't use the built-in JSON.stringify because it's dumb, so we have to do it
// manually. Whatever.
function json_stringify(obj, out) {
	if (typeof obj == 'object') {
		var comma = false;
		if (util.isArray(obj)) {
			out.push('[');
			obj.forEach(function(v) {
				if (comma) {
					out.push(',');
				} else {
					comma = true;
				}
				json_stringify(v, out);
			});
			out.push(']');
		} else {
			out.push('{');
			for (var k in obj) {
				if (comma) {
					out.push(',');
				} else {
					comma = true;
				}
				// Let JSON.stringify handle the key
				out.push(JSON.stringify(k));
				out.push(':');
				json_stringify(obj[k], out);
			}
			out.push('}');
		}
	} else if (typeof obj == 'number') {
		out.push(crushNumber(obj));
	} else {
		// For anything else, just use JSON.stringify!
		out.push(JSON.stringify(obj));
	}
}

module.exports = function(obj) {
	var string = [];
	json_stringify(obj, string);
	return string.join('');
};
