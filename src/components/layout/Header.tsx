'use client';

import { LogOut } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { Profile } from '@/types';
import { useAuth } from '@/hooks';

interface HeaderProps {
  user: Profile | null;
  onLogout?: () => void;
}

const roleColors = {
  admin: 'danger',
  manager: 'primary',
  employee: 'secondary',
} as const;

export function Header({ user, onLogout }: HeaderProps) {
  const { signOut } = useAuth();

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
    } else {
      await signOut();
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold bg-gradient-to-r from-[var(--primary)] to-[var(--info)] bg-clip-text text-transparent">
              Task Tracker
            </h1>
          </div>

          {user && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--info)] flex items-center justify-center text-white font-medium text-sm">
                  {getInitials(user.full_name)}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-[var(--foreground)]">{user.full_name}</p>
                  <p className="text-xs text-[var(--foreground-tertiary)]">{user.email}</p>
                </div>
                <Badge variant={roleColors[user.role]}>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>
              </div>
              <Button variant="danger" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
