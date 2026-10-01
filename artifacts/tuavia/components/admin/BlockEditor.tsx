import React, { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  Quote,
  Image,
  Table,
  Code,
  Minus,
  GripVertical,
  Trash2,
  Plus,
  Copy,
  Eye,
  Edit3,
  Sparkles,
  ArrowUpDown,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EditorBlock, BlockType } from '@/types/blockEditor';

const BLOCK_TYPES: { type: BlockType; label: string; icon: React.ComponentType<{ className?: string }>; description: string; template: string }[] = [
  { type: 'paragraph', label: 'Parágrafo', icon: Type, description: 'Texto corrido', template: 'Escreva seu parágrafo aqui...' },
  { type: 'h1', label: 'Título Principal (H1)', icon: Heading1, description: 'Título da página', template: '# Título Principal' },
  { type: 'h2', label: 'Subtítulo (H2)', icon: Heading2, description: 'Seção principal', template: '## Subtítulo' },
  { type: 'h3', label: 'Sub-seção (H3)', icon: Heading3, description: 'Sub-seção', template: '### Sub-seção' },
  { type: 'bulletList', label: 'Lista com Marcadores', icon: List, description: 'Lista não ordenada', template: '- Item 1\n- Item 2\n- Item 3' },
  { type: 'numberedList', label: 'Lista Numerada', icon: List, description: 'Lista ordenada', template: '1. Primeiro\n2. Segundo\n3. Terceiro' },
  { type: 'blockquote', label: 'Citação', icon: Quote, description: 'Bloco de citação', template: '> Citação importante aqui' },
  { type: 'image', label: 'Imagem', icon: Image, description: 'Inserir imagem', template: '![Alt text](https://exemplo.com/imagem.jpg)' },
  { type: 'table', label: 'Tabela', icon: Table, description: 'Tabela Markdown', template: '| Coluna 1 | Coluna 2 |\n|----------|----------|\n| Dado 1   | Dado 2   |' },
  { type: 'code', label: 'Bloco de Código', icon: Code, description: 'Código formatado', template: '```javascript\n// Seu código aqui\nconsole.log("Olá");\n```' },
  { type: 'hr', label: 'Linha Horizontal', icon: Minus, description: 'Separador visual', template: '---' },
  { type: 'callout', label: 'Callout/Destaque', icon: Sparkles, description: 'Bloco de destaque', template: '> **💡 Dica:** Este é um bloco de destaque para informações importantes.' },
  { type: 'faq', label: 'FAQ', icon: Sparkles, description: 'Pergunta e resposta', template: '### Pergunta frequente\n\nResposta detalhada aqui...' },
  { type: 'bikeCard', label: 'Card de E-Bike', icon: Sparkles, description: 'Link para ficha de bike', template: '{{bike:caloi-e-vibe-city}}' },
  { type: 'rankingCard', label: 'Card de Ranking', icon: Trophy, description: 'Link para ranking', template: '{{ranking:top-5-urbanas-2026}}' },
];

interface BlockEditorProps {
  blocks: EditorBlock[];
  /** Aceita o array pronto ou um atualizador. `ArticleForm` passa um dos dois. */
  onBlocksChange: (blocks: EditorBlock[] | ((items: EditorBlock[]) => EditorBlock[])) => void;
  onInsertSnippet?: (snippet: string) => void;
  onAIRewrite?: (text: string, instruction: string) => Promise<string>;
}

interface SortableBlockProps {
  block: EditorBlock;
  index: number;
  blocks: EditorBlock[];
  onUpdate: (blocks: EditorBlock[]) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAIAction: (blockId: string, action: 'rewrite' | 'expand' | 'simplify' | 'translate') => void;
  onChange: (id: string, content: string) => void;
}

function BlockTypeBadge({ block, onChange }: { block: EditorBlock; onChange: (type: BlockType) => void }) {
  return (
    <select
      value={block.type}
      onChange={(e) => onChange(e.target.value as BlockType)}
      className="px-2 py-1 text-[10px] font-mono bg-stone-100 border border-stone-300 rounded hover:border-stone-400 cursor-pointer"
      title="Alterar tipo de bloco"
    >
      {BLOCK_TYPES.map((bt) => (
        <option key={bt.type} value={bt.type}>{bt.label}</option>
      ))}
    </select>
  );
}

