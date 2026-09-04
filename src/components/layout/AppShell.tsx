'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useUi } from '@/store/ui';
import { useChatStore } from '@/store/chat';
import { cn } from '@/lib/utils';
import { NavRail } from '@/components/layout/NavRail';
import { Sidebar } from '@/components/layout/Sidebar';
import { RightPanel } from '@/components/layout/RightPanel';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { CallOverlay } from '@/components/calls/CallOverlay';
import { MeProvider } from '@/components/providers/MeProvider';
import type { PublicUser } from '@/types';

/**
 * Three columns on desktop (rail + list + conversation, plus an optional info
 * panel), two on tablets, one on phones where the list and the conversation are
 * separate routes.
 */
export function AppShell({
  me,
  isAdmin,
  children,
}: {
  me: PublicUser;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { focusMode, rightPanel, set } = useUi();
  const setActive = useChatStore((s) => s.setActive);

  const inConversation = pathname.startsWith('/app/chat/');
  // On phones the chat list owns `/app`; every other route is a full-screen page.
  const isListRoute = pathname === '/app';
  const chatId = inConversation ? pathname.split('/')[3] ?? null : null;

  useEffect(() => {
    setActive(chatId);
  }, [chatId, setActive]);

  // Focus mode hides everything but the open conversation.
  useEffect(() => {
    if (focusMode) set('rightPanel', 'none');
  }, [focusMode, set]);

  return (
    <MeProvider me={me} isAdmin={isAdmin}>
      <div className="flex h-[100dvh] w-full overflow-hidden">
        <AnimatePresence initial={false}>
          {!focusMode ? (
            <motion.div
              key="rail"
              initial={{ x: -80, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -80, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="hidden md:block"
            >
              <NavRail isAdmin={isAdmin} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <aside
          className={cn(
            'w-full shrink-0 border-e border-hairline md:w-[19rem] lg:w-[21rem]',
            focusMode && 'hidden',
            isListRoute ? 'block' : 'hidden md:block',
          )}
        >
          <Sidebar />
        </aside>

        <main className={cn('relative min-w-0 flex-1', isListRoute && 'hidden md:block')}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <AnimatePresence initial={false}>
          {rightPanel !== 'none' && chatId && !focusMode ? (
            <motion.aside
              key="right"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="hidden shrink-0 overflow-hidden border-s border-hairline xl:block"
            >
              <RightPanel chatId={chatId} />
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </div>

      <MobileTabs hidden={inConversation || focusMode} isAdmin={isAdmin} />
      <CommandPalette />
      {/* CallOverlay owns the single useWebRTC instance and renders the ringing card itself. */}
      <CallOverlay />
    </MeProvider>
  );
}

function MobileTabs({ hidden, isAdmin }: { hidden: boolean; isAdmin: boolean }) {
  if (hidden) return null;
  return (
    <div className="fixed bottom-0 start-0 end-0 z-30 md:hidden">
      <NavRail isAdmin={isAdmin} horizontal />
    </div>
  );
}
