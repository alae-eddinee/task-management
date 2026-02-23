'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { setAuthToken } from '@/lib/api-client';
import { Profile } from '@/types';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchProfile = async (userId: string, retries = 0): Promise<boolean> => {
    console.log('[useAuth] Fetching profile for user:', userId, 'retry:', retries);
    
    // Timeout wrapper - if query hangs, reject after 5 seconds
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Profile fetch timeout')), 5000);
    });
    
    try {
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      const { data, error } = await Promise.race([profilePromise, timeoutPromise]);

      if (error) {
        console.error('[useAuth] Profile fetch error:', error.message, error.code);
      }

      if (!error && data) {
        console.log('[useAuth] Profile found:', data);
        setProfile(data as Profile);
        return true;
      } else if (retries < 5) {
        // Profile might not exist yet (trigger hasn't run)
        // Wait and retry up to 5 times
        return new Promise((resolve) => {
          setTimeout(() => fetchProfile(userId, retries + 1).then(resolve), 500);
        });
      } else {
        // Give up - profile doesn't exist, user needs to be created properly
        console.error('[useAuth] Profile not found for user after 5 retries:', userId);
        return false;
      }
    } catch (err) {
      console.error('[useAuth] Profile fetch exception:', err);
      // If timed out or other error, retry if under limit
      if (retries < 5) {
        console.log('[useAuth] Retrying after error...');
        return new Promise((resolve) => {
          setTimeout(() => fetchProfile(userId, retries + 1).then(resolve), 500);
        });
      }
      return false;
    }
  };

  useEffect(() => {
    // Global timeout failsafe - ensure loading always completes within 3 seconds max
    const globalTimeout = setTimeout(() => {
      console.warn('[useAuth] Global timeout reached, forcing loading to false');
      setLoading(false);
    }, 3000);

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[useAuth] Initial session:', session?.user?.id);
      setUser(session?.user ?? null);
      setAuthToken(session?.access_token || null);
      
      // Don't block on profile fetch - do it in background
      if (session?.user) {
        fetchProfile(session.user.id).then((success) => {
          console.log('[useAuth] Profile fetch completed:', success);
        }).catch((err) => {
          console.error('[useAuth] Profile fetch failed:', err);
        });
      }
      
      clearTimeout(globalTimeout);
      setLoading(false);
    }).catch((err) => {
      console.error('[useAuth] Session error:', err);
      clearTimeout(globalTimeout);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[useAuth] Auth state change:', event, session?.user?.id);
        setUser(session?.user ?? null);
        setAuthToken(session?.access_token || null);
        
        // Don't block on profile fetch
        if (session?.user) {
          fetchProfile(session.user.id).catch(() => {});
        } else {
          setProfile(null);
        }
        
        clearTimeout(globalTimeout);
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(globalTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  };

  const signOut = async () => {
    console.log('[useAuth] Signing out...');
    // Clear custom token first
    setAuthToken(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[useAuth] Sign out error:', error.message);
    }
    setUser(null);
    setProfile(null);
    // Force a full page refresh to clear all client state
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
