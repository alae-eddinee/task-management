'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Card } from '@/components/ui';
import { useAuth } from '@/hooks';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const loginAttempted = useRef(false);

  // Redirect when profile is loaded after login
  useEffect(() => {
    if (!authLoading) {
      if (profile) {
        if (profile.role === 'admin') {
          router.push('/admin');
        } else if (profile.role === 'manager') {
          router.push('/manager');
        } else {
          router.push('/employee');
        }
      } else if (loginAttempted.current) {
        // Profile fetch failed after login attempt
        setError('Profile not found. Please contact an administrator.');
        setLoading(false);
        loginAttempted.current = false;
      }
    }
  }, [profile, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    loginAttempted.current = true;

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Wait for profile to load - the useEffect will handle redirect
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--background)] via-[var(--background-secondary)] to-[var(--background-accent)] p-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--primary)] to-[var(--info)] bg-clip-text text-transparent">
            Task Tracker
          </h1>
          <p className="text-[var(--foreground-secondary)] mt-2">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <p className="text-sm text-[var(--danger)] text-center">{error}</p>
          )}

          <Button type="submit" className="w-full" loading={loading}>
            Login
          </Button>
        </form>

        <div className="mt-6 p-4 bg-[var(--background-tertiary)] rounded-lg">
          <p className="text-xs text-[var(--foreground-tertiary)] text-center">
            <strong>Users are created via Supabase Auth.</strong><br />
            Admins can create users from the Admin Dashboard, or use Supabase Dashboard → Authentication → Users.
          </p>
        </div>
      </Card>
    </div>
  );
}
