import { swaClient, shouldTrack, router } from '@frontend/src/main';

export const TRACK_EVENTS = [
  'menu_page',
  'menu_event',
  'refresh',
  'date_filter_changed',
  'selected_sites_changed',
  'github',
] as const;
export type TrackEvent = (typeof TRACK_EVENTS)[number];

export const TRACK_CATEGORIES = ['none', 'router', 'click', 'link'] as const;
export type TrackCategory = (typeof TRACK_CATEGORIES)[number];

export function sendTrack(event: TrackEvent, category: TrackCategory, data = 1) {
  const cat = category === 'none' ? undefined : category;
  if (shouldTrack.value) swaClient.v1.analyticsTrack(event, data, cat);
}

export function trackButtonClick(event: TrackEvent, category: TrackCategory = 'click') {
  sendTrack(event, category);
}

export function trackLinkClick(event: TrackEvent, url: string, _blank = true, category: TrackCategory = 'link') {
  sendTrack(event, category);
  const anchor = document.createElement('a');
  anchor.href = url;
  if (_blank) anchor.target = '_blank';
  anchor.click();
}

export function trackRouterClick(event: TrackEvent, toPath: string, category: TrackCategory = 'router') {
  sendTrack(event, category);
  router.push({ path: toPath });
}
