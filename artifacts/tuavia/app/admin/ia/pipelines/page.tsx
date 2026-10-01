'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ArrowLeft,
  PlusCircle,
  Trash2,
  GripVertical,
  Play,
  Loader2,
  Download,
  Upload,
  Code,
  Save,
  Settings,
  ChevronDown,
  ChevronUp,
  X,
  Link2,
  Unlink2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ALL_NVIDIA_MODEL_IDS } from '@/lib/ai/nvidiaModelCatalog';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type PipelineNodeType = 'prompt' | 'model' | 'transform' | 'condition' | 'output';

interface PipelineNode {
  id: string;
  type: PipelineNodeType;
  label: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface Pipeline {
  id: string;
  name: string;
  description: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  createdAt: string;
  updatedAt: string;
}

const NODE_TYPES: Array<{ type: PipelineNodeType; label: string; icon: string; color: string; description: string }> = [
  { type: 'prompt', label: 'Prompt', icon: '📝', color: 'bg-blue-500', description: 'Entrada de prompt/texto' },
  { type: 'model', label: 'Modelo LLM', icon: '🤖', color: 'bg-emerald-500', description: 'Executa modelo NVIDIA' },
  { type: 'transform', label: 'Transformar', icon: '⚙️', color: 'bg-amber-500', description: 'Processa/transforma saída' },
  { type: 'condition', label: 'Condição', icon: '🔀', color: 'bg-purple-500', description: 'Roteamento condicional' },
  { type: 'output', label: 'Saída', icon: '📤', color: 'bg-cyan-500', description: 'Resultado final' },
];

/** Catálogo NVIDIA NIM, derivado da fonte única de verdade. */
const AVAILABLE_MODELS: string[] = ALL_NVIDIA_MODEL_IDS;

function NodeComponent({ node, selected, onSelect, onDelete, onConfigChange }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const typeInfo = NODE_TYPES.find(t => t.type === node.type);
  const handleConfigChange = (key: string, value: any) => {
    onConfigChange(node.id, { ...node.config, [key]: value });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative p-4 rounded-xl border-2 min-w-[200px] max-w-[280px] shadow-lg transition-all',
        'bg-stone-900 border-stone-700',
        selected && 'ring-2 ring-emerald-500 border-emerald-500',
        isDragging && 'rotate-1 scale-105 z-50'
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <button {...attributes} {...listeners} className="p-1 text-stone-400 hover:text-white cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4" />
        </button>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold', typeInfo?.color)}>
          {typeInfo?.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white truncate">{node.label}</p>
          <p className="text-[10px] text-stone-500">{typeInfo?.description}</p>
        </div>
        <button onClick={() => onDelete(node.id)} className="p-1 text-stone-400 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Node-specific config */}
      {node.type === 'prompt' && (
        <div className="space-y-2 text-sm">
          <textarea
            value={node.config.template || ''}
            onChange={e => handleConfigChange('template', e.target.value)}
            placeholder="Template do prompt... Use {{input}} para entrada anterior"
            className="w-full px-2 py-1.5 bg-stone-800 border border-stone-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[60px]"
            rows={3}
          />
          <input
            type="text"
            value={node.config.variables || ''}
            onChange={e => handleConfigChange('variables', e.target.value)}
            placeholder="Variáveis: var1,var2,var3"
            className="w-full px-2 py-1.5 bg-stone-800 border border-stone-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      )}

      {node.type === 'model' && (
        <div className="space-y-2 text-sm">
          <select
            value={node.config.model || AVAILABLE_MODELS[0]}
            onChange={e => handleConfigChange('model', e.target.value)}
            className="w-full px-2 py-1.5 bg-stone-800 border border-stone-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {AVAILABLE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-stone-500">Temp: {node.config.temperature || 0.3}</label>
              <input type="range" min="0" max="2" step="0.1" value={node.config.temperature || 0.3} onChange={e => handleConfigChange('temperature', parseFloat(e.target.value))} className="w-full accent-emerald-500" />
            </div>
            <div>
              <label className="block text-[10px] text-stone-500">Max Tokens: {node.config.maxTokens || 2000}</label>
              <input type="range" min="100" max="8000" step="100" value={node.config.maxTokens || 2000} onChange={e => handleConfigChange('maxTokens', parseInt(e.target.value))} className="w-full accent-emerald-500" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-stone-300">
            <input type="checkbox" checked={node.config.enableThinking} onChange={e => handleConfigChange('enableThinking', e.target.checked)} className="w-3.5 h-3.5 accent-emerald-500" />
            Enable Thinking
          </label>
        </div>
      )}

      {node.type === 'transform' && (
        <div className="space-y-2 text-sm">
          <select
            value={node.config.operation || 'json_extract'}
            onChange={e => handleConfigChange('operation', e.target.value)}
            className="w-full px-2 py-1.5 bg-stone-800 border border-stone-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="json_extract">Extrair JSON</option>
            <option value="regex">Regex Replace</option>
            <option value="template">Template String</option>
            <option value="filter">Filtrar Array</option>
            <option value="map">Mapear Array</option>
          </select>
          <textarea
            value={node.config.params || ''}
            onChange={e => handleConfigChange('params', e.target.value)}
            placeholder="Parâmetros da operação (JSON)..."
            className="w-full px-2 py-1.5 bg-stone-800 border border-stone-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[50px]"
            rows={2}
          />
        </div>
      )}

      {node.type === 'condition' && (
        <div className="space-y-2 text-sm">
          <select
            value={node.config.field || 'output'}
            onChange={e => handleConfigChange('field', e.target.value)}
            className="w-full px-2 py-1.5 bg-stone-800 border border-stone-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="output">Saída do modelo</option>
            <option value="usage.total_tokens">Tokens totais</option>
            <option value="latency">Latência (ms)</option>
            <option value="custom">Campo customizado</option>
          </select>
          <select
            value={node.config.operator || 'contains'}
            onChange={e => handleConfigChange('operator', e.target.value)}
            className="w-full px-2 py-1.5 bg-stone-800 border border-stone-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="contains">Contém</option>
            <option value="equals">Igual a</option>
            <option value="gt">Maior que</option>
            <option value="lt">Menor que</option>
            <option value="regex">Regex match</option>
          </select>
          <input
            type="text"
            value={node.config.value || ''}
            onChange={e => handleConfigChange('value', e.target.value)}
            placeholder="Valor para comparar"
            className="w-full px-2 py-1.5 bg-stone-800 border border-stone-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <div className="flex gap-2 text-[10px] text-stone-400">
            <span>Se verdadeiro → handle &quot;true&quot;</span>
            <span>Se falso → handle &quot;false&quot;</span>
          </div>
        </div>
      )}

      {node.type === 'output' && (
        <div className="space-y-2 text-sm">
          <select
            value={node.config.format || 'text'}
            onChange={e => handleConfigChange('format', e.target.value)}
            className="w-full px-2 py-1.5 bg-stone-800 border border-stone-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="text">Texto Simples</option>
            <option value="markdown">Markdown</option>
            <option value="json">JSON</option>
            <option value="html">HTML</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-stone-300">
            <input type="checkbox" checked={node.config.saveToDrafts} onChange={e => handleConfigChange('saveToDrafts', e.target.checked)} className="w-3.5 h-3.5 accent-emerald-500" />
            Salvar nos rascunhos
          </label>
        </div>
      )}

      {/* Connection handles */}
      <div className="absolute -right-2 top-1/2 -translate-y-1/2">
        <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-stone-900 cursor-crosshair" data-handle="output" title="Conectar saída" />
      </div>
      <div className="absolute -left-2 top-1/2 -translate-y-1/2">
        <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-stone-900 cursor-crosshair" data-handle="input" title="Conectar entrada" />
      </div>
      {node.type === 'condition' && (
        <>
          <div className="absolute -right-2 top-1/4 -translate-y-1/2">
            <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-stone-900 cursor-crosshair" data-handle="true" title="Se verdadeiro" />
          </div>
          <div className="absolute -right-2 bottom-1/4 translate-y-1/2">
            <div className="w-3 h-3 rounded-full bg-rose-500 border-2 border-stone-900 cursor-crosshair" data-handle="false" title="Se falso" />
          </div>
        </>
      )}
    </div>
  );
}

function EdgeComponent({ edge }: any) {
  // Simplified edge rendering - in production use @dnd-kit/edges or SVG paths
  return null;
}

export default function PipelineEditorPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tuavia_pipelines');
      if (saved) return JSON.parse(saved);
    }
    return [{
      id: 'default',
      name: 'Artigo SEO Completo',
      description: 'Gera artigo otimizado para SEO a partir de tema',
      nodes: [
        { id: '1', type: 'prompt', label: 'Tema do Artigo', config: { template: 'Escreva um artigo SEO completo sobre: {{input}}', variables: 'topic' }, position: { x: 100, y: 100 } },
        { id: '2', type: 'model', label: 'Kimi K3 - Redator', config: { model: 'moonshotai/kimi-k3', temperature: 0.3, maxTokens: 4000, enableThinking: true }, position: { x: 100, y: 250 } },
        { id: '3', type: 'transform', label: 'Extrair JSON', config: { operation: 'json_extract', params: '{"path": "article"}' }, position: { x: 100, y: 400 } },
        { id: '4', type: 'output', label: 'Artigo Final', config: { format: 'markdown', saveToDrafts: true }, position: { x: 100, y: 550 } },
      ],
      edges: [
        { id: 'e1', source: '1', target: '2' },
        { id: 'e2', source: '2', target: '3' },
        { id: 'e3', source: '3', target: '4' },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];
  });
  const [currentPipelineId, setCurrentPipelineId] = useState(pipelines[0]?.id || '');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<{ source: string; handle: string } | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [pipelineName, setPipelineName] = useState(pipelines[0]?.name || '');
  const [pipelineDesc, setPipelineDesc] = useState(pipelines[0]?.description || '');

  const currentPipeline = pipelines.find(p => p.id === currentPipelineId);
  const selectedNode = currentPipeline?.nodes.find(n => n.id === selectedNodeId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPipelines(prev => prev.map(p => {
        if (p.id !== currentPipelineId) return p;
        const oldIndex = p.nodes.findIndex(n => n.id === active.id);
        const newIndex = p.nodes.findIndex(n => n.id === over.id);
        return {
          ...p,
          nodes: arrayMove(p.nodes, oldIndex, newIndex),
          updatedAt: new Date().toISOString(),
        };
      }));
    }
  };

  const addNode = (type: PipelineNode['type']) => {
    if (!currentPipeline) return;
    const newNode: PipelineNode = {
      id: `node-${Date.now()}`,
      type,
      label: NODE_TYPES.find(t => t.type === type)?.label || type,
      config: type === 'model' ? { model: AVAILABLE_MODELS[0], temperature: 0.3, maxTokens: 2000, enableThinking: true } : {},
      position: { x: 100, y: 100 + currentPipeline.nodes.length * 150 },
    };
    setPipelines(prev => prev.map(p => p.id === currentPipelineId ? { ...p, nodes: [...p.nodes, newNode], updatedAt: new Date().toISOString() } : p));
  };

  const deleteNode = (nodeId: string) => {
    setPipelines(prev => prev.map(p => {
      if (p.id !== currentPipelineId) return p;
      return {
        ...p,
        nodes: p.nodes.filter(n => n.id !== nodeId),
        edges: p.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
        updatedAt: new Date().toISOString(),
      };
    }));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  const updateNodeConfig = (nodeId: string, config: Record<string, any>) => {
    setPipelines(prev => prev.map(p => {
      if (p.id !== currentPipelineId) return p;
      return {
        ...p,
        nodes: p.nodes.map(n => n.id === nodeId ? { ...n, config } : n),
        updatedAt: new Date().toISOString(),
      };
    }));
  };

  const handleConnect = (sourceId: string, handle: string) => {
    if (connecting) {
      if (connecting.source !== sourceId) {
        const newEdge: PipelineEdge = {
          id: `edge-${Date.now()}`,
          source: connecting.source,
          target: sourceId,
          sourceHandle: connecting.handle,
          targetHandle: handle,
        };
        setPipelines(prev => prev.map(p => p.id === currentPipelineId ? { ...p, edges: [...p.edges, newEdge], updatedAt: new Date().toISOString() } : p));
      }
      setConnecting(null);
    } else {
      setConnecting({ source: sourceId, handle });
    }
  };

  const savePipeline = () => {
    if (!currentPipeline) return;
    setPipelines(prev => prev.map(p => p.id === currentPipelineId ? { ...p, name: pipelineName, description: pipelineDesc, updatedAt: new Date().toISOString() } : p));
    localStorage.setItem('tuavia_pipelines', JSON.stringify(pipelines.map(p => p.id === currentPipelineId ? { ...p, name: pipelineName, description: pipelineDesc } : p)));
  };

  const exportPipeline = () => {
    if (!currentPipeline) return;
    const blob = new Blob([JSON.stringify(currentPipeline, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-${currentPipeline.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importPipeline = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const pipeline = JSON.parse(e.target?.result as string);
        if (pipeline.nodes && pipeline.edges) {
          const newPipeline = { ...pipeline, id: `pipeline-${Date.now()}`, name: pipeline.name + ' (importado)', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          setPipelines(prev => [...prev, newPipeline]);
          setCurrentPipelineId(newPipeline.id);
          localStorage.setItem('tuavia_pipelines', JSON.stringify([...pipelines, newPipeline]));
        }
      } catch (err) {
        alert('Arquivo inválido');
      }
    };
    reader.readAsText(file);
  };

  const runPipeline = async () => {
    if (!currentPipeline) return;
    alert('Execução de pipeline será implementada na próxima versão. Por enquanto, use o LLM Panel em modo Agent para encadear modelos.');
  };

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
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-400 flex items-center justify-center text-white shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <h1 className="font-bold text-xs sm:text-sm text-white">Pipeline Visual (DAG)</h1>
                <p className="text-[10px] text-stone-500">Orquestre agentes encadeados visualmente</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={currentPipelineId}
              onChange={e => setCurrentPipelineId(e.target.value)}
              className="px-3 py-1.5 bg-stone-800 border border-stone-700 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={() => setShowTemplates(!showTemplates)} className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-lg text-xs font-medium border border-stone-700 transition-colors flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" />
              Templates
            </button>
            <button onClick={savePipeline} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors">
              <Save className="w-3.5 h-3.5" />
              Salvar
            </button>
            <button onClick={runPipeline} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors">
              <Play className="w-3.5 h-3.5" />
              Executar
            </button>
            <div className="flex items-center gap-1">
              <button onClick={exportPipeline} className="p-1.5 rounded hover:bg-stone-800 text-stone-400 hover:text-white transition-colors" title="Exportar JSON">
                <Download className="w-3.5 h-3.5" />
              </button>
              <label className="p-1.5 rounded hover:bg-stone-800 text-stone-400 hover:text-white transition-colors cursor-pointer" title="Importar JSON">
                <Upload className="w-3.5 h-3.5" />
                <input type="file" accept=".json" onChange={e => e.target.files?.[0] && importPipeline(e.target.files[0])} className="hidden" />
              </label>
            </div>
            <button
              onClick={() => {
                const newPipeline: Pipeline = {
                  id: `pipeline-${Date.now()}`,
                  name: `Novo Pipeline ${pipelines.length + 1}`,
                  description: '',
                  nodes: [],
                  edges: [],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                setPipelines(prev => [...prev, newPipeline]);
                setCurrentPipelineId(newPipeline.id);
              }}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-lg text-xs font-medium border border-stone-700 transition-colors flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Novo
            </button>
          </div>
        </div>
      </header>

      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-stone-800 flex items-center justify-between">
              <h2 className="font-bold text-white">Templates de Pipeline</h2>
              <button onClick={() => setShowTemplates(false)} className="p-1 text-stone-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              {[
                { name: 'Artigo SEO', desc: 'Tema → Prompt → Modelo → Extrair JSON → Markdown', nodes: 4 },
                { name: 'Ficha E-Bike', desc: 'Especs → Modelo Análise → Validar CONTRAN → Ficha Técnica', nodes: 4 },
                { name: 'Ranking Top 5', desc: 'Critérios → Modelo Ranking → Ordenar → Tabela + Veredito', nodes: 4 },
                { name: 'Auditoria', desc: 'Texto → Modelo Auditor → Condição (conforme?) → Relatório', nodes: 4 },
              ].map((t, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const template: Pipeline = {
                      id: `template-${i}-${Date.now()}`,
                      name: t.name,
                      description: t.desc,
                      nodes: [
                        { id: '1', type: 'prompt', label: 'Entrada', config: { template: 'Process: {{input}}' }, position: { x: 100, y: 100 } },
                        { id: '2', type: 'model', label: 'Modelo Principal', config: { model: 'moonshotai/kimi-k3', temperature: 0.3, maxTokens: 3000, enableThinking: true }, position: { x: 100, y: 250 } },
                        { id: '3', type: 'transform', label: 'Processar', config: { operation: 'json_extract', params: '{}' }, position: { x: 100, y: 400 } },
                        { id: '4', type: 'output', label: 'Resultado', config: { format: 'markdown', saveToDrafts: true }, position: { x: 100, y: 550 } },
                      ],
                      edges: [
                        { id: 'e1', source: '1', target: '2' },
                        { id: 'e2', source: '2', target: '3' },
                        { id: 'e3', source: '3', target: '4' },
                      ],
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };
                    setPipelines(prev => [...prev, template]);
                    setCurrentPipelineId(template.id);
                    setShowTemplates(false);
                  }}
                  className="w-full p-4 bg-stone-950 border border-stone-800 rounded-xl text-left hover:border-emerald-500/50 transition-colors"
                >
                  <p className="font-bold text-white">{t.name}</p>
                  <p className="text-xs text-stone-400 mt-1">{t.desc}</p>
                  <p className="text-[10px] text-stone-500 mt-1">{t.nodes} nós</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden p-4">
        {/* Left Panel: Node Palette */}
        <aside className="hidden lg:block w-64 shrink-0 bg-stone-900/50 border border-stone-800 rounded-xl p-4 overflow-y-auto">
          <h3 className="font-bold text-white mb-3 text-sm">Nós Disponíveis</h3>
          <div className="space-y-2">
            {NODE_TYPES.map(nodeType => (
              <button
                key={nodeType.type}
                onClick={() => addNode(nodeType.type)}
                className="w-full p-3 rounded-lg border border-stone-700 bg-stone-950 text-left hover:border-emerald-500/50 hover:bg-stone-900 transition-all group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold', nodeType.color)}>
                    {nodeType.icon}
                  </div>
                  <span className="font-medium text-white">{nodeType.label}</span>
                </div>
                <p className="text-[10px] text-stone-500 pl-9">{nodeType.description}</p>
              </button>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-stone-800">
            <h3 className="font-bold text-white mb-3 text-sm">Pipeline Atual</h3>
            <input
              type="text"
              value={pipelineName}
              onChange={e => setPipelineName(e.target.value)}
              placeholder="Nome do pipeline"
              className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 mb-2"
            />
            <textarea
              value={pipelineDesc}
              onChange={e => setPipelineDesc(e.target.value)}
              placeholder="Descrição..."
              className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[60px]"
              rows={3}
            />
          </div>
        </aside>

        {/* Center: Canvas */}
        <div className="flex-1 relative min-w-0">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={currentPipeline?.nodes.map(n => n.id) || []}
              strategy={verticalListSortingStrategy}
            >
              <div className="relative h-full min-h-[600px] bg-stone-900/50 border border-stone-800 rounded-xl overflow-hidden">
                {/* Grid background */}
                <div className="absolute inset-0" style={{
                  backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }} />

                {/* Nodes */}
                <div className="relative h-full p-4">
                  {currentPipeline?.nodes.map(node => (
                    <NodeComponent
                      key={node.id}
                      node={node}
                      selected={selectedNodeId === node.id}
                      onSelect={setSelectedNodeId}
                      onDelete={deleteNode}
                      onConfigChange={updateNodeConfig}
                    />
                  ))}

                  {/* Connection lines (simplified) */}
                  {currentPipeline?.edges.map(edge => (
                    <div
                      key={edge.id}
                      className="absolute pointer-events-none"
                      style={{
                        // Simplified: just show connection indicator
                        top: '50%',
                        left: '50%',
                      }}
                    >
                      <div className="w-px h-8 bg-emerald-500/50" />
                    </div>
                  ))}

                  {/* Connecting line preview */}
                  {connecting && (
                    <div className="absolute inset-0 pointer-events-none">
                      <svg className="w-full h-full" style={{ position: 'absolute', top: 0, left: 0 }}>
                        <line
                          x1={100} y1={100}
                          x2={200} y2={200}
                          stroke="#22c55e"
                          strokeWidth={2}
                          strokeDasharray="5,5"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Drop zone indicator */}
                <div className="absolute bottom-4 right-4 text-stone-600 text-xs font-mono">
                  Arraste nós da esquerda
                </div>
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Right Panel: Node Details */}
        <aside className="hidden lg:block w-72 shrink-0 bg-stone-900/50 border border-stone-800 rounded-xl p-4 overflow-y-auto">
          <h3 className="font-bold text-white mb-3 text-sm">Propriedades do Nó</h3>
          {selectedNode ? (
            <div className="space-y-4">
              <div className="p-3 bg-stone-950 rounded-lg border border-stone-700">
                <p className="font-bold text-white">{selectedNode.label}</p>
                <p className="text-[10px] text-stone-400 mt-1">ID: {selectedNode.id.slice(0, 20)}...</p>
                <p className="text-[10px] text-stone-400">Tipo: {selectedNode.type}</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-stone-300 text-xs uppercase tracking-wider">Conexões</h4>
                <div className="space-y-1 text-[11px] text-stone-400">
                  {currentPipeline?.edges.filter(e => e.source === selectedNode.id).map(e => (
                    <div key={e.id} className="flex items-center gap-1">
                      <Link2 className="w-3 h-3 text-emerald-400" />
                      <span>→ {e.target}</span>
                    </div>
                  ))}
                  {currentPipeline?.edges.filter(e => e.target === selectedNode.id).map(e => (
                    <div key={e.id} className="flex items-center gap-1">
                      <Unlink2 className="w-3 h-3 text-blue-400" />
                      <span>{e.source} →</span>
                    </div>
                  ))}
                  {currentPipeline?.edges.filter(e => e.source === selectedNode.id).length === 0 &&
                   currentPipeline?.edges.filter(e => e.target === selectedNode.id).length === 0 && (
                    <p className="text-stone-500">Nenhuma conexão</p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-stone-800">
                <h4 className="font-medium text-stone-300 text-xs uppercase tracking-wider">Ações</h4>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => { setSelectedNodeId(null); }} className="flex-1 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium rounded border border-stone-700">
                    Desselecionar
                  </button>
                  <button onClick={() => deleteNode(selectedNode.id)} className="flex-1 px-3 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 text-xs font-medium rounded border border-rose-500/30">
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-stone-500">
              <Sparkles className="w-12 h-12 mx-auto mb-3 text-stone-700" />
              <p className="text-sm">Selecione um nó para ver propriedades</p>
              <p className="text-[11px] mt-1">Arraste da esquerda para criar</p>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}