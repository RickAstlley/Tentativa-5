'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ArrowLeft,
  Play,
  Loader2,
  Copy,
  Code,
  FileText,
  Trash2,
  Settings,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Download,
  Upload,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NVIDIA_MODELS, ALL_NVIDIA_MODEL_IDS } from '@/lib/ai/nvidiaModelCatalog';

interface ModelOption {
  id: string;
  name: string;
  category: string;
  multimodal?: boolean;
}

/**
 * Deriva de `NVIDIA_MODELS` em vez de listar à mão.
 *
 * A lista fixa trazia 7 entradas com nomes trocados: `openai/gpt-oss-20b` era
 * apresentado como "GPT-OSS 120B" e `nvidia/nemotron-3-super-120b-a12b` como
 * "DeepSeek V4 Pro". Além disso, `deepseek-ai/deepseek-v4.1-flash` não existe
 * no catálogo e caía no GLM em silêncio. Extraindo do catálogo, o seletor não
 * tem como divergir do que o servidor executa.
 */
const AVAILABLE_MODELS: ModelOption[] = ALL_NVIDIA_MODEL_IDS.map((id) => {
  const info = NVIDIA_MODELS[id];
  return {
    id,
    name: info.name,
    category: info.category,
    ...(info.multimodal ? { multimodal: true as const } : {}),
  };
});

const PRESET_PROMPTS = [
  { label: 'Artigo SEO E-Bike', prompt: 'Escreva um artigo completo e otimizado para SEO sobre "Como escolher a melhor e-bike urbana para iniciantes em 2026". Inclua: introdução, fatores de decisão (motor, bateria, peso, preço), top 3 recomendações com prós/contras, FAQ, conclusão com CTA. Tom educativo, 1500+ palavras, pt-BR.' },
  { label: 'Ficha Técnica Bosch CX', prompt: 'Gere uma ficha técnica completa do motor Bosch Performance Line CX Gen 5 (85Nm). Inclua: especificações elétricas, torque, potência nominal/pico, níveis de assistência, compatibilidade de bateria, peso, faixa de temperatura, conformidade CONTRAN 996/2023.' },
  { label: 'Top 5 E-Bikes até R$ 7k', prompt: 'Crie um ranking Top 5 das melhores e-bikes urbanas até R$ 7.000 no Brasil em 2026. Para cada: modelo, preço, motor, bateria (Wh), autonomia real, peso, nota 0-10, melhor para, link afiliado placeholder. Formato: tabela + veredito final.' },
  { label: 'Auditoria CONTRAN', prompt: 'Audite a seguinte descrição de produto e identifique não-conformidades com a Resolução CONTRAN 996/2023: "E-bike com motor 1500W, acelera até 45 km/h sem pedalar, vem com acelerador no guidão, não tem espelho nem campainha". Liste cada violação com base legal.' },
  { label: 'Comparativo Motores', prompt: 'Compare Bosch Performance Line CX Gen 5 vs Shimano EP801 em: torque máximo, potência nominal, peso, níveis de assistência, eficiência, ruído, disponibilidade no Brasil, custo-benefício. Tabela + vencedor por categoria.' },
];

