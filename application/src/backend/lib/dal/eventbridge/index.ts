import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { getEventBridgeClient } from '../../utils/lazy_aws';
import { EbPageViewAnomalyAlarm, EbPageViewAnomalyOk } from './events/anomaly.page_view';
import { EventBridgeEvent } from 'aws-lambda';
import { EbDetailType } from './constants';

type EbAnalyticsProps = { DetailType: EbDetailType; Detail: unknown };
export type EbAnalyticsEntry<T extends EbAnalyticsProps> = T;
export type EbAnalyticsEntryToEventBridgeEvent<T extends EbAnalyticsProps> = EventBridgeEvent<
  T['DetailType'],
  T['Detail']
>;

type EbAnalyticsEventAll = EbPageViewAnomalyAlarm | EbPageViewAnomalyOk;

export class EventBridgeAnalytics {
  private ebClient: EventBridgeClient;
  private source: string;

  constructor(source: string) {
    this.ebClient = getEventBridgeClient();
    this.source = source;
  }

  public async putEvent(entry: EbAnalyticsEventAll) {
    await this.ebClient.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: this.source,
            DetailType: entry.DetailType,
            Detail: JSON.stringify(entry.Detail),
          },
        ],
      })
    );
  }
}
