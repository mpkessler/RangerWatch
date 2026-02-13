'use client';

import { useEffect } from 'react';
import { track } from '@vercel/analytics';

export default function AnalyticsTracker() {
  useEffect(() => { track('AppLoaded'); }, []);
  return null;
}
