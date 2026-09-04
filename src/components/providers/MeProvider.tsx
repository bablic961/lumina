'use client';

import { createContext, useContext } from 'react';
import type { PublicUser } from '@/types';

interface MeValue {
  me: PublicUser;
  isAdmin: boolean;
}

const MeContext = createContext<MeValue | null>(null);

export function MeProvider({
  me,
  isAdmin,
  children,
}: MeValue & { children: React.ReactNode }) {
  return <MeContext.Provider value={{ me, isAdmin }}>{children}</MeContext.Provider>;
}

/** Current user, resolved on the server and handed down once. */
export function useMe() {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error('useMe must be used inside the app shell');
  return ctx;
}
