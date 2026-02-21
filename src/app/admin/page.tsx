'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks';
import { Header, OnlineUsers } from '@/components/layout';
import { Button, Input, Select, Modal, Card, Badge } from '@/components/ui';
import type { Profile, UserRole } from '@/types';
import { 
  Users,
  UserPlus,
  Pencil,
  Trash2,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

const roleOptions = [
  { value: 'employee', label: 'Employee' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
];

const roleBadgeVariant: Record<UserRole, 'secondary' | 'primary' | 'danger'> = {
  employee: 'secondary',
  manager: 'primary',
  admin: 'danger',
};

export default function AdminDashboard() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('employee');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchUsers = useCallback(async (isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) {
      setLoading(true);
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUsers(data as Profile[]);
    }

    if (!isBackgroundRefresh) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !profile) {
      router.push('/login');
    } else if (profile && profile.role !== 'admin') {
      const redirectPath = profile.role === 'manager' ? '/manager' : '/employee';
      router.push(redirectPath);
    } else if (profile) {
      fetchUsers();
    }
  }, [profile, authLoading, router, fetchUsers]);

  // Real-time subscription for profiles
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel('admin-profiles')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          fetchUsers(true); // Background refresh - don't show loading spinner
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [profile, fetchUsers]);

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('employee');
    setFormError('');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setFormError('All fields are required');
      return;
    }

    setFormLoading(true);
    setFormError('');

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: role,
        },
      },
    });

    if (error) {
      setFormError(error.message);
      setFormLoading(false);
      return;
    }

    resetForm();
    setShowCreateModal(false);
    // Wait a moment for the trigger to create the profile
    setTimeout(fetchUsers, 1000);
    setFormLoading(false);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !fullName.trim()) {
      setFormError('Name is required');
      return;
    }

    setFormLoading(true);
    setFormError('');

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        role: role,
      })
      .eq('id', selectedUser.id);

    if (error) {
      setFormError(error.message);
      setFormLoading(false);
      return;
    }

    setShowEditModal(false);
    setSelectedUser(null);
    resetForm();
    fetchUsers();
    setFormLoading(false);
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === profile?.id) {
      alert('You cannot delete your own account!');
      return;
    }

    if (!confirm('Are you sure you want to delete this user? This will remove their profile. The auth account can be deleted from Supabase Dashboard.')) return;

    // Delete the profile (auth user remains but won't have access without profile)
    const { error } = await supabase.from('profiles').delete().eq('id', userId);

    if (!error) {
      fetchUsers();
    } else {
      alert('Failed to delete user: ' + error.message);
    }
  };

  const openEditModal = (user: Profile) => {
    setSelectedUser(user);
    setFullName(user.full_name);
    setEmail(user.email);
    setRole(user.role);
    setShowEditModal(true);
  };

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    managers: users.filter(u => u.role === 'manager').length,
    employees: users.filter(u => u.role === 'employee').length,
  };

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
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Admin Dashboard</h1>
            <p className="text-[var(--foreground-secondary)]">Manage users and system settings</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <UserPlus className="w-4 h-4" />
            Create User
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <Card>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-[var(--foreground-tertiary)]">Total</p>
                <p className="text-lg sm:text-xl font-bold">{stats.total}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-500 rounded-lg flex items-center justify-center text-white">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-[var(--foreground-tertiary)]">Admins</p>
                <p className="text-lg sm:text-xl font-bold">{stats.admins}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-500 rounded-lg flex items-center justify-center text-white">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-[var(--foreground-tertiary)]">Managers</p>
                <p className="text-lg sm:text-xl font-bold">{stats.managers}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500 rounded-lg flex items-center justify-center text-white">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-[var(--foreground-tertiary)]">Employees</p>
                <p className="text-lg sm:text-xl font-bold">{stats.employees}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Users Table - Mobile Optimized */}
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto -mx-px">
            <table className="w-full min-w-[500px]">
              <thead className="bg-[var(--background-tertiary)] border-b border-[var(--border)]">
                <tr>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase">User</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase hidden sm:table-cell">Email</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase">Role</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-[var(--foreground-secondary)] uppercase hidden md:table-cell">Created</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs font-semibold text-[var(--foreground-secondary)] uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[var(--foreground-tertiary)]">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-[var(--background-secondary)] transition-colors">
                      <td className="px-3 sm:px-4 py-2 sm:py-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--info)] flex items-center justify-center text-white font-medium text-xs sm:text-sm">
                            {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-medium text-sm sm:text-base text-[var(--foreground)]">{user.full_name}</span>
                            <span className="block sm:hidden text-xs text-[var(--foreground-tertiary)]">{user.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-[var(--foreground-secondary)] hidden sm:table-cell">{user.email}</td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3">
                        <Badge variant={roleBadgeVariant[user.role]}>
                          <span className="hidden sm:inline">{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
                          <span className="sm:hidden">{user.role.slice(0, 3)}</span>
                        </Badge>
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-[var(--foreground-secondary)] hidden md:table-cell">
                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3">
                        <div className="flex items-center justify-end gap-1 sm:gap-2">
                          <Button variant="ghost" size="sm" className="p-1 sm:p-2" onClick={() => openEditModal(user)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="danger" 
                            size="sm" 
                            className="p-1 sm:p-2"
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={user.id === profile?.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>

      {/* Create User Modal */}
      <Modal isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); resetForm(); }} title="Create New User" size="md">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="Enter full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <Input
            label="Email"
            type="email"
            placeholder="Enter email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            options={roleOptions}
          />
          {formError && (
            <p className="text-sm text-[var(--danger)]">{formError}</p>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={() => { setShowCreateModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedUser(null); resetForm(); }} title="Edit User" size="md">
        <form onSubmit={handleUpdateUser} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="Enter full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            disabled
          />
          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            options={roleOptions}
          />
          {formError && (
            <p className="text-sm text-[var(--danger)]">{formError}</p>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={() => { setShowEditModal(false); setSelectedUser(null); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              Update User
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
