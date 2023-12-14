// This currently works as a workaround for the way moment actually ends up getting loaded.
// Moment is EOLed and will be replaced ... eventually
import * as moment from 'moment';

type MomentType = (typeof moment) & ((inp?: moment.MomentInput, strict?: boolean) => moment.Moment);

const result = (moment as unknown as {default: unknown}).default as typeof moment;

export default result;
export type Moment = moment.Moment;