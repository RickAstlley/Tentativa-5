'use client';

import { adminFetch } from '@/lib/ai/clientResponse';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { CommandItem } from '@/types/command';
import {
  LayoutDashboard,
  Bike,
  FileText,
  Trophy,
  Sparkles,
  Globe2,
  Settings,
  Plus,
  Zap,
  Database,
  ExternalLink,
  Download,
  MessageSquare,
  ShieldCheck,
  Search,
  Key,
  Layers,
  Activity,
  Play,
  Wrench,
} from 'lucide-react';

const COMMANDS: CommandItem[] = [
  { id: 'nav-dashboard', label: 'Dashboard', description: 'Visão geral do painel', icon: LayoutDashboard, category: 'navigation', href: '/admin', shortcut: '⌘1', keywords: ['home', 'inicio', 'painel'] },
  { id: 'nav-bikes', label: 'E-Bikes', description: 'Gerenciar catálogo de bicicletas', icon: Bike, category: 'navigation', href: '/admin/bikes', shortcut: '⌘2', keywords: ['bike', 'bicicleta', 'catalogo', 'ebike'] },
  { id: 'nav-bikes-new', label: 'Nova E-Bike', description: 'Cadastrar nova bicicleta', icon: Plus, category: 'navigation', href: '/admin/bikes/novo', keywords: ['criar', 'nova', 'bike'] },
  { id: 'nav-artigos', label: 'Artigos', description: 'Gerenciar blog e artigos', icon: FileText, category: 'navigation', href: '/admin/artigos', shortcut: '⌘3', keywords: ['post', 'blog', 'noticia', 'guia'] },
  { id: 'nav-artigos-new', label: 'Novo Artigo', description: 'Criar novo artigo', icon: Plus, category: 'navigation', href: '/admin/artigos/novo', keywords: ['criar', 'novo', 'artigo'] },
  { id: 'nav-artigos-audit', label: 'Auditoria IA', description: 'Auditoria de artigos com IA', icon: Sparkles, category: 'navigation', href: '/admin/artigos/auditoria', keywords: ['auditoria', 'ia', 'artigos'] },
  { id: 'nav-rankings', label: 'Rankings', description: 'Top rankings e comparativos', icon: Trophy, category: 'navigation', href: '/admin/rankings', shortcut: '⌘4', keywords: ['top', 'comparativo', 'ranking'] },
  { id: 'nav-rankings-new', label: 'Novo Ranking', description: 'Criar novo ranking', icon: Plus, category: 'navigation', href: '/admin/rankings/novo', keywords: ['criar', 'novo', 'ranking'] },
  { id: 'nav-ia', label: 'Copiloto IA', description: 'Assistentes de IA especializados', icon: Sparkles, category: 'navigation', href: '/admin/ia', shortcut: '⌘5', keywords: ['chat', 'gerar', 'ia', 'kimi'] },
  { id: 'nav-radar-global', label: 'Radar Global', description: 'Varredura internacional 7 polos', icon: Globe2, category: 'navigation', href: '/admin/radar-global', shortcut: '⌘6', keywords: ['global', 'china', 'japao', 'busca'] },
  { id: 'nav-radar', label: 'Radar', description: 'Radar de mercado', icon: Zap, category: 'navigation', href: '/admin/radar', shortcut: '⌘7', keywords: ['radar', 'mercado'] },
  { id: 'nav-config', label: 'Configurações', description: 'Textos, hero, footer, confiança', icon: Settings, category: 'navigation', href: '/admin/configuracoes', shortcut: '⌘,', keywords: ['settings', 'texto', 'hero', 'footer'] },
  { id: 'nav-telemetry', label: 'Telemetria', description: 'Monitoramento de execuções IA', icon: Activity, category: 'navigation', href: '/admin/telemetry', shortcut: '⌘T', keywords: ['telemetria', 'monitoramento', 'metricas'] },
  { id: 'act-new-bike', label: 'Nova E-Bike', description: 'Cadastrar nova bicicleta no catálogo', icon: Plus, category: 'action', shortcut: '⌘N', keywords: ['criar', 'adicionar', 'cadastro', 'bike'] },
  { id: 'act-new-article', label: 'Novo Artigo', description: 'Escrever novo artigo para o blog', icon: FileText, category: 'action', keywords: ['escrever', 'publicar', 'post'] },
  { id: 'act-new-ranking', label: 'Novo Ranking', description: 'Criar top ranking comparativo', icon: Trophy, category: 'action', keywords: ['top', 'comparar', 'ranking'] },
  { id: 'act-scan-radar', label: 'Escanear Radar Agora', description: 'Disparar varredura internacional imediata', icon: Zap, category: 'action', shortcut: '⌘R', keywords: ['scan', 'buscar', 'varredura', 'atualizar'] },
  { id: 'act-sync-firestore', label: 'Sincronizar Firestore', description: 'Backup local → Firestore', icon: Database, category: 'action', keywords: ['sync', 'backup', 'salvar', 'firebase'] },
  { id: 'act-ai-create', label: 'Criar com IA (Wizard)', description: 'Assistente unificado: Artigo, Bike ou Ranking', icon: Sparkles, category: 'action', shortcut: '⌘K', keywords: ['wizard', 'assistente', 'gerar', 'ia'] },
  { id: 'ai-chat', label: 'Chat Inteligente', description: 'Conversa livre com Kimi K3 + Nemotron', icon: MessageSquare, category: 'ai', href: '/admin/ia?mode=chat', keywords: ['conversar', 'perguntar', 'duvida'] },
  { id: 'ai-article', label: 'Redator Editorial', description: 'Artigo SEO completo 2-pings', icon: FileText, category: 'ai', href: '/admin/ia?mode=article_writer', keywords: ['artigo', 'seo', 'blog', 'escrever'] },
  { id: 'ai-ebike', label: 'Ficha E-Bike', description: 'Análise técnica + CONTRAN + specs', icon: Bike, category: 'ai', href: '/admin/ia?mode=ebike_analysis', keywords: ['ficha', 'tecnica', 'especs', 'contran'] },
  { id: 'ai-ranking', label: 'Top Ranking', description: 'Ranking Top 3-10 com lojas', icon: Trophy, category: 'ai', href: '/admin/ia?mode=top_ranking', keywords: ['ranking', 'top', 'comparativo'] },
  { id: 'ai-audit', label: 'Auditor Anti-Alucinação', description: 'Validação jurídica CONTRAN 996', icon: ShieldCheck, category: 'ai', href: '/admin/ia?mode=audit_anti_hallucination', keywords: ['auditoria', 'validar', 'juridico', 'conformidade'] },
  { id: 'ai-playground', label: 'Playground', description: 'Teste modelos e prompts', icon: Play, category: 'ai', href: '/admin/ia/playground', keywords: ['playground', 'teste', 'modelos'] },
  { id: 'ai-pipelines', label: 'Pipelines', description: 'Gerenciar pipelines de IA', icon: Layers, category: 'ai', href: '/admin/ia/pipelines', keywords: ['pipelines', 'workflows'] },
  { id: 'ai-vector-store', label: 'Vector Store', description: 'Busca semântica e RAG', icon: Database, category: 'ai', href: '/admin/ia/vector-store', keywords: ['vector', 'store', 'rag', 'busca'] },
  { id: 'ai-setup', label: 'Setup IA', description: 'Configurar modelos e chaves', icon: Wrench, category: 'ai', href: '/admin/ia/setup', keywords: ['setup', 'config', 'modelos'] },
  { id: 'util-export', label: 'Exportar Relatório Radar', description: 'Baixar pautas em Markdown', icon: Download, category: 'action', keywords: ['exportar', 'download', 'markdown', 'relatorio'] },
  { id: 'util-view-site', label: 'Ver Site Público', description: 'Abrir tuavia.com.br em nova aba', icon: ExternalLink, category: 'action', shortcut: '⌘E', keywords: ['site', 'publico', 'visualizar'] },
];