export default function PlaygroundPage() {
  const router = useRouter();
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('Você é um especialista em bicicletas elétricas, engenharia, legislação CONTRAN e produção editorial para o portal TuaVia. Responda em português do Brasil com precisão técnica.');
  const [temperature, setTemperature] = useState(0.3);
  const [topP, setTopP] = useState(0.9);
  const [maxTokens, setMaxTokens] = useState(4000);
  const [enableThinking, setEnableThinking] = useState(true);
  const [reasoningEffort, setReasoningEffort] = useState<'low' | 'medium' | 'high'>('medium');
  const [apiFormat, setApiFormat] = useState<'chat_completions' | 'responses_api'>('chat_completions');
  const [imageUrl, setImageUrl] = useState('');
  const [response, setResponse] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [usage, setUsage] = useState<{ prompt_tokens: number; completion_tokens: number; total_tokens: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [showCurl, setShowCurl] = useState(false);
  const [history, setHistory] = useState<Array<{ prompt: string; response: string; model: string; timestamp: string }>>([]);
  const responseRef = useRef<HTMLTextAreaElement>(null);

  const catColors: Record<string, string> = {
    reasoning: 'bg-purple-950/50 text-purple-400 border-purple-500/30',
    chat: 'bg-blue-950/50 text-blue-400 border-blue-500/30',
    multimodal: 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30',
  };

  const handleSubmit = async () => {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError('');
    setResponse('');
    setReasoning('');
    setUsage(null);

    const model = AVAILABLE_MODELS.find(m => m.id === selectedModel);
    const isMultimodal = model?.multimodal && imageUrl;

    let messages: any[] = [];
    if (systemPrompt.trim()) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    if (isMultimodal) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: prompt || 'Analise esta imagem.' },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    try {
      const res = await fetch('/api/admin/llm/nvidia-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages,
          temperature,
          topP,
          maxTokens,
          enableThinking,
          reasoningEffort,
          apiFormat,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Erro na execução');
      }

      const text = data.result?.text || data.result?.result?.text || '';
      const reasoningContent = data.result?.reasoning || data.result?.result?.reasoningContent || '';
      const usageData = data.result?.usage || data.result?.result?.usage;

      setResponse(text);
      setReasoning(reasoningContent);
      if (usageData) setUsage(usageData);

      setHistory(prev => [
        { prompt, response: text, model: selectedModel, timestamp: new Date().toISOString() },
        ...prev.slice(0, 19),
      ]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyResponse = () => {
    navigator.clipboard.writeText(response);
  };

  const copyCurl = () => {
    const curl = generateCurl();
    navigator.clipboard.writeText(curl);
  };

  const generateCurl = () => {
    const model = AVAILABLE_MODELS.find(m => m.id === selectedModel);
    const isMultimodal = model?.multimodal && imageUrl;

    let messages: any[] = [];
    if (systemPrompt.trim()) messages.push({ role: 'system', content: systemPrompt });
    if (isMultimodal) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: prompt || 'Analise esta imagem.' },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    const body = {
      model: selectedModel,
      messages,
      temperature,
      top_p: topP,
      max_tokens: maxTokens,
      ...(enableThinking && { extra_body: { reasoning_effort: reasoningEffort } }),
    };

    return `curl -X POST https://integrate.api.nvidia.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer \$NVIDIA_API_KEY" \\
  -d '${JSON.stringify(body).replace(/'/g, "\\'")}'`;
  };

  const downloadResponse = () => {
    const blob = new Blob([response], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `playground-${selectedModel.split('/')[1]}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadPreset = (p: string) => {
    setPrompt(p);
    setResponse('');
    setReasoning('');
    setUsage(null);
    setError('');
  };

  const clearHistory = () => setHistory([]);

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
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <h1 className="font-bold text-xs sm:text-sm text-white">Playground IA</h1>
                <p className="text-[10px] text-stone-500">Teste unificado de modelos NVIDIA NIM</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="https://build.nvidia.com" target="_blank" rel="noreferrer" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-xl text-xs font-medium border border-stone-700 transition-all">
              <ExternalLink className="w-3.5 h-3.5" />
              NVIDIA Build
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto p-4">
        <div className="flex flex-col lg:flex-row gap-4 h-full min-h-0">
          {/* Left Panel: Input */}
          <div className="flex-1 flex flex-col min-w-0 lg:max-w-2xl">
            {/* Model Selector */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-stone-400 mb-2">Modelo</label>
              <select
                value={selectedModel}
                onChange={e => { setSelectedModel(e.target.value); setResponse(''); setReasoning(''); setUsage(null); setError(''); }}
                className="w-full px-3 py-2.5 bg-stone-900 border border-stone-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
              >
                {AVAILABLE_MODELS.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.category}){m.multimodal && ' 🖼️'}
                  </option>
                ))}
              </select>
            </div>

            {/* Prompt Input */}
            <div className="flex-1 flex flex-col min-h-0 mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-stone-400">Prompt</label>
                <select
                  value=""
                  onChange={e => { if (e.target.value) loadPreset(e.target.value); e.target.value = ''; }}
                  className="px-2 py-1 bg-stone-800 border border-stone-700 rounded text-xs text-stone-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="" disabled>Presets rápidos...</option>
                  {PRESET_PROMPTS.map(p => <option key={p.label} value={p.prompt}>{p.label}</option>)}
                </select>
              </div>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Digite seu prompt aqui... (Shift+Enter para nova linha, Enter para enviar)"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }}}
                className="flex-1 px-4 py-3 bg-stone-900 border border-stone-700 rounded-lg text-white text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[200px]"
                spellCheck={false}
              />
            </div>

            {/* Image Input for Multimodal */}
            {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.multimodal && (
              <div className="mb-4 p-3 bg-stone-900/50 border border-stone-700 rounded-lg space-y-2">
                <label className="block text-xs font-medium text-stone-400">Imagem (URL) para modelos multimodais</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="https://exemplo.com/imagem.jpg"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded text-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            )}

            {/* Parameters */}
            <details className="mb-4 group">
              <summary className="flex items-center justify-between cursor-pointer text-xs font-medium text-stone-400 hover:text-stone-200 py-2">
                <span>Parâmetros Avançados</span>
                <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180 text-stone-500" />
              </summary>
              <div className="grid grid-cols-2 gap-3 pb-2 border-b border-stone-800">
                <div>
                  <label className="block text-[10px] font-medium text-stone-500 mb-1">Temperature: {temperature.toFixed(1)}</label>
                  <input type="range" min="0" max="2" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-stone-500 mb-1">Top P: {topP.toFixed(1)}</label>
                  <input type="range" min="0" max="1" step="0.05" value={topP} onChange={e => setTopP(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-stone-500 mb-1">Max Tokens: {maxTokens}</label>
                  <input type="range" min="100" max="8000" step="100" value={maxTokens} onChange={e => setMaxTokens(parseInt(e.target.value))} className="w-full accent-emerald-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-stone-500 mb-1">Reasoning Effort</label>
                  <select value={reasoningEffort} onChange={e => setReasoningEffort(e.target.value as any)} className="w-full px-2 py-1.5 bg-stone-900 border border-stone-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input type="checkbox" id="thinking" checked={enableThinking} onChange={e => setEnableThinking(e.target.checked)} className="w-4 h-4 accent-emerald-500 border-stone-600" />
                  <label htmlFor="thinking" className="text-xs text-stone-300">Enable Thinking</label>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <label className="text-xs text-stone-400">API Format</label>
                  <select value={apiFormat} onChange={e => setApiFormat(e.target.value as any)} className="px-2 py-1.5 bg-stone-900 border border-stone-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500">
                    <option value="chat_completions">Chat Completions</option>
                    <option value="responses_api">Responses API</option>
                  </select>
                </div>
              </div>
            </details>

            {/* System Prompt */}
            <details className="mb-4 group">
              <summary className="flex items-center justify-between cursor-pointer text-xs font-medium text-stone-400 hover:text-stone-200 py-2">
                <span>System Prompt</span>
                <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180 text-stone-500" />
              </summary>
              <textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder="System prompt (opcional)..."
                className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[80px] mt-2"
              />
            </details>

            {/* Execute Button */}
            <button
              onClick={handleSubmit}
              disabled={loading || !prompt.trim()}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-stone-700 disabled:cursor-not-allowed text-stone-950 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              {loading ? 'Executando...' : 'Executar'}
            </button>

            {error && (
              <div className="mt-3 p-3 rounded-lg bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs font-mono">
                {error}
              </div>
            )}
          </div>

          {/* Right Panel: Output */}
          <div className="flex-1 flex flex-col min-w-0 lg:max-w-3xl border-l border-stone-800 pl-4">
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-stone-900/50 rounded-lg p-1 mb-4">
              {[
                { id: 'response', label: 'Resposta', icon: FileText },
                { id: 'reasoning', label: 'Reasoning', icon: Code },
                { id: 'raw', label: 'Raw JSON', icon: Code },
                { id: 'curl', label: 'cURL', icon: Code },
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (tab.id === 'raw') setShowRaw(!showRaw);
                      else if (tab.id === 'curl') setShowCurl(!showCurl);
                      setResponse(prev => prev); // trigger re-render
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5',
                      ((tab.id === 'raw' && showRaw) || (tab.id === 'curl' && showCurl))
                        ? 'bg-emerald-500 text-stone-950'
                        : 'text-stone-400 hover:text-stone-200'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" /> {tab.label}
                  </button>
                );
              })}
              <div className="flex-1" />
              <div className="flex items-center gap-1">
                {response && (
                  <>
                    <button onClick={copyResponse} className="p-1.5 rounded hover:bg-stone-800 text-stone-400 hover:text-white transition-colors" title="Copiar resposta">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={downloadResponse} className="p-1.5 rounded hover:bg-stone-800 text-stone-400 hover:text-white transition-colors" title="Baixar .md">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                {showCurl && (
                  <button onClick={copyCurl} className="p-1.5 rounded hover:bg-stone-800 text-stone-400 hover:text-white transition-colors" title="Copiar cURL">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {showCurl && (
                <div className="p-4 bg-stone-900 border border-stone-700 rounded-lg font-mono text-[11px] text-stone-300 whitespace-pre-wrap overflow-x-auto">
                  {generateCurl()}
                </div>
              )}

              {showRaw && (
                <div className="p-4 bg-stone-900 border border-stone-700 rounded-lg font-mono text-[11px] text-stone-300 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify({ response, reasoning, usage, model: selectedModel }, null, 2)}
                </div>
              )}

              {!showCurl && !showRaw && (
                <>
                  {reasoning && (
                    <details className="mb-4" open>
                      <summary className="flex items-center gap-2 text-xs font-medium text-stone-400 cursor-pointer px-3 py-2 bg-stone-900/50 border border-stone-700 rounded-t-lg">
                        <Code className="w-3.5 h-3.5" />
                        Reasoning ({reasoning.length} chars)
                      </summary>
                      <div className="p-4 bg-stone-900 border border-stone-700 border-t-0 rounded-b-lg text-[11px] font-mono text-stone-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
                        {reasoning}
                      </div>
                    </details>
                  )}

                  <div className="text-sm whitespace-pre-wrap">
                    {response ? (
                      response.split('\n').map((line, i) => (
                        <p key={i}>{line}</p>
                      ))
                    ) : (
                      <div className="flex items-center justify-center h-full text-stone-500">
                        <div className="text-center">
                          <Sparkles className="w-12 h-12 mx-auto mb-3 text-stone-700" />
                          <p className="text-sm">A resposta aparecerá aqui</p>
                          <p className="text-[11px] mt-1">Configure o prompt e clique em Executar</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {usage && (
                    <div className="mt-4 pt-4 border-t border-stone-800 flex items-center gap-4 text-xs text-stone-400">
                      <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> Input: {usage.prompt_tokens}</span>
                      <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> Output: {usage.completion_tokens}</span>
                      <span className="flex items-center gap-1 font-medium text-emerald-400"><Sparkles className="w-3 h-3" /> Total: {usage.total_tokens}</span>
                    </div>
                  )}
                </>
              )}

              {/* History */}
              {history.length > 0 && (
                <details className="mt-6 group">
                  <summary className="flex items-center justify-between cursor-pointer text-xs font-medium text-stone-400 hover:text-stone-200 py-2">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Histórico ({history.length})
                    </span>
                    <div className="flex items-center gap-2">
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180 text-stone-500" />
                      <button onClick={clearHistory} className="text-[10px] text-stone-500 hover:text-rose-400 font-medium">Limpar</button>
                    </div>
                  </summary>
                  <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                    {history.map((item, idx) => (
                      <div key={idx} className="p-3 bg-stone-900 border border-stone-700 rounded-lg text-[11px]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-stone-400">{new Date(item.timestamp).toLocaleTimeString()}</span>
                          <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold', catColors[item.model.split('/')[1]?.split('-')[0]] || 'bg-stone-700 text-stone-300')}>
                            {item.model.split('/').pop()}
                          </span>
                        </div>
                        <p className="text-stone-300 line-clamp-2 cursor-pointer" onClick={() => { setPrompt(item.prompt); setResponse(item.response); }}>
                          {item.prompt.slice(0, 200)}{item.prompt.length > 200 ? '...' : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}