'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Table, ChevronUp, ChevronDown, Trash2, Plus, Minus, Award, Sparkles, Edit3, Save, X, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RankingItem } from '@/types/ranking';

/**
 * Coluna da matriz.
 *
 * `type`, `options` e `placeholder` só existem em algumas colunas, mas a
 * tabela renderiza as três em toda célula editável — sem tipar isso, o
 * `EditableCell` recebia `undefined` onde esperava string.
 */
interface MatrixColumn {
  key: string;
  label: string;
  width: string;
  editable: boolean;
  type?: 'text' | 'number' | 'select';
  options?: string[];
  placeholder?: string;
}

interface RankingMatrixEditorProps {
  items: RankingItem[];
  /**
   * Aceita o array direto **ou** um atualizador funcional.
   *
   * O editor chamava isto com `prev => [...]`, que é a assinatura de um
   * `setState`, mas o tipo dizia só `(items: RankingItem[]) => void` — quem
   * passasse um `setState` real (o uso pretendido)Recebia um array como
   * argumento do atualizador e quebrava em runtime. `SetStateAction` é a
   * contrato que o editor sempre usou.
   */
  onItemsChange: React.Dispatch<React.SetStateAction<RankingItem[]>>;
  criterios: string[];
}

interface EditableCellProps {
  value: any;
  onChange: (value: any) => void;
  type?: 'text' | 'number' | 'select';
  options?: string[];
  placeholder?: string;
  className?: string;
}

function EditableCell({ value, onChange, type = 'text', options, placeholder, className }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement & HTMLSelectElement>(null);
  const [localValue, setLocalValue] = useState(String(value || ''));

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // `select()` existe em `HTMLInputElement`, não em `HTMLSelectElement` — daí
      // o cast. Sem ele o editor de matriz não compilava.
      (inputRef.current as HTMLInputElement).select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    if (isEditing) {
      onChange(localValue);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setLocalValue(String(value || ''));
      setIsEditing(false);
    }
  };

  if (!isEditing) {
    return (
      <div
        onClick={() => setIsEditing(true)}
        onDoubleClick={() => setIsEditing(true)}
        className={cn(
          'min-h-[36px] px-2 py-1.5 border border-stone-200 rounded transition-colors cursor-text hover:border-emerald-300',
          className
        )}
      >
        {value === '' || value === null || value === undefined ? (
          <span className="text-stone-400 text-xs italic">{placeholder || '—'}</span>
        ) : (
          <span className="text-sm text-stone-900">{String(value)}</span>
        )}
      </div>
    );
  }

  if (type === 'select' && options) {
    return (
      <select
        ref={inputRef}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full px-2 py-1 text-sm border border-emerald-500 rounded bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200',
          className
        )}
      >
        <option value="">—</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }

  return (
    <input
      ref={inputRef}
      type={type}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={cn(
        'w-full px-2 py-1 text-sm border border-emerald-500 rounded bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200',
        className
      )}
    />
  );
}

