import type { FilterRange, Tag } from './types';

export const FILTER_LABELS: Record<FilterRange, string> = {
  '24h': '24 hours',
  '2d': '2 days',
  '3d': '3 days',
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
};

export const FILTER_MS: Record<FilterRange, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '2d': 2 * 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
};

export const FILTER_INTERVAL: Record<FilterRange, string> = {
  '24h': '24 hours',
  '2d': '2 days',
  '3d': '3 days',
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
};

export const TAG_COLORS: Record<Tag, string> = {
  Sighting: '#3B82F6',
  Warning: '#F59E0B',
  Ticket: '#EF4444',
};

export const TAG_BG: Record<Tag, string> = {
  Sighting: 'bg-blue-500',
  Warning: 'bg-amber-500',
  Ticket: 'bg-red-500',
};

export const TAG_TEXT: Record<Tag, string> = {
  Sighting: 'text-blue-700 bg-blue-100 border border-blue-300',
  Warning: 'text-amber-700 bg-amber-100 border border-amber-300',
  Ticket: 'text-red-700 bg-red-100 border border-red-300',
};

export const VALID_TAGS: Tag[] = ['Sighting', 'Warning', 'Ticket'];

export function getRecencyColor(created_at: string): string {
  const min = (Date.now() - new Date(created_at).getTime()) / 60_000;
  if (min <= 60) return '#EF4444';  // red: ≤ 60 min
  if (min <= 120) return '#F59E0B'; // yellow: 60–120 min
  return '#3B82F6';                  // blue: > 120 min
}

export function isWithin90Minutes(created_at: string): boolean {
  return Date.now() - new Date(created_at).getTime() <= 90 * 60 * 1000;
}

export function isOlderThan24h(created_at: string): boolean {
  return Date.now() - new Date(created_at).getTime() > 24 * 60 * 60 * 1000;
}

export function formatRelativeTime(created_at: string): string {
  const diff = Date.now() - new Date(created_at).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 90) return `${Math.floor(minutes / 60)}h ago`;
  // ≥ 90 min: absolute timestamp
  const d = new Date(created_at);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const date = `${d.getMonth() + 1}/${d.getDate()}`;
  return `Reported at ${time} on ${date}`;
}

export function formatExactTime(created_at: string): string {
  return new Date(created_at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getFilterCutoff(range: FilterRange): Date {
  return new Date(Date.now() - FILTER_MS[range]);
}

export function isValidTag(tag: string): tag is Tag {
  return VALID_TAGS.includes(tag as Tag);
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  const la = Number(lat);
  const lo = Number(lng);
  return !isNaN(la) && !isNaN(lo) && la >= -90 && la <= 90 && lo >= -180 && lo <= 180;
}
