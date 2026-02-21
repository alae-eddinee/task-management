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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/20 via-[var(--background)] to-[var(--info)]/20" />
      
      {/* Animated background shapes */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-[var(--primary)]/10 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-[var(--info)]/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <Card className="w-full max-w-md relative z-10">
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
      </Card>
    </div>
  );
}
