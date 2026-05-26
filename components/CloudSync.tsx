'use client';

import { useEffect } from 'react';
import { syncAllFromCloud } from '@/lib/supabase';

export default function CloudSync() {
  useEffect(() => {
    syncAllFromCloud();
  }, []);
  return null;
}
