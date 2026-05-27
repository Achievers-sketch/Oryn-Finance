import { useState, useEffect, useCallback } from 'react';
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  isPushSubscribed,
  isPushSupported,
} from '@/services/pushNotificationService';

export function usePushNotifications(authToken: string | null) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSupported(isPushSupported());
    isPushSubscribed().then(setSubscribed);
  }, []);

  const subscribe = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const ok = await subscribeToPushNotifications(authToken);
      setSubscribed(ok);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  const unsubscribe = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const ok = await unsubscribeFromPushNotifications(authToken);
      if (ok) setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  return { supported, subscribed, loading, subscribe, unsubscribe };
}
