'use client';

/**
 * components/admin/layout/AdminHeader.tsx
 *
 * Cabeçalho do painel: identidade, link de volta ao site, sessão e saída.
 * Substitui o stub que reexportava `./layout/AdminHeaderReal`, módulo que nunca
 * existiu.
 */

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, LogOut, ShieldCheck, Menu } from 'lucide-react';
import { getStoredAdminEmail, clearAdminSession } from '@/lib/adminAuth';
import { cn } from '@/lib/utils';

export interface AdminHeaderProps {
  title?: string;
  subtitle?: string;
  onToggleMobileNav?: () => void;
  className?: string;
}

export default function AdminHeader({
  title = 'TuaVia Admin',
  subtitle,
  onToggleMobileNav,
  className,
}: AdminHeaderProps) {
  const router = useRouter();
  const [email, setEmail] = React.useState<string | null>(null);

  React.useEffect(() => {
    setEmail(getStoredAdminEmail());
  }, []);

  async function handleSignOut() {
    await clearAdminSession();
    router.replace('/admin/login');
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex items-center gap-3 border-b-2 border-stone-900 bg-[#FAFAF7] px-4 py-3 dark:border-stone-700 dark:bg-stone-950',
        className
      )}
    >
      {onToggleMobileNav ? (
        <button
          type="button"
          onClick={onToggleMobileNav}
          aria-label="Abrir navegação"
          className="rounded-md border-2 border-stone-900 p-1.5 dark:border-stone-700 md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
      ) : null}

      <Link href="/admin" className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
        <span className="font-display text-sm font-extrabold tracking-tight text-stone-900 dark:text-stone-100">
          {title}
        </span>
      </Link>

      {subtitle ? (
        <span className="hidden text-xs text-stone-500 sm:inline">{subtitle}</span>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        {email ? (
          <span
            className="hidden max-w-[180px] truncate rounded-full border border-stone-300 bg-white px-3 py-1 font-mono text-[10px] text-stone-600 sm:inline dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400"
            title={email}
          >
            {email}
          </span>
        ) : null}

        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border-2 border-stone-900 px-2.5 py-1.5 text-xs font-semibold text-stone-800 transition-colors hover:bg-stone-900 hover:text-white dark:border-stone-700 dark:text-stone-200"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Ver site
        </Link>

        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex items-center gap-1.5 rounded-md border-2 border-stone-900 px-2.5 py-1.5 text-xs font-semibold text-stone-800 transition-colors hover:border-red-600 hover:text-red-700 dark:border-stone-700 dark:text-stone-200"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>
    </header>
  );
}
