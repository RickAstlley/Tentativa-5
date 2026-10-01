'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Copy, Check, ExternalLink, HelpCircle, FileText, Trophy, Bike, Sparkles, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Snippet {
  id: string;
  label: string;
  snippet: string;
  description: string;
  category: 'bike' | 'ranking' | 'article' | 'formatting' | 'seo' | 'custom';
  insertMode: 'replace' | 'wrap' | 'append';
}

const DEFAULT_SNIPPETS: Snippet[] = [
  { id: 'bike-link', label: 'Link para E-Bike', snippet: '{{bike:slug-da-bike}}', description: 'Insere link para ficha de e-bike do catálogo', category: 'bike', insertMode: 'replace' },
  { id: 'bike-card', label: 'Card de E-Bike', snippet: '> **🚲 {{bike:slug}}** — {{resumo executivo da bike}}\n\n[Ver ficha completa](/bike/{{slug}})', description: 'Card formatado com resumo e link', category: 'bike', insertMode: 'replace' },
  { id: 'bike-specs', label: 'Tabela de Specs', snippet: '| Especificação | Valor |\n|---------------|-------|\n| Motor | {{motor}} |\n| Bateria | {{bateria}} |\n| Autonomia | {{autonomia}} km |\n| Peso | {{peso}} kg |\n| Preço | R$ {{preco}} |', description: 'Tabela padrão de especificações técnicas', category: 'bike', insertMode: 'replace' },
  { id: 'ranking-link', label: 'Link para Ranking', snippet: '{{ranking:slug-do-ranking}}', description: 'Insere link para ranking publicado', category: 'ranking', insertMode: 'replace' },
  { id: 'ranking-top3', label: 'Top 3 do Ranking', snippet: '## 🏆 Top 3 — {{nome do ranking}}\n\n1. **{{item 1}}** — {{destaque}}\n2. **{{item 2}}** — {{destaque}}\n3. **{{item 3}}** — {{destaque}}\n\n[Ver ranking completo](/ranking/{{slug}})', description: 'Resumo do top 3 com links', category: 'ranking', insertMode: 'replace' },
  { id: 'article-link', label: 'Link para Artigo', snippet: '{{article:slug-do-artigo}}', description: 'Insere link para artigo publicado', category: 'article', insertMode: 'replace' },
  { id: 'faq-block', label: 'Bloco FAQ', snippet: '### ❓ Perguntas Frequentes\n\n#### {{pergunta 1}}\n{{resposta 1}}\n\n#### {{pergunta 2}}\n{{resposta 2}}\n\n#### {{pergunta 3}}\n{{resposta 3}}', description: 'Estrutura de FAQ com schema.org', category: 'article', insertMode: 'replace' },
  { id: 'conclusion', label: 'Conclusão Padrão', snippet: '## Conclusão\n\n{{resumo dos pontos principais}}\n\n**Veredito:** {{veredito final}}\n\n**Ideal para:** {{perfil do comprador}}\n\n> **💡 Dica TuaVia:** {{dica extra}}', description: 'Estrutura de conclusão editorial', category: 'article', insertMode: 'replace' },
  { id: 'callout-tip', label: 'Destaque/Tip', snippet: '> **💡 Dica:** {{texto da dica}}', description: 'Bloco de destaque amarelo', category: 'formatting', insertMode: 'replace' },
  { id: 'callout-warning', label: 'Aviso/Alerta', snippet: '> **⚠️ Atenção:** {{texto do aviso}}', description: 'Bloco de alerta vermelho', category: 'formatting', insertMode: 'replace' },
  { id: 'callout-note', label: 'Nota/Info', snippet: '> **ℹ️ Nota:** {{informação adicional}}', description: 'Bloco de nota azul', category: 'formatting', insertMode: 'replace' },
  { id: 'table-specs', label: 'Tabela Comparativa', snippet: '| Modelo | Motor | Bateria | Autonomia | Preço |\n|--------|-------|---------|-----------|-------|\n| {{modelo 1}} | {{motor 1}} | {{bat 1}} | {{aut 1}} | R$ {{preço 1}} |\n| {{modelo 2}} | {{motor 2}} | {{bat 2}} | {{aut 2}} | R$ {{preço 2}} |', description: 'Tabela comparativa padrão', category: 'formatting', insertMode: 'replace' },
  { id: 'hr-section', label: 'Separador de Seção', snippet: '\n---\n\n**TuaVia • {{nome da seção}}**\n\n---', description: 'Separador visual entre seções', category: 'formatting', insertMode: 'replace' },
  { id: 'meta-desc', label: 'Meta Description', snippet: '{{resumo de 150 chars com keyword principal, benefício e CTA}}', description: 'Template de meta description otimizada', category: 'seo', insertMode: 'replace' },
  { id: 'schema-faq', label: 'FAQ Schema.org', snippet: '<script type="application/ld+json">{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [\n    {"@type": "Question", "name": "{{pergunta 1}", "acceptedAnswer": {"@type": "Answer", "text": "{{resposta 1}"}},\n    {"@type": "Question", "name": "{{pergunta 2}", "acceptedAnswer": {"@type": "Answer", "text": "{{resposta 2}"}}\n  ]\n}</script>', description: 'JSON-LD para FAQ Schema', category: 'seo', insertMode: 'replace' },
];

