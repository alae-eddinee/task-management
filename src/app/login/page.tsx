'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Card } from '@/components/ui';
import { useAuth } from '@/hooks';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, profile, loading: authLoading, user } = useAuth();
  const router = useRouter();
  const loginAttempted = useRef(false);
  const profileCheckAttempts = useRef(0);

  // Redirect when profile is loaded after login
  useEffect(() => {
    if (!authLoading) {
      if (profile) {
        // Profile loaded successfully - redirect
        profileCheckAttempts.current = 0;
        if (profile.role === 'admin') {
          router.push('/admin');
        } else if (profile.role === 'manager') {
          router.push('/manager');
        } else {
          router.push('/employee');
        }
      } else if (loginAttempted.current && user) {
        // User is logged in but profile is not loaded yet
        // Give it more time (retry up to 10 times over ~5 seconds)
        if (profileCheckAttempts.current < 10) {
          profileCheckAttempts.current++;
          const timer = setTimeout(() => {
            // Force re-check by toggling loading state
            setLoading(true);
            setTimeout(() => setLoading(false), 50);
          }, 500);
          return () => clearTimeout(timer);
        } else {
          // Profile fetch failed after multiple attempts
          setError('Profile not found. Please contact an administrator.');
          setLoading(false);
          loginAttempted.current = false;
          profileCheckAttempts.current = 0;
        }
      } else if (loginAttempted.current && !user) {
        // No user session - actual login failure
        setError('Login failed. Please check your credentials and try again.');
        setLoading(false);
        loginAttempted.current = false;
      }
    }
  }, [profile, authLoading, router, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    loginAttempted.current = true;

    try {
      const { error } = await signIn(email, password, rememberMe);

      if (error) {
        console.error('[Login] SignIn returned error:', error.message);
        setError(error.message || 'Login failed. Please check your credentials.');
        setLoading(false);
        return;
      }

      // Wait for profile to load - the useEffect will handle redirect
      console.log('[Login] SignIn successful, waiting for auth state...');
      
      // Add a safety timeout - if auth state doesn't update in 5 seconds, show error
      setTimeout(() => {
        if (loginAttempted.current && !user) {
          console.error('[Login] Auth state timeout - no user after 5s');
          setError('Login timed out. Please clear browser data and try again.');
          setLoading(false);
          loginAttempted.current = false;
        }
      }, 5000);
      
    } catch (err) {
      console.error('[Login] Exception during signIn:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
      loginAttempted.current = false;
    }
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

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[34px] text-[var(--foreground-tertiary)] hover:text-[var(--foreground-secondary)] transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
            />
            <span className="text-sm text-[var(--foreground-secondary)]">Remember me on this device</span>
          </label>

          {error && (
            <div className="space-y-2">
              <p className="text-sm text-[var(--danger)] text-center">{error}</p>
              <button
                type="button"
                onClick={() => {
                  // Clear all auth-related storage
                  localStorage.clear();
                  sessionStorage.clear();
                  // Clear cookies by setting expired date
                  document.cookie.split(';').forEach(cookie => {
                    const [name] = cookie.split('=');
                    document.cookie = `${name.trim()}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                  });
                  setError('Browser data cleared. Please try logging in again.');
                  window.location.reload();
                }}
                className="text-xs text-[var(--foreground-tertiary)] hover:text-[var(--danger)] underline text-center w-full"
              >
                Clear browser data and reload
              </button>
            </div>
          )}

          <Button type="submit" className="w-full" loading={loading}>
            Login
          </Button>
        </form>
      </Card>
    </div>
  );
}
