import { EbAnalyticsEntry } from '@backend/lib/dal/eventbridge';
import { Evaluation, EvaluationWindow } from '@backend/cron-anomaly-detection';

export type EbPageViewAnomalyDetail = EvaluationWindow & {
  evaluations: Evaluation[];
};

/**
 * The event that is sent when a Page View anomaly transitions from Ok to Alarm
 */
export type EbPageViewAnomalyAlarm = EbAnalyticsEntry<{
  DetailType: 'anomaly.page_view.alarm';
  Detail: EbPageViewAnomalyDetail;
}>;

/**
 * The event that is sent when a Page View anomaly transitions from Alarm to Ok
 */
export type EbPageViewAnomalyOk = EbAnalyticsEntry<{
  DetailType: 'anomaly.page_view.ok';
  Detail: EbPageViewAnomalyDetail;
}>;
