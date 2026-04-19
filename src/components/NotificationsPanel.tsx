import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Bell, TrendingDown, Tag, Check, Trash2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function NotificationsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications, dataUpdatedAt } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await axios.get('/api/notifications')).data,
    refetchInterval: 10000,
  });

  const [lastNotified, setLastNotified] = useState<number>(Date.now());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const requestPermission = async () => {
    if (typeof Notification !== 'undefined') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  useEffect(() => {
    if (notifications && notifications.length > 0) {
      // Find new unread notifications that we haven't alerted about
      const newestUnread = notifications.filter((n: any) => !n.is_read && new Date(n.created_at).getTime() > lastNotified);
      
      if (newestUnread.length > 0) {
        newestUnread.forEach((n: any) => {
          // Toast for active UI
          toast(n.type === 'price_drop' ? 'Przecena!' : 'Sprzedano!', {
            description: n.message,
            icon: n.type === 'price_drop' ? <TrendingDown className="text-brand" /> : <Tag className="text-blue-500" />
          });

          // System notification for background/lockscreen
          if (notificationPermission === 'granted' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
              registration.showNotification(n.type === 'price_drop' ? 'Przecena!' : 'Sprzedano!', {
                body: n.message,
                icon: 'https://picsum.photos/seed/autoolx192/192/192',
                data: { url: n.type === 'sold' ? `/archive?select=${n.offer_id}` : `/offers?select=${n.offer_id}` },
                tag: `offer-${n.offer_id}`
              });
            });
          }
        });
        setLastNotified(Date.now());
      }
    }
  }, [notifications, lastNotified, notificationPermission]);

  const readMutation = useMutation({
    mutationFn: async () => await axios.post('/api/notifications/read'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  });

  const clearMutation = useMutation({
    mutationFn: async () => await axios.delete('/api/notifications'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications?.filter((n: any) => !n.is_read).length || 0;

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      readMutation.mutate();
    }
  };

  const handleNotificationClick = (n: any) => {
    if (n.type === 'sold') {
      navigate(`/archive?select=${n.offer_id}`);
    } else {
      navigate(`/offers?select=${n.offer_id}`);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button 
        onClick={handleOpen}
        className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-xl hover:bg-surface-hover"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-surface border border-border shadow-2xl rounded-2xl overflow-hidden z-50 flex flex-col max-h-[80vh]"
          >
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0 bg-bg/50">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Bell size={16} className="text-brand" />
                Powiadomienia
              </h3>
              <div className="flex gap-3">
                {notificationPermission === 'default' && (
                  <button 
                    onClick={requestPermission}
                    className="text-[10px] uppercase font-bold text-brand hover:underline"
                  >
                    Włącz systemowe
                  </button>
                )}
                {notifications && notifications.length > 0 && (
                  <button onClick={() => clearMutation.mutate()} className="text-[10px] uppercase font-bold text-gray-500 hover:text-red-500 transition-colors flex items-center gap-1">
                    <Trash2 size={12} /> Wyczyść
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {notifications?.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  Brak nowych powiadomień.
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {notifications?.map((n: any) => (
                    <button 
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={cn(
                        "w-full text-left p-4 hover:bg-surface-hover transition-colors flex gap-4 items-start group",
                        !n.is_read ? "bg-brand/5" : ""
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                        n.type === 'price_drop' ? "bg-brand/10 text-brand" : "bg-blue-500/10 text-blue-500"
                      )}>
                        {n.type === 'price_drop' ? <TrendingDown size={14} /> : <Tag size={14} />}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className={cn("text-xs leading-relaxed", !n.is_read ? "text-white font-medium" : "text-gray-400")}>
                          {n.message}
                        </p>
                        <p className="text-[10px] text-gray-600 font-mono flex items-center gap-1 group-hover:text-brand transition-colors">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: pl })}
                          <ExternalLink size={10} className="inline opacity-0 group-hover:opacity-100 transition-opacity" />
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
