/**
 * This module simply contains "built-in" timers. When imported, it adds
 * information for the built-in timers. "Built-in" timers always sort last.
 *
 * This contains the following generic timers:
 *
 * - Weekly reset is every Tuesday at 1AM PST/4AM EST/08:00 UTC.
 * - Daily reset is every day at 7AM PST/10AM EST/15:00 UTC.
 * - Crafting reset is every Thursday at 1AM PST/4AM EST/08:00 UTC.
 * @module ffxiv_builtins
 */
define(['./ffxiv_countdown'], function(FFXIVCountdown) {
  var builtins = [
    {
      'name': 'Weekly Reset',
      'popover': 'On the weekly reset, the following resets:<ul>'
        + '<li>Allagan tomestones of scripture</li>'
        + '<li>Weekly repeatable quests</li>'
        + '<li>PvP Weekly Performance</li>'
        + '<li>Challenge Log challenges</li>'
        + '<li>A new journal is available from Khloe Aliapoh (Wondrous Tails)</li></ul>',
      'type': 'reset',
      // Period in MS for this event
      'every': 7*24*60*60*1000,
      // The "every" recurrence is based on the UNIX epoch, which started on a
      // Thursday. Since the reset is on Tuesday, that's 5 days off.
      'offset': (5*24+8)*60*60*1000
    },
    {
      'name': 'Crafting Reset',
      'popover': 'On the weekly crafting reset, the following resets:<ul>'
        + "<li>Red crafters' and gathers' scrips</li>"
        + "<li>Zhloe deliveries</li></ul>",
      'type': 'reset',
      'every': 7*24*60*60*1000,
      // Helpfully this reset takes place on the same day as the UNIX epoch!
      'offset': 8*60*60*1000
    },
    {
      'name': 'Daily Reset',
      'popover': 'On the daily reset, the following resets:<ul>'
        + '<li>Beastman quest allowances</li>'
        + '<li>Duty Roulette daily bonuses</li>'
        + '<li>Daily repeatable quest</li></ul>',
      'type': 'reset',
      'every': 24*60*60*1000,
      'offset': 15*60*60*1000
    }
  ];
  // Daily "duty finder jerk" reset (where the "three times per day" before
  // withdrawing always gives you a half-hour penalty) is apparently every day
  // at 9AM PDT/12PM EDT/16:00 UTC.
  // Right now I'm not going to bother including it.
  // I also wonder if that's a patch note typo and they meant "8AM PDT"
  // to match the daily reset and screwed up their Daylight Saving
  // Time conversion.
  Array.prototype.push.apply(FFXIVCountdown.builtins, builtins);
  return builtins;
});
