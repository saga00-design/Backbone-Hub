import { useState, useEffect, useRef, useCallback } from 'react';
import { getDocFromServer } from 'firebase/firestore';
import { db, auth, doc } from '../firebase';

// Firestore rules note: connectionHeartbeat/{docId} reads are covered by the
// existing wildcard rule (allow read: if request.auth != null) — no rule change needed.
const HEARTBEAT_DOC = doc(db, 'connectionHeartbeat', 'probe');
const HEARTBEAT_INTERVAL_MS = 8000;
const HEARTBEAT_TIMEOUT_MS = 5000;

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
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const markOnline = useCallback(() => {
    const now = new Date();
    setIsOnline(true);
    setLastOnlineAt(now);
    lastOnlineAtRef.current = now;
    setOfflineDuration(null);
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  const markOffline = useCallback(() => {
    setIsOnline(false);
    if (!durationTimerRef.current) {
      durationTimerRef.current = setInterval(() => {
        const ref = lastOnlineAtRef.current;
        if (ref) {
          setOfflineDuration(formatDuration(Date.now() - ref.getTime()));
        }
      }, 1000);
    }
  }, []);

  // Authoritative connectivity check: bypasses cache, hits Firestore server directly.
  // navigator.onLine is unreliable on Windows (reports true even when WiFi is disconnected).
  const runHeartbeat = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('heartbeat_timeout')), HEARTBEAT_TIMEOUT_MS)
      );
      await Promise.race([getDocFromServer(HEARTBEAT_DOC), timeout]);
      markOnline();
    } catch (err: any) {
      // permission-denied means the request reached the server — we are online
      if (err?.code === 'permission-denied') {
        markOnline();
      } else {
        markOffline();
      }
    }
  }, [markOnline, markOffline]);

  useEffect(() => {
    const handleOnline = () => {
      // navigator.onLine fired — confirm with a real Firestore probe before trusting it
      runHeartbeat();
    };

    const handleOffline = () => {
      // navigator.onLine going offline is reliable; trust it immediately
      markOffline();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Run immediately on mount to establish authoritative state, then poll every 8s
    runHeartbeat();
    heartbeatTimerRef.current = setInterval(runHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [runHeartbeat, markOffline]);

  return { isOnline, lastOnlineAt, offlineDuration };
}
