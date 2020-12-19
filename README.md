# FFXIV Timers

This branch contains an FFXIV-specific timer implementation.

## Using

As of now, this uses Webpack to build the entire thing.

1. Install [Node](https://nodejs.org/)
2. Install [Yarn](https://yarnpkg.com/)
3. Run `yarn` to install and build everything

## Testing

Use `yarn start` to start a webserver in development mode. Once the server is ready, go to http://localhost:8080/ffxiv_timer.html to run the site.

# Clock module

A simple JavaScript module for generating countdown timers or clocks. Check out `demo.html` for a brief demo of creating a simple clock in the browser and `demo.js` for a demo of using this in [Node.js](http://nodejs.org).

This module is written to deal with common issues that come up with writing a clock that updates at a consistent rate. Looking at the JavaScript API, it would appear that `setInterval` would be perfect for implementing a clock that updates every second.

It is not, for a very simple reason: `setInterval` does not invoke the callback at anywhere near a steady rate. It is allowed to call it early, and it is allowed to call it late. An interval of `1000` may, in fact, be invoked every 950-980ms, which for a clock, leads to a clock that's about a second slow until it suddenly jumps forward a second.

This module solves that by instead using `setTimeout` and re-invoking it based on how long it is to the next second. It also "rounds up" the current time, ensuring that if the clock is called a few milliseconds early, it will still display for the time it's "supposed" to. This means that each tick may be slightly late or slightly early, but it will update at close-enough to once a second.

The other issue is that timeouts in a browser (through either `setInterval` or `setTimeout`) may be delayed for a variety of reasons. For example, if the OS is overloaded, or the computer is suspended, the timeout may not be invoked until well after the time. By re-invoking `setTimeout` based on when it was, in fact, called, this allows the clock to "skip ahead" and ignore any times it missed.

Note that if you're looking to create a clock with a smooth second hand, this is **not** the module you're looking for. Instead check out [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).

## `Clock` class

Very basic clock class that calls its `ontick` method every second.

### Member Functions

* `start()` - Starts the clock. Events do not fire until `start()` is called.
* `stop()` - Stops the clock. No more events will be called.
* `ontick(now)` - Called once a second with the current time as a `Date`. Note that the `Date` given will be rounded to the nearest second - see above for an explanation as to why.

### Static Functions

* `Clock.zeropad(number)` - Utility function to 0-pad a two-digit number, since this comes up so often. This will take numbers 0-9 and produce strings like `"01"`.

## `Clock.Interval` class

An interval of time - sort of like a `Date()` but for different periods of time.

`Clock.Interval(millis)` - create a new interval for the given number of milliseconds

## Member variables

* `weeks` - number of weeks in the interval
* `days` - number of days in the interval
* `hours` - number of hours in the interval
* `minutes` - number of minutes in the interval
* `seconds` - number of seconds in the interval
* `millis` - number of milliseconds in the interval
* `isInPast` - indicates that the interval occurred in the past (over a negative number of milliseconds)

# Building

Building the source is currently done using [Yarn](https://yarnpkg.com/) and [Grunt](https://gruntjs.com/). This makes building the code simply:

```sh
yarn
grunt
```