export default function RankingMatrixEditor({
  items,
  onItemsChange,
  criterios,
}: RankingMatrixEditorProps) {
  const [sortColumn, setSortColumn] = useState<string>('posicao');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);

  // Default criteria columns
  const defaultColumns = [
    { key: 'posicao', label: '#', width: '50px', editable: false },
    { key: 'tituloItem', label: 'Produto', width: '200px', editable: true },
    { key: 'marca', label: 'Marca', width: '120px', editable: true },
    { key: 'categoriaItem', label: 'Categoria', width: '120px', editable: true },
    { key: 'notaDestaque', label: 'Destaque', width: '150px', editable: true },
  ];

  // Criteria columns (1-10 scale)
  const criteriaColumns = criterios.map(c => ({
    key: `criteria_${c}`,
    label: c,
    width: '90px',
    editable: true,
    type: 'number' as const,
    min: 1,
    max: 10,
  }));

  // Store columns
  const storeColumns = [
    { key: 'store_1_nome', label: 'Loja 1', width: '120px', editable: true },
    { key: 'store_1_preco', label: 'Preço 1', width: '90px', editable: true, type: 'number' as const },
    { key: 'store_1_url', label: 'URL 1', width: '100px', editable: true },
    { key: 'store_2_nome', label: 'Loja 2', width: '120px', editable: true },
    { key: 'store_2_preco', label: 'Preço 2', width: '90px', editable: true, type: 'number' as const },
    { key: 'store_2_url', label: 'URL 2', width: '100px', editable: true },
  ];

  // Other columns
  const otherColumns = [
    { key: 'faixaPrecoEstimado', label: 'Faixa Preço', width: '120px', editable: true },
    { key: 'imagemUrl', label: 'Imagem URL', width: '150px', editable: true },
    { key: 'bikeSlug', label: 'Bike Slug', width: '120px', editable: true },
  ];

  const allColumns = useMemo<MatrixColumn[]>(
    () => [...defaultColumns, ...criteriaColumns, ...storeColumns, ...otherColumns],
    [criterios]
  );

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aVal = getNestedValue(a, sortColumn);
      const bVal = getNestedValue(b, sortColumn);
      if (aVal === bVal) return 0;
      const direction = sortDirection === 'asc' ? 1 : -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * direction;
      }
      return String(aVal).localeCompare(String(bVal)) * direction;
    });
  }, [items, sortColumn, sortDirection]);

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const handleCellChange = useCallback((rowIndex: number, columnKey: string, newValue: any) => {
    onItemsChange(prev => {
      const updated = [...prev];
      const item = { ...updated[rowIndex] };
      
      // Handle nested keys like 'store_1_nome'
      if (columnKey.startsWith('store_')) {
        const parts = columnKey.split('_');
        const storeIndex = parseInt(parts[1]) - 1;
        const field = parts.slice(2).join('_');
        
        const lojas = [...(item.lojas || [])];
        if (!lojas[storeIndex]) {
          lojas[storeIndex] = { id: `store-${Date.now()}-${storeIndex}`, nomeLoja: '', preco: 0, url: '', cupom: '', destaque: false };
        }
        lojas[storeIndex] = { ...lojas[storeIndex], [field]: newValue };
        
        // Update legacy linkLoja1 for compatibility
        if (storeIndex === 0) {
          item.linkLoja1 = { nomeLoja: lojas[0]?.nomeLoja || '', preco: lojas[0]?.preco || 0, url: lojas[0]?.url || '' };
        }
        item.lojas = lojas;
      } else if (columnKey.startsWith('criteria_')) {
        // Store criteria scores in especificacoes.
        // O tipo de `especificacoes` é `Record<string, string>`, mas a nota do
        // critério é numérica — daí a conversão para texto na gravação.
        const criteriaName = columnKey.replace('criteria_', '');
        item.especificacoes = {
          ...item.especificacoes,
          [criteriaName]: String(Number(newValue) || 0),
        };
      } else {
        (item as any)[columnKey] = newValue;
      }
      
      updated[rowIndex] = item;
      return updated;
    });
  }, [onItemsChange]);

  const handleAddRow = () => {
    const newPos = items.length + 1;
    const newItem: RankingItem = {
      id: `item-${Date.now()}`,
      posicao: newPos,
      tituloItem: '',
      marca: '',
      categoriaItem: '',
      notaDestaque: 'Nova Posição',
      pontosPositivos: [],
      pontosNegativos: [],
      especificacoes: {},
      faixaPrecoEstimado: '',
      imagemUrl: '',
      lojas: [
        { id: `store-${Date.now()}-1`, nomeLoja: '', preco: 0, url: '', cupom: '', destaque: true },
      ],
      linkLoja1: { nomeLoja: '', preco: 0, url: '' },
      observacoes: '',
    };
    onItemsChange(prev => [...prev, newItem]);
  };

  const handleRemoveRow = (index: number) => {
    if (items.length <= 3) {
      alert('O ranking deve ter pelo menos 3 posições (Top 3).');
      return;
    }
    onItemsChange(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((item, idx) => ({ ...item, posicao: idx + 1 }));
    });
  };

  const handleMoveRow = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === sortedItems.length - 1)) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    onItemsChange(prev => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[newIndex];
      updated[newIndex] = temp;
      return updated.map((item, idx) => ({ ...item, posicao: idx + 1 }));
    });
  };

  const getSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) return <ChevronUp className="w-3 h-3 text-stone-400" />;
    return sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-emerald-600" /> : <ChevronDown className="w-3 h-3 text-emerald-600" />;
  };

  // Helper to get nested values
  function getNestedValue(obj: any, key: string): any {
    if (key.startsWith('store_')) {
      const parts = key.split('_');
      const storeIndex = parseInt(parts[1]) - 1;
      const field = parts.slice(2).join('_');
      return obj.lojas?.[storeIndex]?.[field] || '';
    }
    if (key.startsWith('criteria_')) {
      const criteriaName = key.replace('criteria_', '');
      return obj.especificacoes?.[criteriaName] || 0;
    }
    return obj[key];
  }

  return (
    <div className="bg-white border-2 border-stone-900 rounded-2xl shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 bg-stone-50 border-b-2 border-stone-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-black text-stone-900 flex items-center gap-2">
            <Table className="w-5 h-5 text-indigo-600" />
            Matrix Editor
          </h3>
          <span className="px-2 py-0.5 bg-stone-100 text-stone-700 text-[10px] font-mono font-bold rounded border border-stone-200">
            {items.length} produtos
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddRow}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Linha</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-stone-900 text-amber-300 font-bold uppercase text-[10px]">
            <tr>
              {allColumns.map(col => (
                <th
                  key={col.key}
                  style={{ width: col.width, minWidth: col.width }}
                  className={cn(
                    'px-2 py-2 text-left border-b-2 border-stone-700 cursor-pointer select-none transition-colors',
                    col.editable && 'hover:bg-stone-800'
                  )}
                  onClick={() => handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    <span>{col.label}</span>
                    {getSortIcon(col.key)}
                  </div>
                </th>
              ))}
              <th className="px-2 py-2 border-b-2 border-stone-700 text-center" style={{ width: '60px' }}>
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, rowIndex) => (
              <tr key={item.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                {allColumns.map(col => {
                  // `store_N_campo` guarda a chave como texto, então o campo da
                  // loja precisa ser lido como chave dinâmica — o tipo do
                  // `RankingStoreOffer` é fixo e não aceita indexação por `string`.
                  let value: unknown;
                  if (col.key.startsWith('store_')) {
                    const parts = col.key.split('_');
                    const loja = item.lojas?.[parseInt(parts[1], 10) - 1] as unknown as
                      | Record<string, unknown>
                      | undefined;
                    value = loja?.[parts.slice(2).join('_')] ?? '';
                  } else if (col.key.startsWith('criteria_')) {
                    value = item.especificacoes?.[col.key.replace('criteria_', '')] ?? '';
                  } else {
                    value = item[col.key as keyof RankingItem];
                  }
                  
                  return (
                    <td
                      key={col.key}
                      style={{ width: col.width, minWidth: col.width }}
                      className="px-2 py-1.5 border-r border-stone-100"
                    >
                      {col.editable ? (
                        <EditableCell
                          value={value}
                          onChange={(val) => handleCellChange(rowIndex, col.key, val)}
                          type={col.type}
                          options={col.options}
                          placeholder={col.placeholder}
                        />
                      ) : (
                        <div className="min-h-[36px] px-2 py-1.5">
                          <span className="text-sm text-stone-900 font-mono">
                            {value === '' || value === null || value === undefined ? '—' : String(value)}
                          </span>
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => handleMoveRow(rowIndex, 'up')}
                      disabled={rowIndex === 0}
                      className="p-1 text-stone-400 hover:text-emerald-600 disabled:opacity-30 transition-colors"
                      title="Subir"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveRow(rowIndex, 'down')}
                      disabled={rowIndex === sortedItems.length - 1}
                      className="p-1 text-stone-400 hover:text-emerald-600 disabled:opacity-30 transition-colors"
                      title="Descer"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    {items.length > 3 && (
                      <button
                        onClick={() => handleRemoveRow(rowIndex)}
                        className="p-1 text-stone-400 hover:text-rose-600 transition-colors"
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={allColumns.length + 1} className="text-center py-12 text-stone-500">
                  <Table className="w-12 h-12 mx-auto mb-3 text-stone-300" />
                  <p>Nenhum produto. Clique em &quot;Adicionar Linha&quot; para começar.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="p-4 bg-stone-50 border-t-2 border-stone-200 flex items-center justify-between text-[10px] font-mono text-stone-400">
        <span>Clique na célula para editar • Enter para confirmar • Esc para cancelar • Cabeçalho para ordenar</span>
        <span>{items.length} linhas</span>
      </div>
    </div>
  );
}