export default function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname() || '';
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commandsWithActions = useMemo(() => {
    return COMMANDS.map(cmd => {
      if (cmd.id === 'act-new-bike') {
        return { ...cmd, action: () => router.push('/admin/bikes/novo') };
      }
      if (cmd.id === 'act-new-article') {
        return { ...cmd, action: () => router.push('/admin/artigos/novo') };
      }
      if (cmd.id === 'act-new-ranking') {
        return { ...cmd, action: () => router.push('/admin/rankings/novo') };
      }
      if (cmd.id === 'act-scan-radar') {
        return { ...cmd, action: triggerRadarScan };
      }
      if (cmd.id === 'act-sync-firestore') {
        return { ...cmd, action: triggerSync };
      }
      if (cmd.id === 'act-ai-create') {
        return { ...cmd, action: () => router.push('/admin/criar') };
      }
      if (cmd.id === 'util-export') {
        return { ...cmd, action: exportRadarMarkdown };
      }
      if (cmd.id === 'util-view-site') {
        return { ...cmd, action: () => window.open('/', '_blank') };
      }
      return cmd;
    });
  }, [router]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commandsWithActions;
    const q = query.toLowerCase();
    return commandsWithActions
      // `description`, `keywords` e `category` são opcionais no contrato: um
      // comando sem eles estourava o `toLowerCase()` aqui e derrubava a paleta
      // inteira. Busca tolerante é o comportamento esperado de uma busca.
      .filter((cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        (cmd.description ?? '').toLowerCase().includes(q) ||
        (cmd.keywords ?? []).some((k) => k.toLowerCase().includes(q)) ||
        (cmd.category ?? '').toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const catOrder: Record<string, number> = { navigation: 0, action: 1, ai: 2, settings: 3 };
        return (catOrder[a.category ?? ''] ?? 99) - (catOrder[b.category ?? ''] ?? 99);
      });
  }, [query, commandsWithActions]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
        e.preventDefault();
        executeCommand(filteredCommands[selectedIndex]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, selectedIndex, filteredCommands]);

  useEffect(() => {
    if (!isOpen) return;
    const item = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const executeCommand = (cmd: CommandItem) => {
    if (cmd.href) router.push(cmd.href);
    if (cmd.action) cmd.action();
    setIsOpen(false);
    setQuery('');
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'command_palette', { command_id: cmd.id });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 lg:pt-24 px-4" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
      <div className="w-full max-w-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

        <div className="relative bg-white border-2 border-stone-900 rounded-2xl shadow-[8px_8px_0px_0px_rgba(28,25,23,1)] overflow-hidden">
          <div className="p-4 border-b-2 border-stone-900 bg-stone-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                placeholder="Digite um comando ou busque por página... (⌘K para fechar)"
                className="w-full pl-10 pr-12 py-3 bg-white border-2 border-stone-900 rounded-xl text-base font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-stone-400 px-2 py-0.5 bg-stone-100 rounded border border-stone-300">⌘K</kbd>
            </div>
          </div>

          <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
            {filteredCommands.length === 0 ? (
              <div className="p-8 text-center text-stone-500">
                <Search className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                <p className="font-medium">Nenhum comando encontrado</p>
                <p className="text-xs mt-1">Tente termos como &quot;bike&quot;, &quot;artigo&quot;, &quot;scan&quot;, &quot;ia&quot;</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {filteredCommands.map((cmd, index) => (
                  <button
                    key={cmd.id}
                    data-index={index}
                    onClick={() => executeCommand(cmd)}
                    className={cn(
                      'w-full px-4 py-3 text-left flex items-center gap-3 transition-colors',
                      index === selectedIndex
                        ? 'bg-emerald-50 border-l-4 border-emerald-500'
                        : 'hover:bg-stone-50'
                    )}
                  >
                    <div className={cn(
                      'p-2 rounded-lg shrink-0',
                      index === selectedIndex ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'
                    )}>
                      {/* `icon` é opcional no contrato: renderizar
                          `<cmd.icon />` sem guarda quebrava em comando sem ícone. */}
                      {cmd.icon ? (
                        <cmd.icon className="w-5 h-5" />
                      ) : (
                        <Search className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'font-bold text-sm truncate',
                          index === selectedIndex ? 'text-stone-900' : 'text-stone-700'
                        )}>
                          {cmd.label}
                        </span>
                        {cmd.badge && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 text-[9px] font-mono font-bold rounded border border-amber-300">
                            {cmd.badge}
                          </span>
                        )}
                        {cmd.category === 'ai' && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-900 text-[9px] font-mono font-bold rounded border border-purple-300">
                            IA
                          </span>
                        )}
                      </div>
                      <p className={cn(
                        'text-[11px] truncate mt-0.5',
                        index === selectedIndex ? 'text-stone-600' : 'text-stone-400'
                      )}>
                        {cmd.description}
                      </p>
                    </div>
                    {cmd.shortcut && (
                      <kbd className={cn(
                        'px-2 py-0.5 text-[10px] font-mono rounded border shrink-0 ml-2',
                        index === selectedIndex
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                          : 'bg-stone-100 text-stone-500 border-stone-200'
                      )}>
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-2 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-[10px] font-mono text-stone-400">
            <span>↑↓ Navegar • Enter Executar • ⌘K Fechar</span>
            <span>{filteredCommands.length} comando(s)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function triggerRadarScan() {
  adminFetch('/api/admin/llm/radar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'scan' }),
  }).then(() => {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('llm-job-start'));
  });
}

function triggerSync() {
  adminFetch('/api/admin/migrate', { method: 'POST' });
}

function exportRadarMarkdown() {
  adminFetch('/api/admin/llm/radar/global-search?export=markdown')
    .then(r => r.text())
    .then(text => {
      navigator.clipboard.writeText(text);
    });
}