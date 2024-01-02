import { PutEventsRequestEntry } from '@aws-sdk/client-eventbridge';
import { EbAnalyticsEntry } from '@backend/lib/dal/eventbridge';

export type EbPageViewAnomalyDetail = {
  breached: boolean;
  /* The data points evaluated to determine if the alarm is breaching (all evaluations must be breaching)
   * Elements are in DESC order, meaning the first element in the array will always be the latest */
  evaluations: {
    date: string;
    value: number;
    /* For the last 24 hours, not the full season (7 days) */
    std_dev: number;
    predicted: number;
    /* If the value exceeds the predicted upper std dev, then this will be true
     * Calculated as `predicted + (std_dev*X)` where X is specified on the producer  */
    predicted_std_dev: number;
    breached: boolean;
  }[];
};

/**
 * The event that is sent when a Page View anomaly transitions from OK to Breached
 */
export type EbPageViewAnomalyBreached = EbAnalyticsEntry<{
  DetailType: 'anomaly.page_view.breached';
  Detail: EbPageViewAnomalyDetail;
}>;

/**
 * The event that is sent when a Page View anomaly transitions from Breached to OK
 */
export type EbPageViewAnomalyOk = EbAnalyticsEntry<{
  DetailType: 'anomaly.page_view.ok';
  Detail: EbPageViewAnomalyDetail;
}>;
