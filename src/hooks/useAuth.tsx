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
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

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
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[useAuth] Initial session:', session?.user?.id);
      setUser(session?.user ?? null);
      // Store token for custom API client
      setAuthToken(session?.access_token || null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[useAuth] Auth state change:', event, session?.user?.id);
        setUser(session?.user ?? null);
        // Store/update token for custom API client
        setAuthToken(session?.access_token || null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
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
