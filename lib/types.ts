export type Tag = 'Sighting' | 'Warning' | 'Ticket';
export type FilterRange = '24h' | '2d' | '3d' | '7d' | '30d' | '90d';

export interface Sighting {
  id: string;
  created_at: string;
  tag: Tag;
  description: string | null;
  media_url: string | null;
  lat: number;
  lng: number;
  checkin_count: number;
  last_checkin_at: string | null;
}

export interface CreateSightingInput {
  tag: Tag;
  description?: string;
  lat: number;
  lng: number;
  device_uuid: string;
  anon_user_number: number;
  media_url?: string;
}

export interface CheckinInput {
  sighting_id: string;
  device_uuid: string;
  anon_user_number: number;
}

export interface CheckinResult {
  checkin_count: number;
  last_checkin_at: string | null;
}

export interface NearbyResult {
  duplicate: boolean;
  existing_sighting_id?: string;
}

export interface ApiError {
  error: string;
  code?: string;
  existing_sighting_id?: string;
}

export interface DeviceInfo {
  device_uuid: string;
  anon_user_number: number;
}
