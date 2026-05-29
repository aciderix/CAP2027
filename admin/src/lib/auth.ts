import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
}

const ADMIN_QUERY_TIMEOUT_MS = 5_000;
const BOOTSTRAP_TIMEOUT_MS = 10_000;
const SIGNOUT_TIMEOUT_MS = 3_000;

const EMPTY: AuthState = { loading: false, session: null, user: null, isAdmin: false };

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      () => { clearTimeout(timer); resolve(fallback); },
    );
  });
}

/**
 * Subscribes to Supabase auth state and confirms whether the signed-in
 * user is in public.admins.
 *
 * Defensive design: every async step is timeboxed so the spinner can
 * never get stuck on a hung network call. The loading flag falls back
 * to false within BOOTSTRAP_TIMEOUT_MS regardless of what happens.
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

    // Hard floor: if anything below hangs, force loading off so the
    // user gets the Login screen instead of an infinite spinner.
    const safetyTimer = setTimeout(() => {
      if (!mounted) return;
      setState((s) => (s.loading ? { ...EMPTY, loading: false } : s));
    }, BOOTSTRAP_TIMEOUT_MS);

    const checkAdmin = async (userId: string): Promise<boolean> => {
      // Coerce the PostgREST thenable to a real Promise<T>; supabase-js
      // returns PromiseLike, which TS doesn't accept where Promise is
      // expected.
      const query = Promise.resolve(
        supabase.from('admins').select('user_id').eq('user_id', userId).maybeSingle(),
      ).then<{ data: { user_id: string } | null }>((r) => ({ data: r.data ?? null }));
      const result = await withTimeout(query, ADMIN_QUERY_TIMEOUT_MS, { data: null });
      return !!result.data;
    };

    const apply = async (session: Session | null) => {
      if (!mounted) return;
      const user = session?.user ?? null;
      const isAdmin = user ? await checkAdmin(user.id) : false;
      if (!mounted) return;
      setState({ loading: false, session, user, isAdmin });
    };

    void (async () => {
      try {
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          ADMIN_QUERY_TIMEOUT_MS,
          { data: { session: null }, error: null } as any,
        );
        await apply(data?.session ?? null);
      } catch {
        if (mounted) setState({ ...EMPTY, loading: false });
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      void apply(session);
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    // Try global signOut (revokes server-side refresh token) with a tight
    // timeout, then fall back to local-only so the UI never hangs.
    try {
      await withTimeout(
        supabase.auth.signOut({ scope: 'global' }),
        SIGNOUT_TIMEOUT_MS,
        { error: null } as any,
      );
    } catch {
      try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
    }
    setState({ ...EMPTY, loading: false });
  }, []);

  return { ...state, signOut };
}
