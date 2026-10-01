'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ArrowLeft,
  Database,
  Upload,
  Download,
  Search,
  Loader2,
  Trash2,
  FileText,
  PlusCircle,
  Eye,
  EyeOff,
  Settings,
  Brain,
  Globe,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  namespace: string;
  documentCount: number;
  chunkCount: number;
  embeddingModel: string;
  createdAt: string;
  updatedAt: string;
  sizeBytes: number;
}

interface Document {
  id: string;
  knowledgeBaseId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  chunkCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  uploadedAt: string;
  processedAt?: string;
}

interface SearchResult {
  id: string;
  documentId: string;
  content: string;
  score: number;
  metadata: Record<string, any>;
}

/**
 * Modelos de embedding do NIM.
 *
 * `nvidia/nemotron-3-embed-1b` aparecia duas vezes, com dimensões conflitantes
 * (4096 e 2048) — a segunda entrada era na verdade o EmbedQA 1B v2 com outro ID.
 * O `id` é o que vai para a API, então as duas linhas produziam o mesmo vetor
 * com metadados de tamanho diferentes. Agora o ID é a identidade da entrada.
 */
const EMBEDDING_MODELS = [
  { id: 'nvidia/nemotron-3-embed-1b', name: 'Nemotron 3 Embed 1B', dimensions: 2048, maxTokens: 8192 },
  { id: 'nvidia/embed-qa-4', name: 'NVIDIA Embed QA-4', dimensions: 768, maxTokens: 512 },
];

const MOCK_KBS: KnowledgeBase[] = [
  {
    id: 'kb-bikes',
    name: 'Catálogo E-Bikes',
    description: 'Fichas técnicas, manuais e especificações de bicicletas elétricas',
    namespace: 'bikes',
    documentCount: 24,
    chunkCount: 187,
    embeddingModel: 'nvidia/embed-qa-4',
    createdAt: '2025-01-15T10:30:00Z',
    updatedAt: '2025-08-20T14:22:00Z',
    sizeBytes: 12_450_000,
  },
  {
    id: 'kb-articles',
    name: 'Artigos & Blog',
    description: 'Base de conhecimento de artigos publicados e rascunhos',
    namespace: 'articles',
    documentCount: 42,
    chunkCount: 312,
    embeddingModel: 'nvidia/embed-qa-4',
    createdAt: '2025-02-01T09:15:00Z',
    updatedAt: '2025-09-10T11:45:00Z',
    sizeBytes: 8_920_000,
  },
  {
    id: 'kb-legislation',
    name: 'Legislação CONTRAN',
    description: 'Resoluções, leis e normas técnicas para conformidade de e-bikes',
    namespace: 'legislation',
    documentCount: 8,
    chunkCount: 56,
    embeddingModel: 'nvidia/nemotron-3-embed-1b',
    createdAt: '2025-03-10T16:00:00Z',
    updatedAt: '2025-09-01T10:00:00Z',
    sizeBytes: 3_210_000,
  },
];

const MOCK_DOCUMENTS: Document[] = [
  { id: 'doc-1', knowledgeBaseId: 'kb-bikes', fileName: 'bosch-cx-gen5-manual.pdf', fileType: 'application/pdf', fileSize: 2_450_000, chunkCount: 18, status: 'completed', uploadedAt: '2025-08-15T10:00:00Z', processedAt: '2025-08-15T10:02:30Z' },
  { id: 'doc-2', knowledgeBaseId: 'kb-bikes', fileName: 'shimano-ep801-specs.md', fileType: 'text/markdown', fileSize: 45_000, chunkCount: 5, status: 'completed', uploadedAt: '2025-08-18T14:30:00Z', processedAt: '2025-08-18T14:31:10Z' },
  { id: 'doc-3', knowledgeBaseId: 'kb-articles', fileName: 'guia-compra-ebike-2026.md', fileType: 'text/markdown', fileSize: 120_000, chunkCount: 12, status: 'completed', uploadedAt: '2025-09-05T09:00:00Z', processedAt: '2025-09-05T09:01:45Z' },
  { id: 'doc-4', knowledgeBaseId: 'kb-legislation', fileName: 'contran-996-2023.pdf', fileType: 'application/pdf', fileSize: 1_800_000, chunkCount: 22, status: 'completed', uploadedAt: '2025-09-01T10:00:00Z', processedAt: '2025-09-01T10:03:20Z' },
];

