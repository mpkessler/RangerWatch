import { v4 as uuidv4 } from 'uuid';
import type { DeviceInfo } from './types';

export function getOrCreateDeviceUUID(): string {
  if (typeof window === 'undefined') return '';
  let uuid = localStorage.getItem('rw_device_uuid');
  if (!uuid) {
    uuid = uuidv4();
    localStorage.setItem('rw_device_uuid', uuid);
  }
  return uuid;
}

export function getStoredAnonNumber(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('rw_anon_user_number');
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

export async function initDevice(): Promise<DeviceInfo> {
  const device_uuid = getOrCreateDeviceUUID();
  let anon_user_number = getStoredAnonNumber();

  if (!anon_user_number) {
    try {
      const res = await fetch('/api/anon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_uuid }),
      });
      if (res.ok) {
        const data = await res.json();
        anon_user_number = data.anon_user_number as number;
        localStorage.setItem('rw_anon_user_number', String(anon_user_number));
      } else {
        // Fallback: use a local random number so the app still works
        anon_user_number = Math.floor(Math.random() * 1_000_000);
        localStorage.setItem('rw_anon_user_number', String(anon_user_number));
      }
    } catch {
      anon_user_number = Math.floor(Math.random() * 1_000_000);
      localStorage.setItem('rw_anon_user_number', String(anon_user_number));
    }
  }

  return { device_uuid, anon_user_number };
}
