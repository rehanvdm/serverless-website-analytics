import { Page } from '@backend/lib/models/page';
import { Event } from '@backend/lib/models/event';

export type FirehoseDTO =
  | {
      type: 'page';
      data: Page;
    }
  | {
      type: 'event';
      data: Event;
    };
