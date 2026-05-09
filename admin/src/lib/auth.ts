import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
}

/**
 * Subscribes to Supabase auth state and confirms whether the signed-in
 * user is in public.admins. The dashboard refuses to render the
 * editors unless isAdmin is true.
 */
export function useAuth(): AuthState & { signOut: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    loading: true,
    session: null,
    user: null,
    isAdmin: false,
  });

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const user = session?.user ?? null;
      let isAdmin = false;
      if (user) {
        const { data: row } = await supabase
          .from('admins')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();
        isAdmin = !!row;
      }
      if (!mounted) return;
      setState({ loading: false, session, user, isAdmin });
    };

    void init();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      if (!mounted) return;
      const user = session?.user ?? null;
      let isAdmin = false;
      if (user) {
        const { data: row } = await supabase
          .from('admins')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();
        isAdmin = !!row;
      }
      setState({ loading: false, session, user, isAdmin });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { ...state, signOut };
}