interface SnippetsPanelProps {
  onInsert: (snippet: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function SnippetsPanel({ onInsert, isOpen, onClose }: SnippetsPanelProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | Snippet['category']>('all');
  const [customSnippets, setCustomSnippets] = useState<Snippet[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('tuavia_custom_snippets');
        return stored ? JSON.parse(stored) : [];
      } catch { return []; }
    }
    return [];
  });

  const allSnippets = useMemo(() => [...DEFAULT_SNIPPETS, ...customSnippets], [customSnippets]);

  const filteredSnippets = useMemo(() => allSnippets.filter(s => {
    const matchesSearch = s.label.toLowerCase().includes(search.toLowerCase()) ||
                          s.description.toLowerCase().includes(search.toLowerCase()) ||
                          s.snippet.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || s.category === category;
    return matchesSearch && matchesCategory;
  }), [allSnippets, search, category]);

  const categoryColors: Record<Snippet['category'], string> = {
    bike: 'emerald',
    ranking: 'amber',
    article: 'indigo',
    formatting: 'rose',
    seo: 'purple',
    custom: 'stone',
  };

  const handleInsert = (snippet: Snippet) => {
    onInsert(snippet.snippet);
    onClose();
  };

  const categoryIcons: Record<Snippet['category'], React.ComponentType<{ className?: string }>> = {
    bike: Bike,
    ranking: Trophy,
    article: FileText,
    formatting: Sparkles,
    seo: Search,
    custom: HelpCircle,
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-[90] w-96 max-h-[85vh] bg-white border-2 border-stone-900 rounded-2xl shadow-[8px_8px_0px_0px_rgba(28,25,23,1)] animate-in slide-in-from-right-4 duration-200 flex flex-col" role="dialog" aria-modal="true" aria-label="Biblioteca de Snippets">
      <div className="flex items-center justify-between p-4 border-b-2 border-stone-900 bg-stone-50 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <span className="font-black text-stone-900">Biblioteca de Snippets</span>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-mono font-bold rounded border border-amber-300">
            {allSnippets.length} snippets
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => {}} className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-lg flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Novo
          </button>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3 border-b border-stone-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar snippets..."
            className="w-full pl-10 pr-4 py-2 bg-white border-2 border-stone-900 rounded-xl text-sm font-mono text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'bike', 'ranking', 'article', 'formatting', 'seo'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                category === cat
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              )}
            >
              {cat === 'all' ? 'Todos' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {(() => {
          if (filteredSnippets.length === 0) {
            return (
              <div className="text-center py-12 text-stone-500">
                <Search className="w-12 h-12 mx-auto mb-3 text-stone-300" />
                <p>Nenhum snippet encontrado</p>
                <p className="text-xs mt-1">Tente ajustar a busca ou filtro</p>
              </div>
            );
          }
          return filteredSnippets.map((snippet) => {
            const Icon = categoryIcons[snippet.category];
            const color = categoryColors[snippet.category];
            return (
              <button
                key={snippet.id}
                onClick={() => handleInsert(snippet)}
                className="w-full p-3 bg-stone-50 border-2 border-stone-200 rounded-xl hover:border-emerald-300 hover:bg-white transition-colors text-left group"
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'p-2 rounded-lg shrink-0 flex items-center justify-center',
                    `bg-${color}-100 text-${color}-600 group-hover:bg-${color}-200`
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-sm text-stone-900 truncate">{snippet.label}</span>
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border',
                        `bg-${color}-100 text-${color}-800 border-${color}-300`
                      )}>
                        {snippet.category}
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-500 truncate">{snippet.description}</p>
                    <div className="mt-2 p-2 bg-stone-100 rounded font-mono text-[9px] text-stone-700 max-h-16 overflow-y-auto">
                      {snippet.snippet.slice(0, 150) + (snippet.snippet.length > 150 ? '...' : '')}
                    </div>
                  </div>
                  <Copy className="w-5 h-5 text-stone-400 group-hover:text-emerald-500 transition-colors shrink-0" />
                </div>
              </button>
            );
          });
        })()}
      </div>

      <div className="px-4 py-3 bg-stone-50 border-t border-stone-200 rounded-b-2xl flex items-center justify-between text-[10px] font-mono text-stone-400">
        <span>Clique para inserir • Esc para fechar</span>
        <span>{filteredSnippets.length} de {allSnippets.length}</span>
      </div>
    </div>
  );
}