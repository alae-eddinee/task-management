'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth, useTaskNotifications } from '@/hooks';
import { Header, StatsCard } from '@/components/layout';
import { Button, Card, Badge, Modal, Textarea } from '@/components/ui';
import { TaskNotificationProvider, type TaskNotificationType } from '@/hooks/useTaskNotifications';
import { TaskToastNotifications } from '@/components/ui/TaskToastNotifications';
import type { Task, TaskStatus, Comment } from '@/types';
import { apiGetTasks, apiUpdateTask, apiGetComments, apiCreateComment, apiDeleteComment } from '@/lib/api-client';
import { 
  ClipboardList, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Eye,
  Play,
  CheckCheck,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';

const statusOptions: { value: TaskStatus; label: string; icon: React.ReactNode }[] = [
  { value: 'todo', label: 'To Do', icon: <Clock className="w-4 h-4" /> },
  { value: 'in_progress', label: 'In Progress', icon: <Play className="w-4 h-4" /> },
  { value: 'done', label: 'Done', icon: <CheckCircle className="w-4 h-4" /> },
];

const statusBadgeVariant: Record<TaskStatus, 'secondary' | 'primary' | 'success'> = {
  todo: 'secondary',
  in_progress: 'primary',
  done: 'success',
};

export default function EmployeeDashboard() {
  return (
    <TaskNotificationProvider>
      <EmployeeDashboardInner />
    </TaskNotificationProvider>
  );
}

function EmployeeDashboardInner() {
  const { profile, loading: authLoading } = useAuth();
  const { addNotification, markTaskAsRead, notifications, clearNotification } = useTaskNotifications();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutatingTaskIds, setMutatingTaskIds] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const debounce = useCallback((fn: () => void, delayMs: number) => {
    let timeoutId: number | undefined;
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(fn, delayMs);
    };
  }, []);

  const setTaskMutating = useCallback((taskId: string, isMutating: boolean) => {
    setMutatingTaskIds((prev) => {
      const next = new Set(prev);
      if (isMutating) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  }, []);

  const fetchTasks = useCallback(async (isBackgroundRefresh = false) => {
    if (!profile) return;

    if (!isBackgroundRefresh) {
      setLoading(true);
    }

    // Timeout failsafe - ensure loading always completes
    const timeoutId = setTimeout(() => {
      console.warn('[fetchTasks] Timeout reached, forcing loading to false');
      setLoading(false);
    }, 15000);

    try {
      const data = await apiGetTasks();
      // Filter tasks assigned to current employee
      const myTasks = data.filter((t) => t.assigned_to === profile.id);
      const nextTasks = myTasks.map((t) => ({
        ...t,
        assigned_to_name: t.assigned_to_name?.full_name,
        created_by_name: t.created_by_name?.full_name,
      })) as Task[];

      setTasks(nextTasks);

      // Update selectedTask if it exists in the new tasks list
      setSelectedTask((prevSelected) => {
        if (!prevSelected) return null;
        const nextSelected = nextTasks.find((t) => t.id === prevSelected.id);
        // Only update if task still exists - don't clear if modal is open
        return nextSelected || prevSelected;
      });
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      clearTimeout(timeoutId);
      if (!isBackgroundRefresh) {
        setLoading(false);
      }
    }
  }, [profile]);

  useEffect(() => {
    if (!selectedTask) return;
    const nextSelected = tasks.find(t => t.id === selectedTask.id);
    if (nextSelected) setSelectedTask(nextSelected);
  }, [tasks]);

  useEffect(() => {
    if (!authLoading && !profile) {
      router.push('/login');
    } else if (profile && profile.role !== 'employee') {
      const redirectPath = profile.role === 'admin' ? '/admin' : '/manager';
      router.push(redirectPath);
    } else if (profile) {
      fetchTasks();
    }
  }, [profile, authLoading, router, fetchTasks]);

  // Real-time subscription for tasks with notifications
  useEffect(() => {
    if (!profile) return;

    const refresh = debounce(() => fetchTasks(true), 300);

    const channel = supabase
      .channel(`employee-tasks:${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        async (payload) => {
          console.log('[Realtime] Task event received:', payload.eventType, payload);
          
          // For DELETE events, check if the deleted task was assigned to current user
          if (payload.eventType === 'DELETE') {
            const deletedTask = payload.old as Task;
            let assignedTo = deletedTask?.assigned_to;
            let taskTitle = deletedTask?.title || 'Unknown Task';
            let taskId = deletedTask?.id;
            
            // If payload is incomplete, check local tasks array
            if (!assignedTo && taskId) {
              const localTask = tasks.find(t => t.id === taskId);
              if (localTask) {
                assignedTo = localTask.assigned_to;
                taskTitle = localTask.title;
                console.log('[Realtime] DELETE - Found task in local state:', localTask);
              }
            }
            
            console.log('[Realtime] DELETE event - assigned_to:', assignedTo, 'profile.id:', profile.id);
            
            if (assignedTo === profile.id) {
              console.log('[Realtime] DELETE - Adding notification for employee');
              addNotification({
                taskId: taskId || 'unknown',
                taskTitle: taskTitle,
                type: 'task_updated',
                message: 'Task has been deleted by manager',
                read: false,
              });
            } else {
              console.log('[Realtime] DELETE - Not notifying: not assigned to this user');
            }
            refresh();
            return;
          }
          
          // For INSERT/UPDATE, check the new record's assigned_to
          const assignedTo = payload.new?.assigned_to;
          console.log('[Realtime] Task assigned_to:', assignedTo, 'Current user:', profile.id);
          
          // Only refresh if this task is assigned to current user
          if (assignedTo === profile.id) {
            console.log('[Realtime] Refreshing tasks for current user');
            
            // Show notification for new tasks (only if created by someone else - manager)
            if (payload.eventType === 'INSERT') {
              const newTask = payload.new as Task;
              // Only notify if created by someone else (manager)
              if (newTask.created_by !== profile.id) {
                addNotification({
                  taskId: newTask.id,
                  taskTitle: newTask.title,
                  type: 'task_created',
                  message: 'New task assigned to you',
                  read: false,
                });
              }
            }
            
            // Show notification for updates (only if updated by someone else - manager)
            if (payload.eventType === 'UPDATE') {
              const updatedTask = payload.new as Task;
              const oldTask = payload.old as Task;
              
              // Only notify if manager updated it, not self
              if (updatedTask.updated_by !== profile.id && updatedTask.updated_by) {
                // Build detailed change messages
                const changes: string[] = [];
                
                if (oldTask.status !== updatedTask.status) {
                  changes.push(`status changed to "${updatedTask.status}"`);
                }
                if (oldTask.priority !== updatedTask.priority) {
                  changes.push(`priority changed to "${updatedTask.priority}"`);
                }
                if (oldTask.title !== updatedTask.title) {
                  changes.push(`title updated`);
                }
                if (oldTask.description !== updatedTask.description) {
                  changes.push(`description updated`);
                }
                if (oldTask.due_date !== updatedTask.due_date) {
                  if (updatedTask.due_date) {
                    changes.push(`due date set to ${format(new Date(updatedTask.due_date), 'MMM d, yyyy')}`);
                  } else {
                    changes.push(`due date removed`);
                  }
                }
                
                // Create a single notification with all changes
                let type: TaskNotificationType = 'task_updated';
                let message: string;
                
                if (changes.length === 0) {
                  message = 'Task has been updated by manager';
                } else if (changes.length === 1) {
                  message = changes[0].charAt(0).toUpperCase() + changes[0].slice(1);
                  if (oldTask.status !== updatedTask.status) {
                    type = 'status_changed';
                  }
                } else {
                  message = `Multiple changes: ${changes.join(', ')}`;
                }
                
                addNotification({
                  taskId: updatedTask.id,
                  taskTitle: updatedTask.title,
                  type,
                  message,
                  read: false,
                });
              }
            }
            
            refresh();
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    return () => {
      channel.unsubscribe();
    };
  }, [profile, fetchTasks, debounce, addNotification]);

  // Real-time subscription for comments with notifications
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel(`employee-comments-global:${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments' },
        async (payload) => {
          console.log('[Realtime] Comment received:', payload);
          const newComment = payload.new as Comment;
          
          // Only notify if comment is from someone else (manager)
          if (newComment.user_id !== profile.id) {
            console.log('[Realtime] Comment from someone else, checking task...');
            // Find the task to check if it's assigned to this employee
            const { data: taskData } = await supabase
              .from('tasks')
              .select('id, title, assigned_to')
              .eq('id', newComment.task_id)
              .single();
            
            console.log('[Realtime] Task data:', taskData, 'My ID:', profile.id);
            
            // Only notify if this task is assigned to current user
            if (taskData && taskData.assigned_to === profile.id) {
              console.log('[Realtime] Adding notification for comment');
              addNotification({
                taskId: newComment.task_id,
                taskTitle: taskData.title,
                type: 'comment_added',
                message: 'New comment from manager',
                read: false,
              });
            }
          }
          
          // Refresh comments if viewing the task
          if (selectedTask?.id === newComment.task_id) {
            fetchComments(newComment.task_id);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'comments' },
        async (payload) => {
          console.log('[Realtime] Comment deleted:', payload);
          const deletedComment = payload.old as Comment;
          
          // Only notify if comment was from someone else (manager)
          if (deletedComment.user_id !== profile.id) {
            console.log('[Realtime] Comment deleted by someone else, checking task...');
            // Find the task to check if it's assigned to this employee
            const { data: taskData } = await supabase
              .from('tasks')
              .select('id, title, assigned_to')
              .eq('id', deletedComment.task_id)
              .single();
            
            // Only notify if this task is assigned to current user
            if (taskData && taskData.assigned_to === profile.id) {
              console.log('[Realtime] Adding notification for deleted comment');
              addNotification({
                taskId: deletedComment.task_id,
                taskTitle: taskData.title,
                type: 'comment_deleted',
                message: 'Comment deleted by manager',
                read: false,
              });
            }
          }
          
          // Refresh comments if viewing the task
          if (selectedTask?.id === deletedComment.task_id) {
            fetchComments(deletedComment.task_id);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Comment subscription status:', status);
      });

    return () => {
      channel.unsubscribe();
    };
  }, [profile, selectedTask, addNotification]);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const prevTask = tasks.find(t => t.id === taskId);
    if (!prevTask) return;

    setTaskMutating(taskId, true);

    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => (prev ? { ...prev, status: newStatus } : prev));
    }

    try {
      await apiUpdateTask(taskId, { status: newStatus });

      // Notify manager (best-effort) - DISABLED due to notification timeout issues
      // if (newStatus === 'done') {
      //   supabase.from('notifications').insert({
      //     user_id: prevTask.created_by,
      //     title: 'Task Completed',
      //     message: `Task "${prevTask.title}" has been marked as complete`,
      //     type: 'task_completed',
      //   }).then(({ error: notifError }) => {
      //     if (notifError) console.error('Notification error:', notifError);
      //   });
      // } else {
      //   supabase.from('notifications').insert({
      //     user_id: prevTask.created_by,
      //     title: 'Task Status Updated',
      //     message: `Task "${prevTask.title}" status changed to ${newStatus.replace('_', ' ')}`,
      //     type: 'status_updated',
      //   }).then(({ error: notifError }) => {
      //     if (notifError) console.error('Notification error:', notifError);
      //   });
      // }
    } catch (err) {
      // Rollback
      setTasks((prev) => prev.map((t) => (t.id === taskId ? prevTask : t)));
      if (selectedTask?.id === taskId) setSelectedTask(prevTask);
      alert('Failed to update status: ' + (err as Error).message);
    } finally {
      setTaskMutating(taskId, false);
      fetchTasks(true);
    }
  };

  const handleBombeToggle = async (taskId: string, isBombe: boolean) => {
    const newPriority = isBombe ? 'bombe' : 'normal';
    const prevTask = tasks.find(t => t.id === taskId);
    if (!prevTask) return;

    setTaskMutating(taskId, true);

    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, priority: newPriority } : t)));
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => (prev ? { ...prev, priority: newPriority } : prev));
    }

    try {
      await apiUpdateTask(taskId, { priority: newPriority });
    } catch (err) {
      // Rollback
      setTasks((prev) => prev.map((t) => (t.id === taskId ? prevTask : t)));
      if (selectedTask?.id === taskId) setSelectedTask(prevTask);
      alert('Failed to update priority: ' + (err as Error).message);
    } finally {
      setTaskMutating(taskId, false);
      fetchTasks(true);
    }
  };

  const fetchComments = useCallback(async (taskId: string) => {
    if (!taskId) return;
    // Check if task still exists in our list
    const taskExists = tasks.some(t => t.id === taskId);
    if (!taskExists) {
      console.log('[fetchComments] Task no longer exists, skipping fetch');
      return;
    }
    try {
      const data = await apiGetComments(taskId);
      setComments(
        data.map((c) => ({
          ...c,
          user_name: c.user_name?.full_name || 'Unknown',
        })) as Comment[]
      );
    } catch (err) {
      console.error('[fetchComments] Failed:', err);
      // Don't throw - just log the error
    }
  }, [tasks]);

  const openDetailModal = (task: Task) => {
    setSelectedTask(task);
    setComments([]);
    setShowDetailModal(true);
    fetchComments(task.id).catch((err) => {
      console.error('Failed to fetch comments:', err);
    });
  };

  const handleNotificationClick = useCallback((taskId: string) => {
    console.log('[EmployeeDashboard] Notification clicked for task:', taskId);
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      console.log('[EmployeeDashboard] Found task, opening detail modal');
      markTaskAsRead(taskId);
      openDetailModal(task);
    } else {
      console.log('[EmployeeDashboard] Task not found in current tasks list');
    }
  }, [tasks, markTaskAsRead]);

  // Clear all notifications on mount (fresh start)
  useEffect(() => {
    notifications.forEach(n => clearNotification(n.id));
  }, []);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newComment.trim() || !profile) return;

    setCommentLoading(true);

    try {
      await apiCreateComment({
        task_id: selectedTask.id,
        user_id: profile.id,
        content: newComment.trim(),
      });

      // Notify manager - DISABLED due to notification timeout issues
      // await supabase.from('notifications').insert({
      //   user_id: selectedTask.created_by,
      //   title: 'New Comment',
      //   message: `New comment on task "${selectedTask.title}"`,
      //   type: 'comment_added',
      // });

      setNewComment('');
      await fetchComments(selectedTask.id);
    } catch (err) {
      alert('Failed to add comment: ' + (err as Error).message);
    }

    setCommentLoading(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    if (!selectedTask) return;

    try {
      await apiDeleteComment(commentId);
      await fetchComments(selectedTask.id);
    } catch (err) {
      console.error('Error deleting comment:', err);
      alert('Failed to delete comment: ' + (err as Error).message);
    }
  };

  const getStats = () => {
    const total = tasks.length;
    const todo = tasks.filter(t => t.status === 'todo').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const done = tasks.filter(t => t.status === 'done').length;
    const overdue = tasks.filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      return new Date(t.due_date) < new Date();
    }).length;
    return { total, todo, inProgress, done, overdue };
  };

  const filteredTasks = filterStatus === 'all' 
    ? tasks 
    : tasks.filter(t => t.status === filterStatus);

  // Sort tasks: Done tasks at bottom, then BOMBE first, then by date
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // Done tasks go to the bottom
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (b.status === 'done' && a.status !== 'done') return -1;
    
    // Among non-done tasks: BOMBE tasks come first
    const aIsBombe = a.priority === 'bombe';
    const bIsBombe = b.priority === 'bombe';
    
    if (aIsBombe && !bIsBombe) return -1;
    if (bIsBombe && !aIsBombe) return 1;
    
    // Then sort by created_at (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const stats = getStats();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background-secondary)]">
      <TaskToastNotifications onNotificationClick={handleNotificationClick} />
      <Header user={profile} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">My Tasks</h1>
          <p className="text-[var(--foreground-secondary)]">View and manage your assigned tasks</p>
        </div>

        {/* Stats - 2x2 Grid on mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
          <StatsCard title="Total" value={stats.total} icon={<ClipboardList className="w-5 h-5" />} color="blue" />
          <StatsCard title="To Do" value={stats.todo} icon={<Clock className="w-5 h-5" />} color="orange" />
          <StatsCard title="Active" value={stats.inProgress} icon={<Play className="w-5 h-5" />} color="blue" />
          <StatsCard title="Done" value={stats.done} icon={<CheckCircle className="w-5 h-5" />} color="green" />
          <StatsCard title="Overdue" value={stats.overdue} icon={<AlertTriangle className="w-5 h-5" />} color="red" />
        </div>

        {/* Filter */}
        <div className="mb-6 flex gap-1.5 sm:gap-2 flex-wrap">
          {['all', 'todo', 'in_progress', 'done'].map((status) => (
            <Button
              key={status}
              variant={filterStatus === status ? 'primary' : 'ghost'}
              size="sm"
              className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5"
              onClick={() => setFilterStatus(status)}
            >
              {status === 'all' ? 'All' : status === 'in_progress' ? 'Active' : status === 'todo' ? 'To Do' : 'Done'}
            </Button>
          ))}
        </div>

        {/* Tasks - Mobile: Card Layout, Desktop: Table */}
        <Card padding="none" className="overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--background-tertiary)] border-b border-[var(--border)] sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase">Task</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase">Due</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase hidden md:table-cell">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--foreground-secondary)] uppercase">View</th>
                  </tr>
                </thead>
              </table>
              <div className="max-h-[480px] overflow-y-auto">
                <table className="w-full">
                  <tbody className="divide-y divide-[var(--border)]">
                    {sortedTasks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-[var(--foreground-tertiary)]">
                          No tasks assigned to you yet.
                        </td>
                      </tr>
                    ) : (
                      sortedTasks.map((task) => (
                        <tr key={task.id} className={`transition-colors cursor-pointer relative ${
                          task.status === 'done'
                            ? 'opacity-50 bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                            : task.priority === 'bombe'
                              ? 'bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-800'
                              : 'hover:bg-[var(--background-secondary)]'
                        }`}>
                          <td className="px-4 py-3 relative">
                            <p className={`font-medium text-base ${task.priority === 'bombe' && task.status !== 'done' ? 'text-white font-bold' : 'text-[var(--foreground)]'} ${task.status === 'done' ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>{task.title}</p>
                            <p className={`text-xs ${task.priority === 'bombe' && task.status !== 'done' ? 'text-white' : 'text-[var(--foreground-tertiary)]'}`}>
                              Created: {format(new Date(task.created_at), 'MMM d, yyyy')}
                            </p>
                            {task.description && (
                              <p className={`text-sm truncate max-w-xs ${task.priority === 'bombe' && task.status !== 'done' ? 'text-red-100' : 'text-[var(--foreground-tertiary)]'} ${task.status === 'done' ? 'line-through' : ''}`}>{task.description}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={task.status}
                              onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                              disabled={mutatingTaskIds.has(task.id)}
                              className={`px-3 py-1.5 rounded-md text-sm font-medium border cursor-pointer focus:ring-2 focus:ring-[var(--primary)] ${
                                task.priority === 'bombe' && task.status !== 'done'
                                  ? 'bg-white/20 text-white border-white/50'
                                  : task.status === 'done' ? 'bg-green-500 text-white dark:bg-green-600 border-transparent' :
                                  task.status === 'todo' ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 border-transparent' :
                                  'bg-blue-500 text-white dark:bg-blue-600 border-transparent'
                              }`}
                            >
                              {statusOptions.map((opt) => (
                                <option key={opt.value} value={opt.value} className="bg-white text-gray-900">
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            {mutatingTaskIds.has(task.id) && (
                              <span className="inline-block align-middle ml-2">
                                <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                              </span>
                            )}
                          </td>
                          <td className={`px-4 py-3 text-sm ${task.status === 'done' ? 'text-gray-400 line-through' : ''}`}>
                            {task.due_date ? (
                              <span className={task.priority === 'bombe' && task.status !== 'done' ? 'text-white font-bold' : new Date(task.due_date) < new Date() && task.status !== 'done' ? 'text-[var(--danger)] font-bold' : 'text-[var(--foreground-secondary)]'}>
                                {format(new Date(task.due_date), 'MMM d')}
                              </span>
                            ) : (
                              <span className={task.priority === 'bombe' && task.status !== 'done' ? 'text-red-100' : 'text-[var(--foreground-tertiary)]'}>-</span>
                            )}
                          </td>
                          <td className={`px-4 py-3 text-sm hidden md:table-cell ${
                            task.status === 'done' ? 'text-gray-400 line-through' :
                            task.priority === 'bombe' ? 'text-white' :
                            'text-[var(--foreground-secondary)]'
                          }`}>
                            {task.created_by_name || 'Unknown'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end">
                              <Button 
                                variant={task.priority === 'bombe' && task.status !== 'done' ? 'ghost' : 'ghost'} 
                                size="sm" 
                                onClick={() => openDetailModal(task)}
                                className={`p-2 ${task.priority === 'bombe' && task.status !== 'done' ? 'text-white hover:bg-white/20' : ''}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        {/* Mobile Card View */}
          <div className="sm:hidden">
            {sortedTasks.length === 0 ? (
              <div className="px-4 py-8 text-center text-[var(--foreground-tertiary)]">
                No tasks assigned to you yet.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {sortedTasks.map((task) => (
                  <div 
                    key={task.id} 
                    className={`p-3 relative ${
                      task.status === 'done'
                        ? 'opacity-60 bg-gray-50 dark:bg-gray-800/20'
                        : task.priority === 'bombe'
                          ? 'bg-red-600'
                          : 'bg-[var(--background)]'
                    }`}
                  >
                    {/* Title & Status Row */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm leading-tight ${task.priority === 'bombe' && task.status !== 'done' ? 'text-white' : 'text-[var(--foreground)]'} ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}>
                          {task.title}
                        </p>
                        <p className={`text-xs ${task.priority === 'bombe' && task.status !== 'done' ? 'text-white' : 'text-[var(--foreground-tertiary)]'}`}>
                          Created: {format(new Date(task.created_at), 'MMM d, yyyy')}
                        </p>
                        {task.description && (
                          <p className={`text-xs mt-0.5 line-clamp-1 ${task.priority === 'bombe' && task.status !== 'done' ? 'text-red-100' : 'text-[var(--foreground-tertiary)]'} ${task.status === 'done' ? 'line-through' : ''}`}>
                            {task.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {task.priority === 'bombe' && task.status !== 'done' && (
                          <span className="text-xs font-bold text-white animate-pulse">🚨</span>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => openDetailModal(task)}
                          className={`p-1 ${task.priority === 'bombe' && task.status !== 'done' ? 'text-white hover:bg-white/20' : ''}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Action Row */}
                    <div className="flex items-center gap-2">
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                        disabled={mutatingTaskIds.has(task.id)}
                        className={`px-2 py-1 rounded text-xs font-medium border cursor-pointer ${
                          task.priority === 'bombe' && task.status !== 'done'
                            ? 'bg-white/20 text-white border-white/50'
                            : task.status === 'done' ? 'bg-green-500 text-white border-transparent' :
                            task.status === 'todo' ? 'bg-gray-200 text-gray-700 border-transparent' :
                            'bg-blue-500 text-white border-transparent'
                        }`}
                      >
                        {statusOptions.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-white text-gray-900">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {mutatingTaskIds.has(task.id) && (
                        <span className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                      )}
                      {task.due_date && (
                        <span className={`text-xs px-2 py-1 rounded ml-auto ${
                          task.priority === 'bombe' && task.status !== 'done'
                            ? 'bg-white/20 text-white'
                            : new Date(task.due_date) < new Date() && task.status !== 'done'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}>
                          {format(new Date(task.due_date), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </main>

      {/* Task Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => { setShowDetailModal(false); setSelectedTask(null); setComments([]); setNewComment(''); }} title="Task Details" size="lg">
        {selectedTask && (
          <div className="space-y-4">
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-lg font-semibold text-[var(--foreground)]">{selectedTask.title}</h3>
                {selectedTask.priority === 'bombe' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold bg-[var(--danger)] text-white animate-pulse">
                    🚨 BOMBE
                  </span>
                )}
              </div>
              {selectedTask.description && (
                <p className="text-[var(--foreground-secondary)]">{selectedTask.description}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 py-4 border-y border-[var(--border)]">
              <div>
                <p className="text-sm text-[var(--foreground-tertiary)]">Status</p>
                <Badge variant={statusBadgeVariant[selectedTask.status]}>
                  {selectedTask.status === 'in_progress' ? 'In Progress' : selectedTask.status === 'todo' ? 'To Do' : 'Done'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-[var(--foreground-tertiary)]">Due Date</p>
                <p className="font-medium">{selectedTask.due_date ? format(new Date(selectedTask.due_date), 'MMM d, yyyy') : 'No due date'}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--foreground-tertiary)]">Created By</p>
                <p className="font-medium">{selectedTask.created_by_name}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--foreground-tertiary)]">Created</p>
                <p className="font-medium">{format(new Date(selectedTask.created_at), 'MMM d, yyyy')}</p>
              </div>
            </div>

            {/* Comments Section */}
            <div>
              <h4 className="font-semibold text-[var(--foreground)] mb-3">Comments</h4>
              <div className="space-y-3 max-h-48 overflow-y-auto mb-4">
                {comments.length === 0 ? (
                  <p className="text-sm text-[var(--foreground-tertiary)]">No comments yet.</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="bg-[var(--background-tertiary)] rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{comment.user_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--foreground-muted)]">
                            {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 text-[var(--danger)] hover:bg-[var(--danger)]/10"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-[var(--foreground-secondary)]">{comment.content}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddComment} className="flex gap-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1"
                  rows={1}
                />
                <Button type="submit" loading={commentLoading} disabled={!newComment.trim()}>
                  Send
                </Button>
              </form>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
