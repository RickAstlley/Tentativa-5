'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Footer from '@/components/Footer';
import AdminSidebar from '@/components/admin/layout/AdminSidebar';
import AdminFooter from '@/components/admin/layout/AdminFooter';
import PWAInstallPrompt from '@/components/admin/PWAInstallPrompt';
import SWRegistration from '@/components/admin/SWRegistration';
import { AdminSidebarProvider, useAdminSidebar } from '@/context/AdminSidebarContext';
import { useSwipeGestures, usePullToRefresh, useHapticFeedback } from '@/hooks/useMobileGestures';
import { Menu, Bike, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { KeyboardShortcutsHelp, useKeyboardShortcuts } from '@/components/admin/debug/KeyboardShortcuts';
import CommandPalette from '@/components/admin/CommandPalette';
import { getStoredAdminSession } from '@/lib/adminAuth';

const KEYBOARD_SHORTCUTS: Record<string, string> = {
  '/': '/admin/ia?mode=chat',
  'gn': '/admin/artigos/novo',
  'gr': '/admin/rankings/novo',
  'gb': '/admin/bikes/novo',
  'ga': '/admin/ia',
  'gd': '/admin',
  'gc': '/admin/configuracoes',
  'gt': '/admin/telemetry',
};

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const rawPathname = usePathname();
  const pathname = rawPathname || '';
  const router = useRouter();
  const mainRef = useRef<HTMLElement>(null);
  const { collapsed, toggleCollapsed, toggleMobileOpen } = useAdminSidebar();

  const isLoginPage = pathname === '/admin/login';
  const isCopilotPage = pathname.startsWith('/admin/ia');
  const isCreatePage = pathname.startsWith('/admin/criar');
  const [authChecked, setAuthChecked] = useState(false);

  // Verificação de autenticação obrigatória via variáveis de ambiente
  // Roda apenas uma vez no mount (sem dependência de pathname) para evitar flicker
  // A sessão é validada via token no localStorage/sessionStorage
  useEffect(() => {
    if (isLoginPage) {
      setAuthChecked(true);
      return;
    }
    const session = getStoredAdminSession();
    if (!session || !session.token) {
      router.replace('/admin/login');
    } else {
      setAuthChecked(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoginPage, router]); // pathName removido intencionalmente - sessão não muda durante navegação admin

  // Keyboard shortcuts
  useEffect(() => {
    if (isLoginPage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        const key = e.key.toLowerCase();
        if (key === 'k' || key === '/') {
          e.preventDefault();
          const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
          } else {
            router.push('/admin/ia?mode=chat');
          }
        }
      }

      // G + letter shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault();
        const handler = (e2: KeyboardEvent) => {
          if (
            e2.target instanceof HTMLInputElement ||
            e2.target instanceof HTMLTextAreaElement ||
            e2.target instanceof HTMLSelectElement
          ) {
            return;
          }
          const shortcut = `g${e2.key.toLowerCase()}`;
          const href = KEYBOARD_SHORTCUTS[shortcut];
          if (href) {
            e2.preventDefault();
            router.push(href);
          }
          document.removeEventListener('keydown', handler);
        };
        document.addEventListener('keydown', handler, { once: true });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  // Mobile gestures
  const adminTabs = [
    '/admin',
    '/admin/bikes',
    '/admin/artigos',
    '/admin/rankings',
    '/admin/ia',
    '/admin/radar-global',
    '/admin/configuracoes',
  ];
  const currentTabIndex = adminTabs.indexOf(pathname);

  const handleSwipeLeft = useCallback(() => {
    if (currentTabIndex >= 0 && currentTabIndex < adminTabs.length - 1) {
      router.push(adminTabs[currentTabIndex + 1]);
    }
  }, [currentTabIndex, router]);

  const handleSwipeRight = useCallback(() => {
    if (currentTabIndex > 0) {
      router.push(adminTabs[currentTabIndex - 1]);
    }
  }, [currentTabIndex, router]);

  const handlePullRefresh = useCallback(async () => {
    window.dispatchEvent(new CustomEvent('admin-pull-refresh', { detail: { pathname } }));
    await new Promise((resolve) => setTimeout(resolve, 500));
  }, [pathname]);

  const { light: hapticLight } = useHapticFeedback();

  useSwipeGestures(mainRef, {
    onSwipeLeft: () => {
      handleSwipeLeft();
      hapticLight();
    },
    onSwipeRight: () => {
      handleSwipeRight();
      hapticLight();
    },
    threshold: 60,
  });

  usePullToRefresh(mainRef, {
    onRefresh: handlePullRefresh,
    threshold: 80,
  });

  if (isLoginPage) {
    return (
      <div className="w-full min-h-screen bg-[#FDFBF7]">
        {children}
      </div>
    );
  }

  if (!authChecked) {
    return (
      <div className="w-full min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-stone-900" />
          <span className="text-xs font-mono font-bold text-stone-600">Verificando credenciais...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden min-h-screen bg-[#FDFBF7] dark:bg-stone-950 flex flex-col">
      {/* Mobile Top Navigation Bar with Toggle Sidebar Button */}
      {!isCopilotPage && !isCreatePage && (
        <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-stone-900 text-white border-b-2 border-stone-800 shadow-md">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleMobileOpen}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-400 hover:text-white border border-stone-700 transition-colors"
              aria-label="Abrir menu lateral"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link href="/admin" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-amber-500 text-stone-950 rounded-lg flex items-center justify-center font-black">
                <Bike className="w-4 h-4" />
              </div>
              <span className="font-black text-base text-white tracking-tight">TuaVia</span>
              <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">Admin</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/criar"
              className="px-2.5 py-1 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-lg transition-colors shadow-xs"
            >
              + Criar
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-1 relative min-h-0">
        {/* Navigation Sidebar */}
        {!isCopilotPage && !isCreatePage && <AdminSidebar />}

        {/* Main Content Area */}
        <main
          ref={mainRef}
          className={cn(
            'w-full min-w-0 flex-1 transition-all duration-300',
            // O `pb-12` existe para o rodapé não cobrir o conteúdo nas páginas
            // com scroll normal. O copiloto e a tela de criação são full-height
            // (`h-dvh`, com scroll interno): manter o padding lá somava 48px de
            // altura ao `100dvh` e produzia uma barra de rolagem fantasma na
            // página inteira, sem nada para rolar.
            !isCopilotPage && !isCreatePage
              ? cn('pb-12', collapsed ? 'lg:ml-20' : 'lg:ml-64')
              : 'ml-0'
          )}
        >
          {children}
        </main>
      </div>

      {/* Admin Footer */}
      {!isCopilotPage && <AdminFooter />}

      {/* PWA Components */}
      <SWRegistration />
      <PWAInstallPrompt />

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp />
      <CommandPalette />
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Inject manifest link
  useEffect(() => {
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/manifest.json';
      document.head.appendChild(link);
    }

    if (!document.querySelector('meta[name="theme-color"]')) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = '#78350F';
      document.head.appendChild(meta);
    }

    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const link = document.createElement('link');
      link.rel = 'apple-touch-icon';
      link.href = '/icons/icon-192x192.png';
      document.head.appendChild(link);
    }
  }, []);

  return (
    <AdminSidebarProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AdminSidebarProvider>
  );
}
