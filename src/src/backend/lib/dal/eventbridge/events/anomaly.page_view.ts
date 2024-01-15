import { Evaluation, EvaluationWindow } from '@backend/cron-anomaly-detection/stat_functions';
import { EbAnalyticsEntry } from '@backend/lib/dal/eventbridge';

export type EbPageViewAnomalyDetail = EvaluationWindow & {
  /**
   * Evaluations are in DESC order
   */
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
