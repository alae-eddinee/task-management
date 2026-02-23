'use client';

import { useTaskNotifications, TaskNotification } from '@/hooks/useTaskNotifications';
import { X, FileText, MessageSquare, Plus, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useCallback } from 'react';

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

interface TaskToastNotificationsProps {
  onNotificationClick?: (taskId: string) => void;
}

export function TaskToastNotifications({ onNotificationClick }: TaskToastNotificationsProps) {
  const { notifications, clearNotification } = useTaskNotifications();

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
