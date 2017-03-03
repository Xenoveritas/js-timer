#!/usr/bin/env node

var Clock = require('./clock'),
  clock = new Clock(),
  cr = process.platform == 'win32' ? '\033[0G' : '\r';

clock.ontick = function(now) {
  process.stdout.write(cr + now.getHours() + ':'
    + Clock.zeropad(now.getMinutes()) + ':'
    + Clock.zeropad(now.getSeconds()));
};

clock.onbackwards = function(now) {
  process.stdout.write(cr + "Clock ran backwards! Did you just reset your clock?\n");
}

if (!Boolean(process.stdout.isTTY)) {
  console.error('Refusing to run the demo to a file.');
  return;
}

console.log("Press Ctrl-C to kill the clock.");
clock.start();
