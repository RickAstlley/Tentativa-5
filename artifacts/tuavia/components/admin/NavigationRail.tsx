'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAdminSidebar } from '@/context/AdminSidebarContext';
import {
  LayoutDashboard,
  Bike,
  FileText,
  Trophy,
  Sparkles,
  Globe2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Activity,
  Zap,
  X,
} from 'lucide-react';

interface RailItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badgeColor?: string;
}

const RAIL_GROUPS: { label: string; items: RailItem[] }[] = [
  {
    label: 'Conteúdo',
    items: [
      { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/admin/bikes', icon: Bike, label: 'E-Bikes', badgeColor: 'emerald' },
      { href: '/admin/artigos', icon: FileText, label: 'Artigos', badgeColor: 'indigo' },
      { href: '/admin/rankings', icon: Trophy, label: 'Rankings', badgeColor: 'amber' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/admin/configuracoes', icon: Settings, label: 'Configurações' },
    ],
  },
];

export default function NavigationRail() {
  const pathname = usePathname() || '';
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useAdminSidebar();
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const fetchCount = async (url: string): Promise<number> => {
          try {
            const res = await fetch(url);
            if (!res.ok) return 0;
            const data = await res.json();
            return data.count || 0;
          } catch {
            return 0;
          }
        };

        const [bikes, articles, rankings] = await Promise.all([
          fetchCount('/api/bikes?count=1'),
          fetchCount('/api/articles?count=1'),
          fetchCount('/api/rankings?count=1'),
        ]);
        setBadgeCounts({
          'E-Bikes': bikes,
          'Artigos': articles,
          'Rankings': rankings,
        });
      } catch {}
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 30_000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (href: string) => pathname === href || (href !== '/admin' && pathname.startsWith(href));
  const groupHasActive = (items: RailItem[]) => items.some((i) => isActive(i.href));

  const handleLinkClick = () => {
    if (mobileOpen) {
      setMobileOpen(false);
    }
  };

  return (
    <>
      {/* Backdrop para mobile */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed top-0 bottom-0 z-50 bg-white dark:bg-stone-900 border-r-2 border-stone-900 dark:border-stone-800 transition-all duration-300 flex flex-col shadow-2xl lg:shadow-none',
          // Mobile: Drawer deslizante
          mobileOpen ? 'left-0 w-72 flex' : '-left-full lg:left-0 hidden lg:flex',
          // Desktop: Largura colapsável
          collapsed ? 'lg:w-20' : 'lg:w-64'
        )}
        role="navigation"
        aria-label="Navegação principal"
      >
        {/* Header da Barra Lateral */}
        <div
          className={cn(
            'flex items-center justify-between p-4 border-b-2 border-stone-900 dark:border-stone-800 shrink-0 bg-stone-50 dark:bg-stone-950',
            collapsed && 'lg:justify-center'
          )}
        >
          {(!collapsed || mobileOpen) && (
            <Link
              href="/admin"
              onClick={handleLinkClick}
              className="flex items-center gap-2.5 group"
              aria-label="TuaVia Admin"
            >
              <div className="w-9 h-9 bg-amber-500 text-stone-900 rounded-lg flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:scale-105 transition-transform shrink-0">
                <Bike className="w-5 h-5" />
              </div>
              <div>
                <span className="font-black text-lg tracking-tight text-stone-900 dark:text-white block leading-tight">
                  TuaVia
                </span>
                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 uppercase tracking-widest block font-bold">
                  Admin
                </span>
              </div>
            </Link>
          )}

          {/* Botão fechar no mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-200 transition-colors"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Botão recolher no desktop */}
          <button
            onClick={toggleCollapsed}
            className={cn(
              'hidden lg:flex p-1.5 rounded-lg transition-colors text-stone-400 hover:text-stone-900 hover:bg-stone-200 dark:hover:bg-stone-800',
              collapsed && 'mx-auto'
            )}
            aria-label={collapsed ? 'Expandir menu' : 'Colapsar menu'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        {/* Lista de Navegação */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4" aria-label="Grupos de navegação">
          {RAIL_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              {(!collapsed || mobileOpen) && (
                <div className="px-3 py-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                    {group.label}
                    {groupHasActive(group.items) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    )}
                  </span>
                </div>
              )}
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleLinkClick}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-bold text-sm touch-manipulation',
                      active
                        ? 'bg-amber-500 text-stone-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border border-stone-900'
                        : 'text-stone-600 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800',
                      collapsed && !mobileOpen && 'lg:justify-center lg:px-0'
                    )}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed && !mobileOpen ? item.label : undefined}
                  >
                    <div className="relative shrink-0 flex items-center justify-center">
                      <item.icon className={cn('w-5 h-5', active ? 'text-stone-950' : 'text-stone-500')} />
                      {badgeCounts[item.label] !== undefined && badgeCounts[item.label] > 0 && (
                        <span
                          className={cn(
                            'absolute -top-1.5 -right-2 px-1 min-w-4 h-4 rounded-full text-[9px] font-mono font-bold flex items-center justify-center border border-stone-900',
                            active
                              ? 'bg-stone-950 text-amber-400'
                              : 'bg-amber-500 text-stone-950'
                          )}
                        >
                          {badgeCounts[item.label] > 99 ? '99+' : badgeCounts[item.label]}
                        </span>
                      )}
                    </div>
                    {(!collapsed || mobileOpen) && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Rodapé da Barra Lateral */}
        <div
          className={cn(
            'p-3 border-t-2 border-stone-900 dark:border-stone-800 shrink-0 space-y-2 bg-stone-50 dark:bg-stone-950',
            collapsed && !mobileOpen && 'lg:items-center'
          )}
        >
          <div className={cn('flex items-center gap-2.5 px-2 py-1', collapsed && !mobileOpen && 'lg:justify-center')}>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Online" />
            {(!collapsed || mobileOpen) && (
              <span className="text-xs font-mono font-bold text-stone-700 dark:text-stone-300 truncate">
                Admin Online
              </span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
