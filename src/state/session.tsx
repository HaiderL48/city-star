import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getSettings, resolveShopUser, initDb, saveSettings } from '@/db';
import type { Settings, User } from '@/db/types';
import i18n from '@/i18n';

type SessionValue = {
  ready: boolean;
  settings: Settings | null;
  user: User | null;
  error: string | null;
  version: number;
  reload: () => Promise<void>;
  signIn: (user: User) => Promise<void>;
  signOut: () => Promise<void>;
  notify: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

async function openShopSession() {
  const next = await getSettings();
  if (next.language) await i18n.changeLanguage(next.language);
  if (!next.setupDone) {
    return { settings: next, user: null as User | null };
  }
  let user = await resolveShopUser(next.currentUserId);
  if (user && user.id !== next.currentUserId) {
    await saveSettings({ currentUserId: user.id });
    next.currentUserId = user.id;
  }
  return { settings: next, user };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const reload = useCallback(async () => {
    const opened = await openShopSession();
    setSettings(opened.settings);
    setUser(opened.user);
    setVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      await initDb();
      const opened = await openShopSession();
      if (!live) return;
      setSettings(opened.settings);
      setUser(opened.user);
      setReady(true);
    })().catch((caught) => {
      console.error(caught);
      if (!live) return;
      setError(caught instanceof Error ? caught.message : String(caught));
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const signIn = useCallback(async (next: User) => {
    await saveSettings({ currentUserId: next.id });
    setUser(next);
    setSettings((current) => (current ? { ...current, currentUserId: next.id } : current));
  }, []);

  const signOut = useCallback(async () => {
    // Private shop: stay signed in as the shop owner/admin.
    const opened = await openShopSession();
    setSettings(opened.settings);
    setUser(opened.user);
  }, []);

  const notify = useCallback(() => setVersion((value) => value + 1), []);

  const value = useMemo(
    () => ({ ready, settings, user, error, version, reload, signIn, signOut, notify }),
    [ready, settings, user, error, version, reload, signIn, signOut, notify],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('Session missing');
  return value;
}
