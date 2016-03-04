# FFXIV Timers

This branch contains an FFXIV-specific timer implementation.

## Using

You must run `grunt` at least once to install the necessary third party libraries that this uses. So the setup process should effectively be:

1. Install [Node](https://nodejs.org/)
2. Run `npm install` to install necessary libraries
3. Run `npm install -g grunt-cli` to install the CLI for grunt
4. Run `grunt` itself

## Testing with browsers that block AJAX to file: URLs

In some browsers, you can just run [ffxiv_timer_test.html](web/ffxiv_timer_test.html) directly (after running `grunt` to install dependencies), but some disallow that as a security precaution. In order to work around that, you can use the existing `grunt` build to run a test server using the `testserver` task:

    grunt testserver

After that, you can go to http://localhost:8000/web/ffxiv_timer_test.html to run the test version of the page.

To test the compiled versions, use the `server` task instead:

    grunt server

The compiled version will then be available at http://localhost:8000/web/ffxiv_timer.html .

# Timer module

A simple JavaScript module for generating countdown timers or clocks. Check out `demo.html` for a brief demo of creating a simple clock in the browser and `demo.js` for a demo of using this in [Node.js](http://nodejs.org).

## `Timer` class

Very basic timer class that runs a function every second.

### Member Functions

* `start()` - starts the timer. Events do not fire until `start()` is called.
* `stop()` - stops the timer. No more events will be called.
* `ontick(now)` - Called once a second with the current time. (Note: the Date object given will have a different time from the one given by `new Date()`, as the time when ontick is called may not be exactly on the second. By using the given date, the timer will update "close enough" to the correct second.)

### Static Functions

* `Timer.zeropad(number)` - Utility function to 0-pad a two-digit number, since this comes up so often. This will take numbers 0-9 and produce strings like `"01"`.

## `Timer.Interval` class

An interval of time - sort of like a `Date()` but for different periods of time.

`Timer.Interval(millis)` - create a new timer for the given number of milliseconds

## Member variables

* `weeks` - number of weeks in the interval
* `days` - number of days in the interval
* `hours` - number of hours in the interval
* `minutes` - number of minutes in the interval
* `seconds` - number of seconds in the interval
* `millis` - number of milliseconds in the interval
