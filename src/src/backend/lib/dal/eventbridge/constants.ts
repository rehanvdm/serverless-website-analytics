export type EbDetailType = 'anomaly.page_view.alarm' | 'anomaly.page_view.ok';

export const EB_DETAIL_TYPE = {
  'anomaly.page_view.alarm': 'anomaly.page_view.alarm',
  'anomaly.page_view.ok': 'anomaly.page_view.ok',
} as const satisfies { [T in EbDetailType]: T };
