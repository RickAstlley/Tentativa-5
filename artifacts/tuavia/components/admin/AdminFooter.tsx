'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Bike,
  FileText,
  Trophy,
  Sparkles,
  Globe2,
  Settings,
  Layers,
  Activity,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface FooterNavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: string | number;
  shortcut?: string;
  badgeColor?: 'emerald' | 'amber' | 'rose' | 'indigo' | 'stone';
}

const NAV_ITEMS: FooterNavItem[] = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard', shortcut: '⌘1' },
  { href: '/admin/bikes', icon: Bike, label: 'E-Bikes', shortcut: '⌘2', badgeColor: 'emerald' },
  { href: '/admin/artigos', icon: FileText, label: 'Artigos', shortcut: '⌘3', badgeColor: 'indigo' },
  { href: '/admin/rankings', icon: Trophy, label: 'Rankings', shortcut: '⌘4', badgeColor: 'amber' },
  { href: '/admin/configuracoes', icon: Settings, label: 'Config', shortcut: '⌘5' },
];

const MORE_ITEMS: FooterNavItem[] = [
  { href: '/admin/criar', icon: Layers, label: 'Wizard Criação' },
];

export default function AdminFooter() {
  const pathname = usePathname() || '';
  const [isExpanded, setIsExpanded] = useState(false);
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [bikes, articles, rankings] = await Promise.all([
          fetch('/api/bikes?count=1').then(r => r.json()).catch(() => ({ count: 0 })),
          fetch('/api/articles?count=1').then(r => r.json()).catch(() => ({ count: 0 })),
          fetch('/api/rankings?count=1').then(r => r.json()).catch(() => ({ count: 0 })),
        ]);
        setBadgeCounts({
          'E-Bikes': bikes.count || 0,
          'Artigos': articles.count || 0,
          'Rankings': rankings.count || 0,
        });
      } catch {}
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 30_000);
    return () => clearInterval(interval);
  }, []);

  const getBadgeColor = (color: FooterNavItem['badgeColor']) => ({
    emerald: 'bg-emerald-500 text-white',
    amber: 'bg-amber-500 text-stone-950',
    rose: 'bg-rose-500 text-white',
    indigo: 'bg-indigo-500 text-white',
    stone: 'bg-stone-500 text-white',
  }[color || 'stone']);

  // MOBILE: Bottom Navigation Bar
  const mobileNav = (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-stone-900 safe-area-pb" role="navigation" aria-label="Navegação principal mobile">
      <div className="grid grid-cols-5">
        {NAV_ITEMS.slice(0, 4).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            className={cn(
              'flex flex-col items-center justify-center gap-1 px-2 py-2.5',
              'transition-colors',
              'touch-manipulation',
              pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
                ? 'text-emerald-600 bg-emerald-50'
                : 'text-stone-500 active:text-stone-900'
            )}
            aria-current={pathname === item.href ? 'page' : undefined}
          >
            <item.icon className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] font-bold truncate w-16 text-center">{item.label}</span>
            {badgeCounts[item.label] && (
              <span className={cn('absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-mono font-bold flex items-center justify-center', getBadgeColor(item.badgeColor))}>
                {badgeCounts[item.label] > 9 ? '9+' : badgeCounts[item.label]}
              </span>
            )}
          </Link>
        ))}
        {/* Menu "Mais" */}
        <div className="relative">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 px-2 py-2.5 w-full',
              'transition-colors touch-manipulation',
              isExpanded ? 'text-emerald-600 bg-emerald-50' : 'text-stone-500 active:text-stone-900'
            )}
            aria-expanded={isExpanded}
            aria-haspopup="true"
            aria-label="Mais opções"
          >
            <Layers className="w-5 h-5" />
            <span className="text-[10px] font-bold">Mais</span>
          </button>
          {isExpanded && (
            <div className="absolute bottom-full right-0 mb-2 w-48 bg-white border-2 border-stone-900 rounded-xl shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-150">
              {MORE_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  onClick={() => setIsExpanded(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5',
                    'hover:bg-stone-50 transition-colors',
                    pathname === item.href ? 'bg-emerald-50 text-emerald-600' : 'text-stone-700'
                  )}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span className="font-bold text-xs">{item.label}</span>
                  {item.shortcut && <kbd className="text-[9px] font-mono text-stone-400 ml-auto px-1.5 py-0.5 bg-stone-100 rounded">{item.shortcut}</kbd>}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );

  // DESKTOP: Footer fino com atalhos
  const desktopFooter = (
    <footer className="hidden lg:flex items-center justify-between px-6 py-2 bg-stone-900 text-stone-300 border-t-2 border-amber-500" role="contentinfo">
      <div className="flex items-center gap-6 text-xs font-mono">
        <span className="text-amber-400 font-bold">Atalhos:</span>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all',
              pathname === item.href
                ? 'bg-amber-500 text-stone-950 font-black'
                : 'hover:bg-stone-800 hover:text-white'
            )}
            title={`${item.label} (${item.shortcut})`}
          >
            <item.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{item.label}</span>
            <kbd className="text-[9px] px-1 py-0.5 bg-stone-800 rounded border border-stone-700">{item.shortcut}</kbd>
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-4 text-[10px]">
        <span className="text-stone-500">v2.1.0</span>
      </div>
    </footer>
  );

  return (
    <>
      {mobileNav}
      {desktopFooter}
      {isExpanded && (
        <div
          className="fixed inset-0 z-40 lg:hidden bg-black/10"
          onClick={() => setIsExpanded(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}