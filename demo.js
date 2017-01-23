#!/usr/bin/env node

var Timer = require('./timer'),
  clock = new Timer(),
  cr = process.platform == 'win32' ? '\033[0G' : '\r';

clock.ontick = function(now) {
  process.stdout.write(cr + now.getHours() + ':'
    + Timer.zeropad(now.getMinutes()) + ':'
    + Timer.zeropad(now.getSeconds()));
};

if (!Boolean(process.stdout.isTTY)) {
  console.error('Refusing to run the demo to a file.');
  return;
}

console.log("Press Ctrl-C to kill the clock.");
clock.start();
