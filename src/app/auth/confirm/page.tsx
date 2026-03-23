'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function AuthConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = searchParams.get('token');
    const type = searchParams.get('type');
    const next = searchParams.get('next') || '/manager';

    if (!token || type !== 'magiclink') {
      setError('Invalid or missing confirmation token');
      setLoading(false);
      return;
    }

    // Verify the magic link token and sign in
    const verifyMagicLink = async () => {
      try {
        // Exchange the token for a session
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'magiclink',
        });

        if (verifyError) {
          console.error('Magic link verification failed:', verifyError);
          setError('This magic link has expired or is invalid. Please request a new one.');
          setLoading(false);
          return;
        }

        // Successfully logged in, redirect to the dashboard
        router.push(next);
      } catch (err) {
        console.error('Error verifying magic link:', err);
        setError('An error occurred while logging in. Please try again.');
        setLoading(false);
      }
    };

    verifyMagicLink();
  }, [searchParams, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4" />
          <p className="text-[var(--foreground-secondary)]">Logging you in...</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center p-8">
          <p className="text-[var(--danger)] mb-4">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="text-[var(--primary)] hover:underline"
          >
            Go to login page
          </button>
        </Card>
      </div>
    );
  }

  return null;
}
