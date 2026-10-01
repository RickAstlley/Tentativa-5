'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  Send,
  Save,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  RefreshCw,
  Bike,
  FileText,
  Trophy,
  Search,
  ExternalLink,
  Edit3,
  Check,
  AlertCircle,
  Database,
  Layers,
} from 'lucide-react';
import {
  getAIDrafts,
  deleteAIDraft,
  clearAllAIDrafts,
  publishAIDraftToFirebase,
  AIDraftItem,
  saveAIDraft,
} from '@/lib/aiDraftCache';
import { safeJsonStringify } from '@/lib/utils';

interface AIDraftCacheDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectForAudit?: (draft: AIDraftItem) => void;
}

export default function AIDraftCacheDrawer({
  isOpen,
  onClose,
  onSelectForAudit,
}: AIDraftCacheDrawerProps) {
  const [drafts, setDrafts] = useState<AIDraftItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskFilter, setSelectedTaskFilter] = useState<string>('all');
  const [editingDraft, setEditingDraft] = useState<AIDraftItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isPublishingId, setIsPublishingId] = useState<string | null>(null);

  const loadDrafts = () => {
    setDrafts(getAIDrafts());
  };

  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => {
        setDrafts(getAIDrafts());
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredDrafts = (drafts || []).filter((d) => {
    if (!d) return false;
    const title = (d.title || '').toLowerCase();
    const content = (d.rawContent || '').toLowerCase();
    const q = (searchQuery || '').toLowerCase();
    const matchesSearch = !q || title.includes(q) || content.includes(q);
    const matchesTask = selectedTaskFilter === 'all' || d.taskType === selectedTaskFilter;
    return matchesSearch && matchesTask;
  });

  const handleDelete = (id: string) => {
    deleteAIDraft(id);
    loadDrafts();
    setActionMessage('Rascunho excluído do cache local.');
    setTimeout(() => setActionMessage(null), 2500);
  };

  const handleClearAll = () => {
    if (confirm('Tem certeza que deseja apagar todos os rascunhos em cache do navegador?')) {
      clearAllAIDrafts();
      loadDrafts();
      setActionMessage('Cache de rascunhos limpo com sucesso.');
      setTimeout(() => setActionMessage(null), 2500);
    }
  };

  const handlePublish = async (draftId: string) => {
    setIsPublishingId(draftId);
    setActionMessage(null);
    try {
      const result = await publishAIDraftToFirebase(draftId);
      setActionMessage(`✅ ${result.message}`);
      loadDrafts();
    } catch (err: any) {
      setActionMessage(`⚠️ Erro ao publicar: ${err?.message || 'Falha no servidor'}`);
    } finally {
      setIsPublishingId(null);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleSaveEdit = () => {
    if (!editingDraft) return;
    saveAIDraft({
      id: editingDraft.id,
      taskType: editingDraft.taskType,
      title: editTitle,
      summary: editContent.slice(0, 180).replace(/[*_#]/g, '').trim(),
      model: editingDraft.model,
      rawContent: editContent,
      status: editingDraft.status,
      firebaseRefId: editingDraft.firebaseRefId,
    });
    setEditingDraft(null);
    loadDrafts();
    setActionMessage('Alterações salvas no cache local!');
    setTimeout(() => setActionMessage(null), 2500);
  };

  const handleSendDraftToAudit = (draft: AIDraftItem) => {
    const isEbike =
      draft.taskType === 'ebike_autofill' ||
      draft.taskType === 'ebike_ingest_step' ||
      Boolean(draft.parsedData?.marca && draft.parsedData?.modelo);

    const isRanking =
      draft.taskType === 'ranking_generation' ||
      Boolean(
        draft.parsedData?.criterioAvaliacao ||
          (Array.isArray(draft.parsedData?.itens) &&
            draft.parsedData.itens.length > 0 &&
            (draft.parsedData.itens[0]?.tituloItem || draft.parsedData.itens[0]?.posicao || draft.parsedData.itens[0]?.nome))
      );

    if (isEbike) {
      const bikeData = draft.parsedData || {};
      const prefillObj = {
        marca: bikeData.marca || draft.title.split(' ')[0] || 'TuaVia Selected',
        modelo: bikeData.modelo || draft.title,
        usoPrincipal: bikeData.usoPrincipal || 'Urbana',
        autonomiaKm: bikeData.autonomiaKm || 40,
        potenciaW: bikeData.potenciaW || 350,
        pesoKg: bikeData.pesoKg || 22,
        tempoCargaHoras: bikeData.tempoCargaHoras || 5,
        badge: bikeData.badge || '',
        resumoExecutivo: bikeData.resumoExecutivo || draft.summary || '',
        idealFor: bikeData.idealFor || '',
        pros: bikeData.pros || [],
        cons: bikeData.cons || [],
        specSections: bikeData.specSections || [],
        ofertas: bikeData.ofertas || bikeData.ofertasSugestoes || [],
      };
      const payload = safeJsonStringify(prefillObj);
      sessionStorage.setItem('tuavia_prefill_bike', payload);
      localStorage.setItem('tuavia_prefill_bike', payload);
      window.location.href = '/admin/bikes/novo';
      return;
    }

    if (isRanking) {
      const rankingData = draft.parsedData || {};
      const prefillObj = {
        titulo: rankingData.titulo || draft.title,
        subtitulo: rankingData.subtitulo || draft.summary || '',
        categoria: rankingData.categoria || 'ebikes',
        quantidadeItens: rankingData.quantidadeItens || (Array.isArray(rankingData.itens) ? rankingData.itens.length : 5),
        criterioAvaliacao: rankingData.criterioAvaliacao || 'Custo-benefício, autonomia e assistência técnica.',
        conclusaoGeral: rankingData.conclusaoGeral || '',
        itens: rankingData.itens || [],
        source: 'llm',
        llmValidated: true,
      };
      const payload = safeJsonStringify(prefillObj);
      sessionStorage.setItem('tuavia_prefill_ranking', payload);
      localStorage.setItem('tuavia_prefill_ranking', payload);
      window.location.href = '/admin/rankings/novo';
      return;
    }

    // Caso Padrão: Artigo Editorial -> Formulário/Auditoria
    const draftData = {
      title: draft.title,
      slug:
        draft.parsedData?.slug ||
        draft.title
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, ''),
      excerpt: draft.summary || draft.parsedData?.excerpt || draft.rawContent.slice(0, 160).replace(/[*_#]/g, '').trim(),
      category: draft.parsedData?.category || 'Guias',
      body: draft.parsedData?.artigo_completo_markdown || draft.parsedData?.markdownContent || draft.rawContent,
      coverImage: draft.parsedData?.coverImage || draft.metadata?.coverImage || 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=1200&q=80',
      metaTitle: draft.title,
      metaDescription: draft.summary || draft.title,
      focusKeywords: ['e-bike', 'mobilidade', 'análise'],
      readingTimeMinutes: draft.parsedData?.readingTimeMinutes || 5,
      publishedAt: new Date().toISOString(),
      relatedBikeCategories: ['Urbanas', 'Dobráveis'],
      updatedAt: new Date().toISOString(),
    };

    const payload = safeJsonStringify(draftData);
    sessionStorage.setItem('tuavia_prefill_article', payload);
    localStorage.setItem('tuavia_prefill_article', payload);
    localStorage.setItem('tuavia_draft_article_audit', payload);
    window.location.href = '/admin/artigos/novo';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-gray-200 animate-in slide-in-from-right duration-200">
        {/* Header do Drawer */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white flex items-center justify-between border-b border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400 border border-emerald-500/30">
                <Database className="w-4 h-4" />
              </span>
              <h3 className="text-lg font-bold">Rascunhos no Cache Local</h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-emerald-950 text-xs font-black">
                {drafts.length}
              </span>
            </div>
            <p className="text-xs text-gray-300 mt-0.5">
              Cache de curto prazo no navegador. Audite e confirme antes de enviar para o Firebase.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagem de Ação */}
        {actionMessage && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage(null)} className="text-emerald-600 hover:text-emerald-900">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Search & Filters */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar rascunho por palavra-chave..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={selectedTaskFilter}
            onChange={(e) => setSelectedTaskFilter(e.target.value)}
            className="text-xs bg-white border border-gray-300 rounded-lg px-2.5 py-2 text-gray-700 w-full sm:w-auto"
          >
            <option value="all">Todas as Tarefas</option>
            <option value="bicycle_analysis">Análise de E-Bike</option>
            <option value="content_generation">Artigo de Blog</option>
            <option value="data_audit">Auditoria Nemotron</option>
          </select>

          {drafts.length > 0 && (
            <button
              onClick={handleClearAll}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition-colors shrink-0 flex items-center gap-1 border border-red-200"
              title="Limpar todos os rascunhos"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar Cache</span>
            </button>
          )}
        </div>

        {/* Modal de Edição Interna */}
        {editingDraft ? (
          <div className="p-5 flex-1 overflow-y-auto space-y-4 bg-gray-50">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-600" />
                Editar Rascunho no Cache
              </h4>
              <button
                onClick={() => setEditingDraft(null)}
                className="text-xs text-gray-500 hover:text-gray-800 font-semibold"
              >
                Cancelar
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Título do Item</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-lg font-semibold text-gray-900"
              />
            </div>

            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Conteúdo (YAML / Markdown)</label>
              <textarea
                rows={12}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full text-xs p-3 bg-white border border-gray-300 rounded-lg font-mono text-gray-800 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingDraft(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded-lg"
              >
                Voltar
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                Salvar Alterações no Cache
              </button>
            </div>
          </div>
        ) : (
          /* Lista de Rascunhos */
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
            {filteredDrafts.length > 0 ? (
              filteredDrafts.map((draft) => {
                const isEbike =
                  draft.taskType === 'ebike_autofill' ||
                  draft.taskType === 'ebike_ingest_step' ||
                  Boolean(draft.parsedData?.marca && draft.parsedData?.modelo);

                const isRanking =
                  draft.taskType === 'ranking_generation' ||
                  Boolean(draft.parsedData?.criterioAvaliacao || draft.parsedData?.itens);

                const typeBadgeText = isEbike
                  ? '⚡ Ficha E-Bike'
                  : isRanking
                  ? '🏆 Top Ranking'
                  : '✍️ Artigo Editorial';

                const typeBadgeStyle = isEbike
                  ? 'bg-purple-100 text-purple-900 border-purple-200'
                  : isRanking
                  ? 'bg-amber-100 text-amber-900 border-amber-200'
                  : 'bg-emerald-100 text-emerald-900 border-emerald-200';

                const actionButtonText = isEbike
                  ? 'Formulário de E-Bike'
                  : isRanking
                  ? 'Formulário de Ranking'
                  : 'Auditoria de Artigo';

                const ActionIcon = isEbike ? Bike : isRanking ? Trophy : UserCheck;

                return (
                  <div
                    key={draft.id}
                    className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs hover:border-emerald-300 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${typeBadgeStyle}`}
                          >
                            {typeBadgeText}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              draft.status === 'published'
                                ? 'bg-blue-100 text-blue-800'
                                : draft.status === 'audited'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {draft.status === 'published' ? '✅ No Firebase' : 'Cache Local'}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {new Date(draft.updatedAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-gray-900">{draft.title}</h4>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingDraft(draft);
                            setEditTitle(draft.title);
                            setEditContent(draft.rawContent);
                          }}
                          className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Editar rascunho"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(draft.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir do cache"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-gray-600 line-clamp-2 bg-gray-50 p-2 rounded-lg font-sans">
                      {draft.summary || draft.rawContent.slice(0, 140)}
                    </p>

                    {/* Ações do Rascunho */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2.5 text-xs">
                      <span className="text-[11px] text-gray-500">
                        LLM: <strong>{draft.model}</strong>
                      </span>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleSendDraftToAudit(draft)}
                          className="px-2.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          title={`Abrir em ${actionButtonText}`}
                        >
                          <ActionIcon className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{actionButtonText}</span>
                        </button>

                        {onSelectForAudit && (
                          <button
                            onClick={() => {
                              onSelectForAudit(draft);
                              onClose();
                            }}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded-lg transition-colors flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                            <span>Auditar LLM</span>
                          </button>
                        )}

                        <button
                          onClick={() => handlePublish(draft.id)}
                          disabled={isPublishingId === draft.id}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all flex items-center gap-1 shadow-2xs active:scale-95 disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {isPublishingId === draft.id
                              ? 'Enviando...'
                              : draft.status === 'published'
                              ? 'Re-sincronizar'
                              : 'Subir pro Firebase'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center text-gray-500 space-y-2 my-auto">
                <Database className="w-10 h-10 mx-auto text-gray-300" />
                <p className="font-semibold text-sm text-gray-700">Nenhum rascunho em cache.</p>
                <p className="text-xs text-gray-400">
                  Respostas e análises geradas pelo Copiloto IA serão listadas aqui temporariamente para sua confirmação.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
