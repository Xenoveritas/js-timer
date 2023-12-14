export function crushNumber(num: number): string {
	let s = num.toString();
	// Is this an integer with a bunch of 0s on the end?
	if (s.indexOf('.') < 0 && s.length > 3 && s.substring(s.length-3) == '000') {
		// Count the 0s on the end
		let i;
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
function json_stringify(obj: unknown, out: string[]) {
	if (typeof obj === 'object') {
		let comma = false;
		if (Array.isArray(obj)) {
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
			for (const k in obj) {
				if (comma) {
					out.push(',');
				} else {
					comma = true;
				}
				// Let JSON.stringify handle the key
				out.push(JSON.stringify(k));
				out.push(':');
				json_stringify(obj[k] as unknown, out);
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

export default function(obj: unknown): string {
	const string: string[] = [];
	json_stringify(obj, string);
	return string.join('');
};
