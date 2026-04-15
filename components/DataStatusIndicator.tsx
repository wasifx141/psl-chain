'use client';

import { supabase } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';

export function DataStatusIndicator() {
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { data } = await supabase
          .from('transactions')
          .select('timestamp')
          .order('timestamp', { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          const txTime = new Date(data[0].timestamp);
          setLastUpdate(txTime);
          
          // Consider "live" if last transaction was within 5 minutes
          const minutesAgo = (Date.now() - txTime.getTime()) / 60000;
          setIsLive(minutesAgo < 5);
        }
      } catch (error) {
        console.error('Error checking data status:', error);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (!lastUpdate) return null;

  const minutesAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 60000);
  const hoursAgo = Math.floor(minutesAgo / 60);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`rounded-lg px-3 py-2 text-xs shadow-lg backdrop-blur-sm ${
        isLive 
          ? 'bg-green-500/20 border border-green-500/50 text-green-500' 
          : 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-500'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
          <span>
            {isLive ? (
              'Live data'
            ) : hoursAgo > 0 ? (
              `Last update: ${hoursAgo}h ago`
            ) : (
              `Last update: ${minutesAgo}m ago`
            )}
          </span>
        </div>
        {!isLive && (
          <div className="mt-1 text-[10px] opacity-75">
            Listener may not be running
          </div>
        )}
      </div>
    </div>
  );
}
