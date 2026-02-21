'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks';
import { Header, StatsCard, OnlineUsers } from '@/components/layout';
import { Button, Input, Select, Textarea, Modal, Card, Badge } from '@/components/ui';
import { Task, Profile, TaskPriority, TaskStatus, Comment } from '@/types';
import { 
  ClipboardList, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Plus,
  Eye,
  Pencil,
  Trash2,
  MessageSquare,
  Users,
  Search
} from 'lucide-react';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

const priorityOptions = [
  { value: 'bombe', label: '🚨 BOMBE (Urgent)' },
  { value: 'normal', label: 'Normal' },
];

const statusOptions = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

const priorityBadgeVariant: Record<TaskPriority, 'danger' | 'secondary'> = {
  bombe: 'danger',
  normal: 'secondary',
};

const statusBadgeVariant: Record<TaskStatus, 'secondary' | 'primary' | 'success'> = {
  todo: 'secondary',
  in_progress: 'primary',
  done: 'success',
};

export default function ManagerDashboard() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [employeeSearch, setEmployeeSearch] = useState<string>('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState<boolean>(false);
  const [taskSearch, setTaskSearch] = useState<string>('');
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const fetchData = useCallback(async (isBackgroundRefresh = false) => {
    if (!profile) return;

    if (!isBackgroundRefresh) {
      setLoading(true);
    }

    // Fetch employees
    const { data: employeesData } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'employee');

    if (employeesData) {
      setEmployees(employeesData as Profile[]);
    }

    // Fetch tasks (show all for managers/admins)
    const { data: tasksData, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assigned_to_name:profiles!tasks_assigned_to_fkey(full_name),
        created_by_name:profiles!tasks_created_by_fkey(full_name)
      `)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && tasksData) {
      setTasks(tasksData.map(t => ({
        ...t,
        assigned_to_name: t.assigned_to_name?.full_name,
        created_by_name: t.created_by_name?.full_name,
      })) as Task[]);
    }

    if (!isBackgroundRefresh) {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (!authLoading && !profile) {
      router.push('/login');
    } else if (profile && profile.role === 'employee') {
      router.push('/employee');
    } else if (profile) {
      fetchData();
    }
  }, [profile, authLoading, router, fetchData]);

  // Real-time subscription for tasks
  useEffect(() => {
    const channel = supabase
      .channel('manager-tasks')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        () => {
          fetchData(true); // Background refresh - don't show loading spinner
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchData]);

  // Real-time subscription for comments
  useEffect(() => {
    if (!profile || !selectedTask) return;

    const channel = supabase
      .channel(`manager-comments:${selectedTask.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `task_id=eq.${selectedTask.id}`,
        },
        () => {
          fetchComments(selectedTask.id);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [profile, selectedTask]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('normal');
    setDueDate('');
    setAssignedTo('');
    setEmployeeSearch('');
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('handleCreateTask called');
    console.log('title:', title);
    console.log('assignedTo:', assignedTo);
    console.log('profile:', profile?.id, profile?.role);
    
    if (!title.trim()) {
      alert('Please enter a task title');
      return;
    }
    if (!assignedTo) {
      alert('Please select an employee');
      return;
    }
    if (!profile) {
      alert('User profile not loaded. Please refresh the page.');
      return;
    }

    setFormLoading(true);

    try {
      const taskData = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_date: dueDate || null,
        assigned_to: assignedTo,
        created_by: profile.id,
        status: 'todo' as const,
      };
      
      console.log('Inserting task:', taskData);
      
      // Try insert without select - simpler approach
      const insertResult = await supabase.from('tasks').insert(taskData);
      
      console.log('Insert complete:', insertResult);
      const { error, data } = insertResult;

      console.log('Insert result:', { error, data });

      if (error) {
        console.error('Error creating task:', error);
        alert('Failed to create task: ' + error.message);
      } else {
        // Create notification for assigned employee (non-blocking)
        supabase.from('notifications').insert({
          user_id: assignedTo,
          title: 'New Task Assigned',
          message: `You have been assigned a new task: "${title}"`,
          type: 'task_assigned',
        }).then(({ error: notifError }) => {
          if (notifError) console.error('Notification error:', notifError);
        });

        resetForm();
        setShowCreateModal(false);
        fetchData();
      }
    } catch (err) {
      console.error('Exception creating task:', err);
      alert('An error occurred while creating the task');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !title.trim()) return;

    setFormLoading(true);

    const { error } = await supabase
      .from('tasks')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_date: dueDate || null,
        assigned_to: assignedTo || selectedTask.assigned_to,
      })
      .eq('id', selectedTask.id);

    if (!error) {
      setShowEditModal(false);
      setSelectedTask(null);
      resetForm();
      fetchData();
    }

    setFormLoading(false);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    const { error } = await supabase.from('tasks').delete().eq('id', taskId);

    if (!error) {
      fetchData();
    }
  };

  const openEditModal = (task: Task) => {
    setSelectedTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setDueDate(task.due_date || '');
    setAssignedTo(task.assigned_to);
    setEmployeeSearch(task.assigned_to_name || '');
    setShowEditModal(true);
  };

  const fetchComments = async (taskId: string) => {
    const { data } = await supabase
      .from('comments')
      .select(`
        *,
        user_name:profiles(full_name)
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (data) {
      setComments(data.map(c => ({
        ...c,
        user_name: c.user_name?.full_name || 'Unknown',
      })) as Comment[]);
    }
  };

  const openDetailModal = async (task: Task) => {
    setSelectedTask(task);
    setComments([]); // Clear previous comments before fetching new ones
    setShowDetailModal(true);
    await fetchComments(task.id);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newComment.trim() || !profile) return;

    setCommentLoading(true);

    const { error } = await supabase.from('comments').insert({
      task_id: selectedTask.id,
      user_id: profile.id,
      content: newComment.trim(),
    });

    if (!error) {
      // Notify assigned employee
      if (selectedTask.assigned_to !== profile.id) {
        await supabase.from('notifications').insert({
          user_id: selectedTask.assigned_to,
          title: 'New Comment',
          message: `New comment on task "${selectedTask.title}"`,
          type: 'comment_added',
        });
      }

      setNewComment('');
      // Refetch comments
      await fetchComments(selectedTask.id);
    }

    setCommentLoading(false);
  };

  const getStats = () => {
    const total = tasks.length;
    const active = tasks.filter(t => t.status !== 'done').length;
    const completed = tasks.filter(t => t.status === 'done').length;
    const overdue = tasks.filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      return new Date(t.due_date) < new Date();
    }).length;
    return { total, active, completed, overdue };
  };

  const getEmployeeStats = (employeeId: string) => {
    const employeeTasks = tasks.filter(t => t.assigned_to === employeeId);
    const total = employeeTasks.length;
    const todo = employeeTasks.filter(t => t.status === 'todo').length;
    const inProgress = employeeTasks.filter(t => t.status === 'in_progress').length;
    const done = employeeTasks.filter(t => t.status === 'done').length;
    const bombe = employeeTasks.filter(t => t.priority === 'bombe' && t.status !== 'done').length;
    const overdue = employeeTasks.filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      return new Date(t.due_date) < new Date();
    }).length;
    return { total, todo, inProgress, done, bombe, overdue };
  };

  const getEmployeeTasks = (employeeId: string) => {
    const employeeTasks = tasks.filter(t => t.assigned_to === employeeId);
    return [...employeeTasks].sort((a, b) => {
      const aIsBombeActive = a.priority === 'bombe' && a.status !== 'done';
      const bIsBombeActive = b.priority === 'bombe' && b.status !== 'done';

      if (aIsBombeActive && !bIsBombeActive) return -1;
      if (bIsBombeActive && !aIsBombeActive) return 1;

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  const filteredTasks = tasks.filter(t => {
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchesSearch = taskSearch === '' || 
      (t.assigned_to_name && t.assigned_to_name.toLowerCase().includes(taskSearch.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  // Filter employees for search dropdown
  const filteredEmployees = employees.filter(e => 
    e.full_name.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  // Sort tasks: BOMBE (not done) first, then by date
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // BOMBE tasks that are not done always come first
    const aIsBombeActive = a.priority === 'bombe' && a.status !== 'done';
    const bIsBombeActive = b.priority === 'bombe' && b.status !== 'done';
    
    if (aIsBombeActive && !bIsBombeActive) return -1;
    if (bIsBombeActive && !aIsBombeActive) return 1;
    
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
      <Header user={profile} />
      {profile && <OnlineUsers currentUserId={profile.id} />}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Manager Dashboard</h1>
            <p className="text-[var(--foreground-secondary)]">Manage and track your team&apos;s tasks</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4" />
            Create Task
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard title="Total Tasks" value={stats.total} icon={<ClipboardList className="w-6 h-6" />} color="blue" />
          <StatsCard title="Active Tasks" value={stats.active} icon={<Clock className="w-6 h-6" />} color="orange" />
          <StatsCard title="Completed" value={stats.completed} icon={<CheckCircle className="w-6 h-6" />} color="green" />
          <StatsCard title="Overdue" value={stats.overdue} icon={<AlertTriangle className="w-6 h-6" />} color="red" />
        </div>

        {/* Filter */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-end">
          <div className="w-full sm:flex-1">
            <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1.5">
              Search by Employee
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-muted)]" />
              <input
                type="text"
                placeholder="Search employee name..."
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
              />
            </div>
          </div>
          <div className="w-full sm:w-64">
            <Select
              label="Filter by Status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              options={[
                { value: 'all', label: 'All Tasks' },
                ...statusOptions,
              ]}
              className="w-full"
            />
          </div>
        </div>

        {/* Tasks Table */}
        <Card padding="none">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-[var(--background-tertiary)] border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase">Task</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase">Assigned To</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase">Due Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--foreground-secondary)] uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {sortedTasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--foreground-tertiary)]">
                      No tasks found. Create your first task!
                    </td>
                  </tr>
                ) : (
                  sortedTasks.map((task) => (
                    <tr key={task.id} className={`hover:bg-[var(--background-secondary)] transition-colors ${task.priority === 'bombe' && task.status !== 'done' ? 'bg-red-50 dark:bg-red-900/20' : ''} ${task.status === 'done' ? 'opacity-50 bg-gray-50 dark:bg-gray-800/30' : ''}`}>
                      <td className="px-4 py-3">
                        <p className={`font-medium ${task.priority === 'bombe' && task.status !== 'done' ? 'text-red-600 dark:text-red-400 font-bold' : 'text-[var(--foreground)]'} ${task.status === 'done' ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>{task.title}</p>
                        {task.description && (
                          <p className={`text-sm text-[var(--foreground-tertiary)] truncate max-w-xs ${task.status === 'done' ? 'line-through' : ''}`}>{task.description}</p>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-sm ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-[var(--foreground-secondary)]'}`}>
                        {task.assigned_to_name || 'Unknown'}
                      </td>
                      <td className="px-4 py-3">
                        {task.priority === 'bombe' && (
                          <span className={task.status === 'done' ? 'line-through opacity-60' : ''}>
                            <Badge variant="danger">
                              🚨 BOMBE
                            </Badge>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusBadgeVariant[task.status]}>
                          {task.status === 'in_progress' ? 'In Progress' : task.status === 'todo' ? 'To Do' : 'Done'}
                        </Badge>
                      </td>
                      <td className={`px-4 py-3 text-sm ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-[var(--foreground-secondary)]'}`}>
                        {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openDetailModal(task)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {task.status !== 'done' && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => openEditModal(task)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="danger" size="sm" onClick={() => handleDeleteTask(task.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Employee Tracking Section */}
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-5 h-5 text-[var(--primary)]" />
            <h2 className="text-xl font-bold text-[var(--foreground)]">Employee Task Tracking</h2>
          </div>

          {employees.length === 0 ? (
            <Card>
              <p className="text-center text-[var(--foreground-tertiary)]">No employees found.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {employees.map((employee) => {
                const empStats = getEmployeeStats(employee.id);
                const empTasks = getEmployeeTasks(employee.id);
                
                return (
                  <Card key={employee.id} padding="none" className="overflow-hidden">
                    {/* Employee Header */}
                    <div className="px-4 py-3 bg-[var(--background-tertiary)] border-b border-[var(--border)]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--info)] flex items-center justify-center text-white font-medium text-sm">
                            {employee.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--foreground)] text-sm">{employee.full_name}</p>
                            <p className="text-xs text-[var(--foreground-tertiary)]">{empStats.total} tasks</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <span className="px-1.5 py-0.5 rounded bg-orange-200 text-orange-900 dark:bg-orange-900/60 dark:text-orange-200">
                            {empStats.todo}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-blue-200 text-blue-900 dark:bg-blue-900/60 dark:text-blue-200">
                            {empStats.inProgress}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-green-200 text-green-900 dark:bg-green-900/60 dark:text-green-200">
                            {empStats.done}
                          </span>
                          {empStats.bombe > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-200 animate-pulse font-bold">
                              🚨{empStats.bombe}
                            </span>
                          )}
                          {empStats.overdue > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-red-500 text-white font-bold">
                              {empStats.overdue}!
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Employee Tasks Table */}
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full">
                        <tbody className="divide-y divide-[var(--border)]">
                          {empTasks.length === 0 ? (
                            <tr>
                              <td className="px-4 py-4 text-center text-[var(--foreground-tertiary)] text-sm">
                                No tasks assigned
                              </td>
                            </tr>
                          ) : (
                            empTasks.map((task) => (
                              <tr key={task.id} className={`hover:bg-[var(--background-secondary)] ${task.priority === 'bombe' && task.status !== 'done' ? 'bg-red-50 dark:bg-red-900/10' : ''} ${task.status === 'done' ? 'opacity-50 bg-gray-50 dark:bg-gray-800/30' : ''}`}>
                                <td className="px-3 py-2">
                                  <p className={`text-sm truncate max-w-[180px] ${task.priority === 'bombe' && task.status !== 'done' ? 'text-red-600 dark:text-red-400 font-bold' : 'text-[var(--foreground)]'} ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}>{task.title}</p>
                                </td>
                                <td className="px-2 py-2">
                                  <span className={task.status === 'done' ? 'opacity-60' : ''}>
                                    <Badge variant={priorityBadgeVariant[task.priority]}>
                                      {task.priority === 'bombe' ? '🚨' : task.priority.charAt(0).toUpperCase()}
                                    </Badge>
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-right">
                                  <Button variant="ghost" size="sm" onClick={() => openDetailModal(task)}>
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Create Task Modal */}
      <Modal isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); resetForm(); }} title="Create New Task" size="lg">
        <form onSubmit={handleCreateTask} className="space-y-4">
          <Input
            label="Task Title"
            placeholder="Enter task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Textarea
            label="Description"
            placeholder="Enter task details"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1.5">
                Priority
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={priority === 'bombe'}
                  onChange={(e) => setPriority(e.target.checked ? 'bombe' : 'normal')}
                  className="w-4 h-4 rounded border-[var(--border)] text-[var(--danger)] focus:ring-[var(--primary)]"
                />
                <span className="text-sm text-[var(--foreground)]">🚨 BOMBE (Urgent)</span>
              </label>
            </div>
            <Input
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1.5">
              Assign to Employee
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-muted)] pointer-events-none" />
              <input
                type="text"
                placeholder="Search and select employee..."
                value={employeeSearch}
                onChange={(e) => {
                  setEmployeeSearch(e.target.value);
                  setShowEmployeeDropdown(true);
                  if (!e.target.value) setAssignedTo('');
                }}
                onFocus={() => setShowEmployeeDropdown(true)}
                onBlur={() => setTimeout(() => setShowEmployeeDropdown(false), 200)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
              />
              {showEmployeeDropdown && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-[var(--border)] rounded-lg max-h-48 overflow-y-auto shadow-lg">
                  {filteredEmployees.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-[var(--foreground-muted)]">No employees found</div>
                  ) : (
                    filteredEmployees.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onMouseDown={() => {
                          setAssignedTo(e.id);
                          setEmployeeSearch(e.full_name);
                          setShowEmployeeDropdown(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-[var(--background-secondary)] transition-colors ${assignedTo === e.id ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-medium' : 'text-[var(--foreground)]'}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--info)] flex items-center justify-center text-white text-xs font-medium">
                            {e.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          {e.full_name}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {assignedTo && !showEmployeeDropdown && (
              <p className="mt-1 text-xs text-green-600 font-medium">
                ✓ {employees.find(e => e.id === assignedTo)?.full_name} selected
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={() => { setShowCreateModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              Create Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Task Modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedTask(null); resetForm(); }} title="Edit Task" size="lg">
        <form onSubmit={handleUpdateTask} className="space-y-4">
          <Input
            label="Task Title"
            placeholder="Enter task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Textarea
            label="Description"
            placeholder="Enter task details"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1.5">
                Priority
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={priority === 'bombe'}
                  onChange={(e) => setPriority(e.target.checked ? 'bombe' : 'normal')}
                  className="w-4 h-4 rounded border-[var(--border)] text-[var(--danger)] focus:ring-[var(--primary)]"
                />
                <span className="text-sm text-[var(--foreground)]">🚨 BOMBE (Urgent)</span>
              </label>
            </div>
            <Input
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1.5">
              Assign to Employee
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-muted)] pointer-events-none" />
              <input
                type="text"
                placeholder="Search and select employee..."
                value={employeeSearch}
                onChange={(e) => {
                  setEmployeeSearch(e.target.value);
                  setShowEmployeeDropdown(true);
                  if (!e.target.value) setAssignedTo('');
                }}
                onFocus={() => setShowEmployeeDropdown(true)}
                onBlur={() => setTimeout(() => setShowEmployeeDropdown(false), 200)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
              />
              {showEmployeeDropdown && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-[var(--border)] rounded-lg max-h-48 overflow-y-auto shadow-lg">
                  {filteredEmployees.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-[var(--foreground-muted)]">No employees found</div>
                  ) : (
                    filteredEmployees.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onMouseDown={() => {
                          setAssignedTo(e.id);
                          setEmployeeSearch(e.full_name);
                          setShowEmployeeDropdown(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-[var(--background-secondary)] transition-colors ${assignedTo === e.id ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-medium' : 'text-[var(--foreground)]'}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--info)] flex items-center justify-center text-white text-xs font-medium">
                            {e.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          {e.full_name}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {assignedTo && !showEmployeeDropdown && (
              <p className="mt-1 text-xs text-green-600 font-medium">
                ✓ {employees.find(e => e.id === assignedTo)?.full_name} selected
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={() => { setShowEditModal(false); setSelectedTask(null); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              Update Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* Task Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => { setShowDetailModal(false); setSelectedTask(null); setComments([]); setNewComment(''); }} title="Task Details" size="lg">
        {selectedTask && (
          <div className="space-y-4">
            <div>
              <h3 className={`text-lg font-semibold ${selectedTask.priority === 'bombe' && selectedTask.status !== 'done' ? 'text-red-600 dark:text-red-400' : 'text-[var(--foreground)]'}`}>{selectedTask.title}</h3>
              {selectedTask.description && (
                <p className="mt-2 text-[var(--foreground-secondary)]">{selectedTask.description}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-[var(--foreground-tertiary)]">Assigned To</p>
                <p className="font-medium">{selectedTask.assigned_to_name}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--foreground-tertiary)]">Priority</p>
                <Badge variant={priorityBadgeVariant[selectedTask.priority]}>
                  {selectedTask.priority === 'bombe' ? '🚨 BOMBE' : selectedTask.priority}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-[var(--foreground-tertiary)]">Status</p>
                <Badge variant={statusBadgeVariant[selectedTask.status]}>
                  {selectedTask.status === 'in_progress' ? 'In Progress' : selectedTask.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-[var(--foreground-tertiary)]">Due Date</p>
                <p className="font-medium">{selectedTask.due_date ? format(new Date(selectedTask.due_date), 'MMM d, yyyy') : 'No due date'}</p>
              </div>
            </div>

            {/* Comments Section */}
            <div className="border-t border-[var(--border)] pt-4">
              <h4 className="font-semibold text-[var(--foreground)] mb-3">Comments</h4>
              <div className="space-y-3 max-h-48 overflow-y-auto mb-4">
                {comments.length === 0 ? (
                  <p className="text-sm text-[var(--foreground-tertiary)]">No comments yet.</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="bg-[var(--background-tertiary)] rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{comment.user_name}</span>
                        <span className="text-xs text-[var(--foreground-muted)]">
                          {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                        </span>
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

            <div className="text-sm text-[var(--foreground-tertiary)]">
              <MessageSquare className="w-4 h-4 inline mr-1" />
              Created {format(new Date(selectedTask.created_at), 'MMM d, yyyy h:mm a')}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