export default function VectorStorePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'bases' | 'documents' | 'search' | 'settings'>('bases');
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>(MOCK_KBS);
  const [documents, setDocuments] = useState<Document[]>(MOCK_DOCUMENTS);
  const [selectedKB, setSelectedKB] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showCreateKB, setShowCreateKB] = useState(false);
  const [newKB, setNewKB] = useState({ name: '', description: '', namespace: '', embeddingModel: EMBEDDING_MODELS[0].id });
  const [selectedEmbeddingModel, setSelectedEmbeddingModel] = useState(EMBEDDING_MODELS[0].id);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !selectedKB) return;
    setSearching(true);
    setSearchResults([]);
    
    // Simula busca vetorial
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const mockResults: SearchResult[] = [
      { id: 'r1', documentId: 'doc-1', content: 'O motor Bosch Performance Line CX Gen 5 oferece torque máximo de 85Nm e potência nominal de 250W...', score: 0.94, metadata: { page: 3, section: 'Especificações' } },
      { id: 'r2', documentId: 'doc-1', content: 'A bateria PowerTube 750Wh proporciona autonomia de até 120km no modo Eco...', score: 0.89, metadata: { page: 7, section: 'Bateria' } },
      { id: 'r3', documentId: 'doc-3', content: 'Para escolher a melhor e-bike urbana, considere: tipo de motor (central vs roda), capacidade da bateria...', score: 0.82, metadata: { section: 'Guia de Compra' } },
    ].filter(r => r.content.toLowerCase().includes(searchQuery.toLowerCase()));
    
    setSearchResults(mockResults);
    setSearching(false);
  }, [searchQuery, selectedKB]);

  const handleFileUpload = async (files: FileList, kbId: string) => {
    setUploading(true);
    const newDocs: Document[] = Array.from(files).map((file, i) => ({
      id: `doc-${Date.now()}-${i}`,
      knowledgeBaseId: kbId,
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
      chunkCount: 0,
      status: 'pending',
      uploadedAt: new Date().toISOString(),
    }));
    
    setDocuments(prev => [...prev, ...newDocs]);
    
    // Simula processamento
    for (const doc of newDocs) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'processing' } : d));
      await new Promise(resolve => setTimeout(resolve, 2000));
      const chunks = Math.max(1, Math.ceil(doc.fileSize / 50000));
      setDocuments(prev => prev.map(d => d.id === doc.id ? { 
        ...d, 
        status: 'completed', 
        chunkCount: chunks,
        processedAt: new Date().toISOString() 
      } : d));
      
      // Atualiza KB
      setKnowledgeBases(prev => prev.map(kb => kb.id === kbId ? {
        ...kb,
        documentCount: kb.documentCount + 1,
        chunkCount: kb.chunkCount + chunks,
        sizeBytes: kb.sizeBytes + doc.fileSize,
        updatedAt: new Date().toISOString(),
      } : kb));
    }
    
    setUploading(false);
  };

  const createKB = () => {
    if (!newKB.name || !newKB.namespace) return;
    const kb: KnowledgeBase = {
      id: `kb-${newKB.namespace}`,
      name: newKB.name,
      description: newKB.description,
      namespace: newKB.namespace,
      documentCount: 0,
      chunkCount: 0,
      embeddingModel: newKB.embeddingModel,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sizeBytes: 0,
    };
    setKnowledgeBases(prev => [...prev, kb]);
    setShowCreateKB(false);
    setNewKB({ name: '', description: '', namespace: '', embeddingModel: EMBEDDING_MODELS[0].id });
  };

  const deleteKB = (id: string) => {
    if (!confirm('Excluir base de conhecimento e todos seus documentos?')) return;
    setKnowledgeBases(prev => prev.filter(kb => kb.id !== id));
    setDocuments(prev => prev.filter(d => d.knowledgeBaseId !== id));
    if (selectedKB === id) setSelectedKB(null);
  };

  const deleteDocument = (id: string) => {
    const doc = documents.find(d => d.id === id);
    if (!doc) return;
    if (!confirm(`Excluir "${doc.fileName}"?`)) return;
    setDocuments(prev => prev.filter(d => d.id !== id));
    setKnowledgeBases(prev => prev.map(kb => kb.id === doc.knowledgeBaseId ? {
      ...kb,
      documentCount: Math.max(0, kb.documentCount - 1),
      chunkCount: Math.max(0, kb.chunkCount - doc.chunkCount),
      sizeBytes: Math.max(0, kb.sizeBytes - doc.fileSize),
    } : kb));
  };

  const kbDocs = selectedKB ? documents.filter(d => d.knowledgeBaseId === selectedKB) : [];

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 shrink-0 bg-stone-900/95 backdrop-blur-md border-b border-stone-800 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/admin/ia" className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-xs font-semibold border border-stone-700 transition-all">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2 pl-2 border-l border-stone-800">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-400 flex items-center justify-center text-white shrink-0">
                <Brain className="w-3.5 h-3.5" />
              </div>
              <div>
                <h1 className="font-bold text-xs sm:text-sm text-white">Vector Store Admin</h1>
                <p className="text-[10px] text-stone-500">Gerencie bases de conhecimento para RAG</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto mt-3 flex gap-1 overflow-x-auto pb-2">
          {[
            { id: 'bases', label: 'Bases', icon: Database },
            { id: 'documents', label: 'Documentos', icon: FileText },
            { id: 'search', label: 'Busca Semântica', icon: Search },
            { id: 'settings', label: 'Configurações', icon: Settings },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-all',
                activeTab === tab.id
                  ? 'bg-emerald-500 text-stone-950 shadow-xs'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 p-4 max-w-7xl mx-auto w-full">
        {/* Tab: Bases de Conhecimento */}
        {activeTab === 'bases' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-white">Bases de Conhecimento</h2>
              <button onClick={() => setShowCreateKB(true)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold rounded-xl flex items-center gap-2 transition-colors">
                <PlusCircle className="w-4 h-4" />
                Nova Base
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {knowledgeBases.map(kb => (
                <div key={kb.id} className={cn(
                  'p-5 rounded-2xl border transition-all',
                  selectedKB === kb.id
                    ? 'border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/20'
                    : 'border-stone-800 bg-stone-900/50 hover:border-stone-700'
                )} onClick={() => setSelectedKB(selectedKB === kb.id ? null : kb.id)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <Database className="w-5 h-5 text-purple-400" />
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteKB(kb.id); }}
                      className="p-1 text-stone-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="font-bold text-white mb-1">{kb.name}</h3>
                  <p className="text-stone-400 text-xs mb-3 line-clamp-2">{kb.description}</p>
                  <div className="space-y-1 text-[11px] text-stone-500">
                    <div className="flex items-center gap-1.5"><span className="font-mono">{kb.documentCount}</span> docs</div>
                    <div className="flex items-center gap-1.5"><span className="font-mono">{kb.chunkCount}</span> chunks</div>
                    <div className="flex items-center gap-1.5">{formatBytes(kb.sizeBytes)}</div>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="px-1.5 py-0.5 bg-stone-800 rounded">{kb.embeddingModel}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-stone-800 flex items-center justify-between text-[10px] text-stone-500">
                    <span>Criado: {formatDate(kb.createdAt)}</span>
                    <span>Atualizado: {formatDate(kb.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </div>

            {selectedKB && (
              <div className="mt-6 p-4 bg-stone-900/50 border border-stone-800 rounded-xl animate-in slide-in-from-bottom-2">
                <h3 className="font-bold text-white mb-3">Ações para: {knowledgeBases.find(k => k.id === selectedKB)?.name}</h3>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => setActiveTab('documents')} className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium rounded-lg border border-stone-700 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Gerenciar Documentos
                  </button>
                  <button onClick={() => setActiveTab('search')} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg flex items-center gap-2">
                    <Search className="w-4 h-4" /> Testar Busca
                  </button>
                  <button className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg flex items-center gap-2">
                    <Download className="w-4 h-4" /> Exportar Base
                  </button>
                  <button onClick={() => setSelectedKB(null)} className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium rounded-lg border border-stone-700">
                    Limpar Seleção
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Documentos */}
        {activeTab === 'documents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-bold text-lg text-white">Documentos</h2>
              <div className="flex items-center gap-3">
                <select
                  value={selectedKB || ''}
                  onChange={e => setSelectedKB(e.target.value || null)}
                  className="px-3 py-2 bg-stone-800 border border-stone-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Todas as bases</option>
                  {knowledgeBases.map(kb => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
                </select>
                <label className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold rounded-xl cursor-pointer flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Upload
                  <input type="file" accept=".pdf,.md,.txt,.docx,.json" multiple onChange={e => e.target.files && handleFileUpload(e.target.files, selectedKB || '')} className="hidden" />
                </label>
              </div>
            </div>

            {kbDocs.length === 0 ? (
              <div className="text-center py-12 text-stone-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-stone-700" />
                <p className="text-sm">{selectedKB ? 'Nenhum documento nesta base' : 'Selecione uma base de conhecimento'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-800 text-left text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      <th className="pb-2 pr-4">Arquivo</th>
                      <th className="pb-2 pr-4">Tipo</th>
                      <th className="pb-2 pr-4">Tamanho</th>
                      <th className="pb-2 pr-4">Chunks</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Upload</th>
                      <th className="pb-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kbDocs.map(doc => (
                      <tr key={doc.id} className="border-b border-stone-800/50 hover:bg-stone-900/50">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-white truncate max-w-[200px]">{doc.fileName}</p>
                          <p className="text-[10px] text-stone-500 font-mono">{doc.id}</p>
                        </td>
                        <td className="py-3 pr-4">
                          <span className={cn('px-2 py-0.5 rounded text-[9px] font-bold',
                            doc.fileType === 'application/pdf' ? 'bg-red-950/50 text-red-400' :
                            doc.fileType === 'text/markdown' ? 'bg-blue-950/50 text-blue-400' :
                            'bg-stone-800 text-stone-400'
                          )}>{doc.fileType.split('/')[1]?.toUpperCase() || 'UNK'}</span>
                        </td>
                        <td className="py-3 pr-4 text-stone-400 font-mono">{formatBytes(doc.fileSize)}</td>
                        <td className="py-3 pr-4 font-mono text-emerald-400">{doc.chunkCount}</td>
                        <td className="py-3 pr-4">
                          <span className={cn('px-2 py-0.5 rounded text-[9px] font-bold',
                            doc.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                            doc.status === 'processing' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse' :
                            doc.status === 'failed' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                            'bg-stone-500/20 text-stone-400 border-stone-500/30'
                          )}>{doc.status}</span>
                          {doc.error && <p className="text-[10px] text-rose-400 mt-1">{doc.error}</p>}
                        </td>
                        <td className="py-3 pr-4 text-stone-500 text-[11px]">{formatDate(doc.uploadedAt)}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <button className="p-1.5 rounded hover:bg-stone-800 text-stone-400 hover:text-white" title="Ver chunks"><Eye className="w-3.5 h-3.5" /></button>
                            <button onClick={() => deleteDocument(doc.id)} className="p-1.5 rounded hover:bg-rose-950/50 text-stone-400 hover:text-rose-400" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {uploading && (
              <div className="fixed bottom-4 right-4 bg-emerald-950/90 border border-emerald-500/30 p-4 rounded-xl text-emerald-300 animate-in slide-in-from-right-2">
                <div className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Processando documentos...</div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Busca Semântica */}
        {activeTab === 'search' && (
          <div className="space-y-6 max-w-4xl">
            <div>
              <h2 className="font-bold text-lg text-white mb-1">Busca Semântica</h2>
              <p className="text-stone-400 text-sm">Teste consultas vetoriais nas bases de conhecimento</p>
            </div>

            <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-stone-400 mb-2">Base de Conhecimento</label>
                  <select
                    value={selectedKB || ''}
                    onChange={e => setSelectedKB(e.target.value || null)}
                    className="w-full px-3 py-2.5 bg-stone-950 border border-stone-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Selecione uma base...</option>
                    {knowledgeBases.map(kb => <option key={kb.id} value={kb.id}>{kb.name} ({kb.chunkCount} chunks)</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-400 mb-2">Consulta</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      placeholder="Digite sua consulta em linguagem natural..."
                      className="flex-1 px-4 py-3 bg-stone-950 border border-stone-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button onClick={handleSearch} disabled={searching || !searchQuery.trim() || !selectedKB} className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-stone-700 text-stone-950 font-bold rounded-lg flex items-center gap-2 transition-colors">
                      {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-stone-500">
                  <label className="flex items-center gap-1.5">
                    <select value={selectedEmbeddingModel} onChange={e => setSelectedEmbeddingModel(e.target.value)} className="px-2 py-1 bg-stone-950 border border-stone-700 rounded text-white text-xs">
                      {EMBEDDING_MODELS.map(m => <option key={m.id} value={m.id}>{m.name} ({m.dimensions}d)</option>)}
                    </select>
                    <span>Modelo de Embedding</span>
                  </label>
                </div>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold text-white">Resultados ({searchResults.length})</h3>
                {searchResults.map((result, i) => (
                  <div key={result.id} className="p-4 bg-stone-900/50 border border-stone-800 rounded-xl">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-stone-400 bg-stone-800 px-2 py-0.5 rounded">#{i + 1}</span>
                        <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold',
                          result.score > 0.9 ? 'bg-emerald-500/20 text-emerald-400' :
                          result.score > 0.7 ? 'bg-amber-500/20 text-amber-400' :
                          'bg-stone-500/20 text-stone-400'
                        )}>{(result.score * 100).toFixed(1)}%</span>
                      </div>
                      <span className="text-[10px] text-stone-500 font-mono">{result.documentId}</span>
                    </div>
                    <p className="text-stone-300 text-sm line-clamp-3">{result.content}</p>
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-stone-500">
                      {Object.entries(result.metadata).map(([k, v]) => (
                        <span key={k} className="px-1.5 py-0.5 bg-stone-800 rounded">{k}: {String(v)}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchQuery && !searching && searchResults.length === 0 && selectedKB && (
              <div className="text-center py-8 text-stone-500">
                <Search className="w-12 h-12 mx-auto mb-3 text-stone-700" />
                <p className="text-sm">Nenhum resultado encontrado</p>
                <p className="text-[11px] mt-1">Tente termos diferentes ou verifique se a base tem documentos processados</p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Configurações */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-6">
            <h2 className="font-bold text-lg text-white">Configurações do Vector Store</h2>

            <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="font-bold text-white mb-3">Modelo de Embedding Padrão</h3>
                <select value={selectedEmbeddingModel} onChange={e => setSelectedEmbeddingModel(e.target.value)} className="w-full px-3 py-2.5 bg-stone-950 border border-stone-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500">
                  {EMBEDDING_MODELS.map(m => <option key={m.id} value={m.id}>{m.name} — {m.dimensions} dimensões, {m.maxTokens} tokens max</option>)}
                </select>
              </div>

              <div className="pt-4 border-t border-stone-800">
                <h3 className="font-bold text-white mb-3">Chunking Strategy</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-stone-400 mb-1">Tamanho do Chunk (tokens)</label>
                    <input type="number" defaultValue={512} min={128} max={2048} step={64} className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-400 mb-1">Overlap (tokens)</label>
                    <input type="number" defaultValue={50} min={0} max={200} step={10} className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-stone-800">
                <h3 className="font-bold text-white mb-3">Filtros de Metadados</h3>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-emerald-500" />
                  <span className="text-sm text-stone-300">Extrair metadados automáticos (título, autor, data, seção)</span>
                </label>
                <label className="flex items-center gap-2 mt-2">
                  <input type="checkbox" className="w-4 h-4 accent-emerald-500" />
                  <span className="text-sm text-stone-300">Indexar apenas conteúdo textual (ignorar imagens/tabelas)</span>
                </label>
              </div>

              <div className="pt-4 border-t border-stone-800 flex justify-end">
                <button className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold rounded-xl">Salvar Configurações</button>
              </div>
            </div>

            <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-6">
              <h3 className="font-bold text-white mb-3">Estatísticas Globais</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Bases', value: knowledgeBases.length, icon: Database, color: 'text-purple-400' },
                  { label: 'Documentos', value: documents.length, icon: FileText, color: 'text-blue-400' },
                  { label: 'Chunks Totais', value: knowledgeBases.reduce((a, b) => a + b.chunkCount, 0), icon: Brain, color: 'text-emerald-400' },
                  { label: 'Tamanho Total', value: formatBytes(knowledgeBases.reduce((a, b) => a + b.sizeBytes, 0)), icon: Globe, color: 'text-amber-400' },
                ].map(s => (
                  <div key={s.label} className="p-4 bg-stone-950 border border-stone-800 rounded-xl text-center">
                    <s.icon className={cn('w-6 h-6 mx-auto mb-2', s.color)} />
                    <p className="text-2xl font-bold text-white">{s.value}</p>
                    <p className="text-[10px] text-stone-500">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Modal: Criar Base */}
        {showCreateKB && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-md w-full p-6 animate-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-white">Nova Base de Conhecimento</h2>
                <button onClick={() => setShowCreateKB(false)} className="p-1 text-stone-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-stone-400 mb-1">Nome</label>
                  <input type="text" value={newKB.name} onChange={e => setNewKB({...newKB, name: e.target.value})} placeholder="Ex: Catálogo E-Bikes" className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs text-stone-400 mb-1">Namespace (slug único)</label>
                  <input type="text" value={newKB.namespace} onChange={e => setNewKB({...newKB, namespace: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})} placeholder="ex: bikes" className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs text-stone-400 mb-1">Descrição</label>
                  <textarea value={newKB.description} onChange={e => setNewKB({...newKB, description: e.target.value})} placeholder="Descrição da base..." className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[80px]" rows={3} />
                </div>
                <div>
                  <label className="block text-xs text-stone-400 mb-1">Modelo de Embedding</label>
                  <select value={newKB.embeddingModel} onChange={e => setNewKB({...newKB, embeddingModel: e.target.value})} className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500">
                    {EMBEDDING_MODELS.map(m => <option key={m.id} value={m.id}>{m.name} ({m.dimensions}d)</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowCreateKB(false)} className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium rounded-lg border border-stone-700">Cancelar</button>
                <button onClick={createKB} disabled={!newKB.name || !newKB.namespace} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold rounded-lg disabled:opacity-50">Criar</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}