/*
 * Do not specify relative paths (@backend) which is withing the /src directory because the outside tsconfig also
 * needs to import these and only the inside tsconfig has the path mapping (can not get outside to work)
 *  */

export type EbDetailType = 'anomaly.page_view.alarm' | 'anomaly.page_view.ok';

export const EB_DETAIL_TYPE = {
  'anomaly.page_view.alarm': 'anomaly.page_view.alarm',
  'anomaly.page_view.ok': 'anomaly.page_view.ok',
} as const satisfies { [T in EbDetailType]: T };
