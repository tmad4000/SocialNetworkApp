import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { Link } from 'wouter';
import { Bell } from 'lucide-react';

export function useNotifications() {
  const { toast } = useToast();
  const { user } = useUser();

  useEffect(() => {
    if (!user) return;

    const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`);

    ws.onmessage = (event) => {
      try {
        const notification = JSON.parse(event.data);
        const { type, data } = notification;

        let title = '';
        let description = '';
        let action = '';

        switch (type) {
          case 'LIKE':
            title = 'New Like';
            description = `${data.username} ${data.action}`;
            action = `/post/${data.postId}`;
            break;
          case 'COMMENT':
            title = 'New Comment';
            description = `${data.username} ${data.action}`;
            action = `/post/${data.postId}`;
            break;
          case 'FRIEND_REQUEST':
            title = 'Friend Request';
            description = `${data.username} ${data.action}`;
            action = `/profile/${data.userId}`;
            break;
          default:
            return;
        }

        toast({
          title,
          description: (
            <Link href={action} className="hover:underline cursor-pointer">
              {description}
            </Link>
          ),
          icon: <Bell className="h-4 w-4" />,
        });
      } catch (error) {
        console.error('Error handling notification:', error);
      }
    };

    // Handle connection errors and automatic reconnection
    const handleReconnect = () => {
      ws.close();
    };

    ws.onerror = handleReconnect;
    ws.onclose = handleReconnect;

    return () => {
      ws.close();
    };
  }, [user, toast]); // Include all dependencies used inside the effect
}