function SortableBlock({ block, index, blocks, onUpdate, onRemove, onDuplicate, onAIAction, onChange }: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const blockDef = BLOCK_TYPES.find(b => b.type === block.type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] transition-all',
        isDragging && 'shadow-[8px_8px_0px_0px_rgba(28,25,23,1)] ring-2 ring-amber-400'
      )}
    >
      {/* Drag Handle + Header */}
      <div className="px-3 py-2 bg-stone-50 border-b border-stone-200 flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="p-1.5 text-stone-400 hover:text-stone-900 bg-stone-100 rounded-lg cursor-grab active:cursor-grabbing touch-manipulation"
          aria-label="Arrastar para reordenar"
        >
          <GripVertical className="w-5 h-5" />
        </button>
        
        <BlockTypeBadge block={block} onChange={(type) => {
          onUpdate(blocks.map(b => b.id === block.id ? { ...b, type } : b));
        }} />
        
        <span className="text-[10px] text-stone-500 font-mono flex-1 truncate ml-2">
          {blockDef?.label || block.type}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onAIAction(block.id, 'rewrite')}
            className="p-1.5 rounded-lg text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
            title="Reescrever com IA"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onAIAction(block.id, 'expand')}
            className="p-1.5 rounded-lg text-stone-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="Expandir com IA"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onAIAction(block.id, 'simplify')}
            className="p-1.5 rounded-lg text-stone-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
            title="Simplificar com IA"
          >
            <Type className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDuplicate(block.id)}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
            title="Duplicar"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onRemove(block.id)}
            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Excluir bloco"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content Editor */}
      <div className="p-3">
        {block.type === 'table' ? (
          <textarea
            value={block.content}
            onChange={(e) => onChange(block.id, e.target.value)}
            className="w-full font-mono text-xs bg-stone-50 border border-stone-200 rounded p-2 min-h-[80px] resize-y"
            placeholder="| Coluna 1 | Coluna 2 |\n|----------|----------|\n| Dado 1   | Dado 2   |"
            spellCheck={false}
          />
        ) : block.type === 'code' ? (
          <textarea
            value={block.content}
            onChange={(e) => onChange(block.id, e.target.value)}
            className="w-full font-mono text-xs bg-stone-900 text-stone-100 border border-stone-700 rounded p-2 min-h-[80px] resize-y"
            placeholder="// Código aqui"
            spellCheck={false}
          />
        ) : (
          <textarea
            value={block.content}
            onChange={(e) => onChange(block.id, e.target.value)}
            className="w-full text-sm bg-stone-50 border border-stone-200 rounded p-2 min-h-[60px] resize-y focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder={blockDef?.template || 'Digite o conteúdo...'}
            spellCheck={true}
          />
        )}
        
        {block.metadata?.aiSuggestion && (
          <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
            <strong>Sugestão IA:</strong> {block.metadata.aiSuggestion}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BlockEditor({ 
  blocks, 
  onBlocksChange, 
  onInsertSnippet,
  onAIRewrite 
}: BlockEditorProps) {
  const [showBlockLibrary, setShowBlockLibrary] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onBlocksChange((items: EditorBlock[]) => {
        const oldIndex = items.findIndex((b) => b.id === active.id);
        const newIndex = items.findIndex((b) => b.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, [onBlocksChange]);

  const handleRemove = useCallback((id: string) => {
    onBlocksChange((prev: EditorBlock[]) => prev.filter((b) => b.id !== id));
  }, [onBlocksChange]);

  const handleDuplicate = useCallback((id: string) => {
    onBlocksChange((prev: EditorBlock[]) => {
      const index = prev.findIndex((b) => b.id === id);
      if (index === -1) return prev;
      const newBlock = { ...prev[index], id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
      return [...prev.slice(0, index + 1), newBlock, ...prev.slice(index + 1)];
    });
  }, [onBlocksChange]);

  const handleChange = useCallback((id: string, content: string) => {
    onBlocksChange((prev: EditorBlock[]) => prev.map((b) => b.id === id ? { ...b, content } : b));
  }, [onBlocksChange]);

  const handleAIAction = useCallback(async (blockId: string, action: 'rewrite' | 'expand' | 'simplify' | 'translate') => {
    if (!onAIRewrite) return;
    
    const block = blocks.find(b => b.id === blockId);
    if (!block || !block.content.trim()) return;

    let instruction = '';
    switch (action) {
      case 'rewrite': instruction = 'Reescreva este texto mantendo o mesmo significado, mas com uma linguagem mais clara, fluida e profissional.'; break;
      case 'expand': instruction = 'Expanda este texto adicionando mais detalhes, exemplos e profundidade, mantendo o tom original.'; break;
      case 'simplify': instruction = 'Simplifique este texto tornando-o mais direto, conciso e fácil de entender, removendo jargões desnecessários.'; break;
      case 'translate': instruction = 'Traduza este texto para o inglês mantendo o tom e estilo original.'; break;
    }

    onBlocksChange((prev: EditorBlock[]) => prev.map(b => 
      b.id === blockId ? { ...b, metadata: { ...b.metadata, aiLoading: true } } : b
    ));

    try {
      const result = await onAIRewrite(block.content, instruction);
      onBlocksChange((prev: EditorBlock[]) => prev.map(b => 
        b.id === blockId ? { 
          ...b, 
          content: result, 
          metadata: { ...b.metadata, aiLoading: false, aiSuggestion: undefined } 
        } : b
      ));
    } catch (err) {
      onBlocksChange((prev: EditorBlock[]) => prev.map(b => 
        b.id === blockId ? { ...b, metadata: { ...b.metadata, aiLoading: false } } : b
      ));
    }
  }, [blocks, onBlocksChange, onAIRewrite]);

  const handleAddBlock = useCallback((type: BlockType) => {
    const blockDef = BLOCK_TYPES.find(b => b.type === type);
    const newBlock: EditorBlock = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      content: blockDef?.template || '',
    };
    onBlocksChange((prev: EditorBlock[]) => [...prev, newBlock]);
    setShowBlockLibrary(false);
  }, [onBlocksChange]);

  const handleInsertSnippet = useCallback((snippet: string) => {
    if (onInsertSnippet) onInsertSnippet(snippet);
    setShowBlockLibrary(false);
  }, [onInsertSnippet]);

  const enabledBlocks = blocks.filter(b => b.content.trim() || b.type === 'hr');
  const emptyBlocks = blocks.filter(b => !b.content.trim() && b.type !== 'hr');

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-stone-50 border-2 border-stone-200 rounded-xl">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-stone-900">Blocos do Artigo</h3>
          <span className="px-2 py-0.5 bg-stone-100 text-stone-700 text-[10px] font-mono font-bold rounded">
            {blocks.length} blocos
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBlockLibrary(!showBlockLibrary)}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar Bloco
          </button>
        </div>
      </div>

      {/* Block Library Modal */}
      {showBlockLibrary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowBlockLibrary(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-stone-900">Adicionar Novo Bloco</h3>
              <button onClick={() => setShowBlockLibrary(false)} className="p-2 text-stone-400 hover:text-stone-900">✕</button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] grid grid-cols-2 gap-3">
              {BLOCK_TYPES.map((bt) => (
                <button
                  key={bt.type}
                  onClick={() => handleAddBlock(bt.type)}
                  className="p-3 border-2 border-stone-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 transition-colors text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-stone-100 rounded-lg group-hover:bg-emerald-100 transition-colors">
                      <bt.icon className="w-5 h-5 text-stone-600 group-hover:text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-stone-900">{bt.label}</p>
                      <p className="text-[10px] text-stone-500 truncate">{bt.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sortable Blocks */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {blocks.map((block, index) => (
              <SortableBlock
                key={block.id}
                block={block}
                index={index}
                blocks={blocks}
                onUpdate={onBlocksChange}
                onRemove={handleRemove}
                onDuplicate={handleDuplicate}
                onAIAction={handleAIAction}
                onChange={handleChange}
              />
            ))}
            
            {blocks.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-stone-300 rounded-xl">
                <Type className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <p className="text-stone-500">Nenhum bloco ainda. Clique em &quot;Adicionar Bloco&quot; para começar.</p>
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Convert to Markdown */}
      <div className="pt-4 border-t border-stone-200">
        <label className="block text-xs font-bold uppercase text-stone-700 mb-2">Markdown Gerado (Copiar para o Editor Principal)</label>
        <div className="relative">
          <textarea
            readOnly
            value={blocks.map(b => b.content).join('\n\n')}
            className="w-full h-32 font-mono text-xs bg-stone-950 text-stone-100 border border-stone-700 rounded p-3 resize-y"
          />
          <button
            onClick={() => navigator.clipboard.writeText(blocks.map(b => b.content).join('\n\n'))}
            className="absolute right-2 top-2 px-2 py-1 text-[10px] font-mono bg-stone-700 text-stone-200 rounded hover:bg-stone-600"
          >
            Copiar
          </button>
        </div>
      </div>
    </div>
  );
}