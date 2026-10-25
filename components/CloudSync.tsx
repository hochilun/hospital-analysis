'use client';

import { useEffect } from 'react';
import { syncAllFromCloud } from '@/lib/supabase';

// 每次開網站先跟雲端同步；若雲端有別處（另一台裝置、Elon）的新資料，重新載入一次讓畫面吃到最新值。
// 第二次載入時本機已與雲端一致，不會再重整，不會無限循環。
export default function CloudSync() {
  useEffect(() => {
    syncAllFromCloud().then(changed => {
      if (changed && !sessionStorage.getItem('cloud-reloaded')) {
        sessionStorage.setItem('cloud-reloaded', '1');
        window.location.reload();
      } else {
        sessionStorage.removeItem('cloud-reloaded');
      }
    });
  }, []);
  return null;
}
