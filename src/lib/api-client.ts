// Custom API client using native fetch - bypasses Supabase SDK hanging issues
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Token storage key we control
const TOKEN_KEY = 'app-auth-token';

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// API functions
export async function apiGetEmployees() {
  const res = await apiFetch('/profiles?select=*&role=eq.employee');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Types for API responses
interface ApiTask extends Record<string, unknown> {
  id: string;
  title: string;
  description?: string;
  priority: 'bombe' | 'normal';
  status: 'todo' | 'in_progress' | 'done';
  due_date?: string;
  assigned_to: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  assigned_to_name?: { full_name: string };
  created_by_name?: { full_name: string };
}

export async function apiGetTasks(): Promise<ApiTask[]> {
  const res = await apiFetch('/tasks?select=*,assigned_to_name:profiles!tasks_assigned_to_fkey(full_name),created_by_name:profiles!tasks_created_by_fkey(full_name)&order=priority.desc,created_at.desc');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function apiCreateTask(data: Record<string, unknown>) {
  const res = await apiFetch('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.status === 201 ? await res.json().catch(() => null) : null;
}

export async function apiUpdateTask(id: string, data: Record<string, unknown>) {
  const res = await apiFetch(`/tasks?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : await res.json().catch(() => null);
}

export async function apiDeleteTask(id: string) {
  const res = await apiFetch(`/tasks?id=eq.${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : await res.json().catch(() => null);
}

interface ApiComment extends Record<string, unknown> {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name?: { full_name: string };
}

export async function apiGetComments(taskId: string): Promise<ApiComment[]> {
  const res = await apiFetch(`/comments?select=*,user_name:profiles(full_name)&task_id=eq.${taskId}&order=created_at.asc`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function apiCreateComment(data: { task_id: string; user_id: string; content: string }) {
  const res = await apiFetch('/comments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.status === 201 ? await res.json().catch(() => null) : null;
}

export async function apiDeleteComment(id: string) {
  const res = await apiFetch(`/comments?id=eq.${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : await res.json().catch(() => null);
}
