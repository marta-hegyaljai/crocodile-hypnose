import { t, type CopyKey } from '@/copy';
import type { StopView } from '@/content/journey';

/** "8 min" (rounded up, at least 1). */
export function durationLabel(seconds: number): string {
  return t('duration.minutes', { n: Math.max(1, Math.ceil(seconds / 60)) });
}

export function typeLabel(type: StopView['stop']['type']): string {
  return t(`stopTypes.${type}` as CopyKey);
}

export function statusLabel(status: StopView['status']): string {
  return t(`map.status.${status}` as CopyKey);
}

/** What a screen reader hears for a node: title, type, length, state, and "You are here". */
export function stopA11yLabel(view: StopView, current: boolean): string {
  const label = t('map.stopA11y', {
    title: t(view.stop.titleKey),
    type: typeLabel(view.stop.type),
    duration: durationLabel(view.stop.durationSec),
    status: statusLabel(view.status),
  });
  return current ? `${label}. ${t('map.current')}` : label;
}
