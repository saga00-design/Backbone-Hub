import { useState, useEffect, useRef } from 'react';

interface ConnectionStatus {
  isOnline: boolean;
  lastOnlineAt: Date | null;
  offlineDuration: string | null;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function useConnectionStatus(): ConnectionStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(
    navigator.onLine ? new Date() : null
  );
  const [offlineDuration, setOfflineDuration] = useState<string | null>(null);

  const lastOnlineAtRef = useRef<Date | null>(navigator.onLine ? new Date() : null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      const now = new Date();
      setIsOnline(true);
      setLastOnlineAt(now);
      lastOnlineAtRef.current = now;
      setOfflineDuration(null);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        const ref = lastOnlineAtRef.current;
        if (ref) {
          setOfflineDuration(formatDuration(Date.now() - ref.getTime()));
        }
      }, 1000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { isOnline, lastOnlineAt, offlineDuration };
}
