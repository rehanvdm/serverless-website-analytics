import { EventBridgeClient, PutEventsCommand, PutEventsRequestEntry } from '@aws-sdk/client-eventbridge';
import { EbPageViewAnomalyBreached, EbPageViewAnomalyOk } from '@backend/lib/dal/eventbridge/events/amoaly.page_view';
import { getEventBridgeClient } from '@backend/lib/utils/lazy_aws';

export type EbAnalyticsEntry<T extends { DetailType: string; Detail: unknown }> = T;

type EbAnalyticsEventAll = EbPageViewAnomalyBreached | EbPageViewAnomalyOk;

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
