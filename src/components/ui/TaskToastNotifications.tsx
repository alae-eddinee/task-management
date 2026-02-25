'use client';

import { useTaskNotifications, TaskNotification } from '@/hooks/useTaskNotifications';
import { X, FileText, MessageSquare, Plus, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';

const iconMap = {
  task_created: Plus,
  task_updated: RefreshCw,
  comment_added: MessageSquare,
  comment_deleted: MessageSquare,
  status_changed: CheckCircle2,
};

const typeLabelMap = {
  task_created: 'New Task',
  task_updated: 'Task Updated',
  comment_added: 'New Comment',
  comment_deleted: 'Comment Deleted',
  status_changed: 'Status Changed',
};

const typeColorMap = {
  task_created: 'bg-blue-500',
  task_updated: 'bg-amber-500',
  comment_added: 'bg-purple-500',
  comment_deleted: 'bg-red-500',
  status_changed: 'bg-green-500',
};

// Update favicon with notification badge
function updateFaviconBadge(count: number) {
  const originalFavicon = '/favicon.ico';
  let faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  
  if (!faviconLink) {
    faviconLink = document.createElement('link');
    faviconLink.rel = 'icon';
    faviconLink.type = 'image/x-icon';
    document.head.appendChild(faviconLink);
  }

  if (count === 0) {
    faviconLink.href = originalFavicon;
    document.title = document.title.replace(/^\(\d+\)\s*/, '');
    return;
  }

  // Draw badge on canvas
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Draw original favicon or circle background
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.arc(16, 16, 16, 0, 2 * Math.PI);
  ctx.fill();

  // Draw badge circle
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(24, 8, 8, 0, 2 * Math.PI);
  ctx.fill();

  // Draw count
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const badgeText = count > 9 ? '9+' : count.toString();
  ctx.fillText(badgeText, 24, 8);

  faviconLink.href = canvas.toDataURL();
  
  // Update title with count
  const title = document.title;
  const cleanTitle = title.replace(/^\(\d+\)\s*/, '');
  document.title = `(${count}) ${cleanTitle}`;
}

interface TaskToastNotificationsProps {
  onNotificationClick?: (taskId: string) => void;
}

export function TaskToastNotifications({ onNotificationClick }: TaskToastNotificationsProps) {
  const { notifications, clearNotification, notificationQueue } = useTaskNotifications();
  const prevCountRef = useRef(0);
  const audioUnlockedRef = useRef(false);

  // Unlock audio on first user interaction
  useEffect(() => {
    const unlockAudio = () => {
      if (audioUnlockedRef.current) return;
      
      const audio = new Audio('/sound/crystal_clear.mp3');
      audio.volume = 0;
      audio.play().then(() => {
        audioUnlockedRef.current = true;
        console.log('[Notification] Audio unlocked');
      }).catch(() => {
        // Still mark as unlocked - next attempt might work
        audioUnlockedRef.current = true;
      });
    };

    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  // Play sound and update favicon when new notifications arrive
  useEffect(() => {
    const totalCount = notifications.length + notificationQueue.length;
    
    // Play sound if count increased (new notification)
    if (totalCount > prevCountRef.current && totalCount > 0) {
      try {
        const audio = new Audio('/sound/crystal_clear.mp3');
        audio.volume = 0.5;
        
        audio.play()
          .then(() => console.log('[Notification] Sound playing'))
          .catch((err) => console.log('[Notification] Audio blocked:', err.message));
      } catch (err) {
        console.error('[Notification] Audio error:', err);
      }
    }
    prevCountRef.current = totalCount;

    // Update favicon badge
    if (typeof window !== 'undefined') {
      updateFaviconBadge(totalCount);
    }
  }, [notifications, notificationQueue]);

  // Deduplicate notifications by ID to prevent React key errors
  const uniqueNotifications = notifications.filter((n, index, self) => 
    index === self.findIndex((t) => t.id === n.id)
  );

  const handleClick = useCallback((notification: TaskNotification) => {
    console.log('[TaskToastNotifications] Clicked notification:', notification.id, 'taskId:', notification.taskId);
    console.log('[TaskToastNotifications] onNotificationClick:', onNotificationClick);
    if (onNotificationClick) {
      onNotificationClick(notification.taskId);
    }
    clearNotification(notification.id);
  }, [onNotificationClick, clearNotification]);

  if (uniqueNotifications.length === 0) return null;

  return (
    <div className="fixed top-4 sm:top-6 right-2 sm:right-6 left-2 sm:left-auto z-[100] flex flex-col gap-3 w-auto sm:w-[380px]">
      {uniqueNotifications.map((notification) => {
        const Icon = iconMap[notification.type];
        return (
          <div
            key={notification.id}
            onClick={() => handleClick(notification)}
            className="group cursor-pointer animate-slide-in-right"
            role="alert"
          >
            {/* Apple-style notification card */}
            <div className="relative overflow-hidden rounded-2xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-white/20 dark:border-white/10">
              <div className="p-4">
                {/* Header: App icon and name */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl ${typeColorMap[notification.type]} flex items-center justify-center shadow-lg`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Task Manager
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {typeLabelMap[notification.type]} • now
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearNotification(notification.id);
                    }}
                    className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Content */}
                <div className="space-y-1">
                  <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                    {notification.taskTitle}
                  </p>
                  <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                    {notification.message}
                  </p>
                </div>

                {/* Action hint */}
                <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    Click to view
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
