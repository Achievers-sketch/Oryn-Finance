import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface Props {
  authToken: string | null;
}

export function NotificationPreferences({ authToken }: Props) {
  const { supported, subscribed, loading, subscribe, unsubscribe } = usePushNotifications(authToken);

  if (!supported) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">
        {subscribed ? 'Push notifications on' : 'Push notifications off'}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={loading || !authToken}
        onClick={subscribed ? unsubscribe : subscribe}
        className="flex items-center gap-2"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : subscribed ? (
          <BellOff className="w-4 h-4" />
        ) : (
          <Bell className="w-4 h-4" />
        )}
        {subscribed ? 'Disable' : 'Enable'}
      </Button>
    </div>
  );
}
