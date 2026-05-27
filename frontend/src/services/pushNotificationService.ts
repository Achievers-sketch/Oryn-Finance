import { apiClient } from '@/lib/api-client';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await apiClient.get<{ publicKey: string }>('/push/vapid-public-key');
    return res.success ? res.data!.publicKey : null;
  } catch {
    return null;
  }
}

async function getOrRegisterServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration('/sw.js');
    if (existing) return existing;
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

export async function subscribeToPushNotifications(authToken: string): Promise<boolean> {
  if (!('Notification' in window) || !('PushManager' in window)) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const vapidKey = await getVapidPublicKey();
  if (!vapidKey) return false;

  const registration = await getOrRegisterServiceWorker();
  if (!registration) return false;

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    apiClient.setAuthToken(authToken);
    const res = await apiClient.post('/push/subscribe', { subscription });
    return res.success === true;
  } catch {
    return false;
  }
}

export async function unsubscribeFromPushNotifications(authToken: string): Promise<boolean> {
  const registration = await navigator.serviceWorker?.getRegistration('/sw.js');
  if (!registration) return false;

  try {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();

    apiClient.setAuthToken(authToken);
    const res = await apiClient.delete('/push/subscribe');
    return res.success === true;
  } catch {
    return false;
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  const registration = await navigator.serviceWorker?.getRegistration('/sw.js');
  if (!registration) return false;
  const sub = await registration.pushManager.getSubscription().catch(() => null);
  return !!sub;
}

export function isPushSupported(): boolean {
  return 'Notification' in window && 'PushManager' in window && 'serviceWorker' in navigator;
}
