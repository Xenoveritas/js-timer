import FFXIVCountdown, { TimerDefinition } from './ffxiv_countdown';

/**
 * This module simply contains "built-in" timers. When imported, it adds
 * information for the built-in timers. "Built-in" timers always sort last.
 *
 * This contains the following generic timers:
 *
 * - Weekly reset is every Tuesday at 1AM PST/4AM EST/08:00 UTC.
 * - Daily reset is every day at 7AM PST/10AM EST/15:00 UTC.
 *
 * When the module is imported, it simply appends the above list to the
 * {@link module:ffxiv_countdown.builtins} array.
 * @module ffxiv_builtins
 */

// Housing constants! For calculating when the lottery period.
// This is based on the schedule listed here:
// https://na.finalfantasyxiv.com/lodestone/news/detail/5c4cd37bfb238a792d5e0b831ea5f56acbae437b
// Cycle Period: 9 Days
const housingPeriod = 9*24*60*60*1000;
// Cycle Start Date: 2022-05-26T15:00:00
// OK, so the offset is basically "what is the offset to the first instance of
// the timer starting since the UNIX epoch." So, basically, the known starting
// time mod nine days.
// The starting point is from Date.UTC(2022, 5-1, 26, 15, 0, 0)
// (In case they ever stop and restart it again)
const housingOffset = 1653577200000 % (9*24*60*60*1000);

/**
 * The actual builtins.
 */
export const builtins: TimerDefinition[] = [
  {
    'name': 'Weekly Reset',
    'info': 'On the weekly reset, the following resets:<ul>'
      + '<li>Cap on Allagan tomestones of comedy</li>'
      + '<li>Weekly repeatable quests</li>'
      + '<li>Thaleia reward eligibility</li>'
      + '<li>Blue Mage/Masked Carnival Weekly Targets</li>'
      + '<li>PvP Weekly Performance</li>'
      + '<li>Challenge Log challenges</li>'
      + '<li>A new Wondrous Tails journal is available</li>'
      + '<li>Faux Hollows availability</li>'
      + '<li>Custom deliveries allowances/individual allowances</li>'
      + '<li>Doman Enclave Reconstruction Effort donations</li>'
      + '<li>Adventurer Squadron Priority mission</li>'
      + '<li>Fashion Report</li></ul>',
    'type': 'reset',
    // Period in MS for this event
    'every': 7*24*60*60*1000,
    // The "every" recurrence is based on the UNIX epoch, which started on a
    // Thursday. Since the reset is on Tuesday, that's 5 days off.
    'offset': (5*24+8)*60*60*1000
  },
  {
    'name': 'Duty/Tribal Daily Reset',
    'info': 'At this time, the following resets:<ul>'
      + '<li>Tribal daily quest allowances</li>'
      + '<li>Duty Roulette daily bonuses</li>'
      + '<li>Daily repeatable quests</li>'
      + '<li>Frontline Duty Availability</li>'
      + '<li>Housing Message</ul>',
    'type': 'reset',
    'every': 24*60*60*1000,
    'offset': 15*60*60*1000
  },
  {
    'name': 'Grand Company Daily Reset',
    'info': 'At this time, the following resets:<ul>'
      + '<li>Adventurer Squadron training allowances</li>'
      + '<li>Grand Company Supply/Provisioning missions</li></ul>',
    'type': 'reset',
    'every': 24*60*60*1000,
    'offset': 20*60*60*1000
  },
  // Daily "duty finder jerk" reset (where the "three times per day" before
  // withdrawing always gives you a half-hour penalty) is apparently every day
  // at 9AM PDT/12PM EDT/16:00 UTC.
  // Right now I'm not going to bother including it.
  // I also wonder if that's a patch note typo and they meant "8AM PDT"
  // to match the daily reset and screwed up their Daylight Saving
  // Time conversion.
  {
    'name': 'Housing Lottery',
    'type': 'housing',
    'info': 'The housing lottery runs in a nine-day cycle. For the first five '
      + 'days, entries can be made, then for the remaining four, winners can '
      + 'finalize their purchase and everyone else may retrieve their fee.',
    'subtimers': [
      {
        'name': 'Application Period',
        'type': 'application',
        'info': 'During this time, you may place an entry into the housing lottery.',
        'every': housingPeriod,
        // OK, so the offset is basically "what is the offset to the first
        // instance of the timer starting since the UNIX epoch." So, basically, the
        // known starting time mod nine days.
        'offset': housingOffset,
        'activeOffset': { 'end': 5*24*60*60*1000 }
      },
      {
        'name': 'Results Period',
        'type': 'results',
        'info': 'During this time, you may accept a winning bid.',
        'every': housingPeriod,
        'offset': housingOffset,
        'activeOffset': { 'start': 5*24*60*60*1000 }
      }
    ]
  }
];

export default builtins;

// TODO: Maybe no longer do this by default?
FFXIVCountdown.builtins.push(...builtins);
