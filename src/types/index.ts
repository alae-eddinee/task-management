export type UserRole = 'admin' | 'manager' | 'employee';

export type TaskPriority = 'bombe' | 'normal';

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: string;
  assigned_to: string;
  assigned_to_name?: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'task_assigned' | 'status_updated' | 'comment_added' | 'task_completed' | 'task_deleted';
  read: boolean;
  created_at: string;
}

export interface OnlineUser {
  user_id: string;
  user_name: string;
  online_at: string;
}
