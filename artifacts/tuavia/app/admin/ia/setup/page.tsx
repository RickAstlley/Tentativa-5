'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Key,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Info,
  Save,
  TestTube2,
  Globe,
  Shield,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Plus,
  ExternalLink,  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NVIDIA_MODELS, ALL_NVIDIA_MODEL_IDS } from '@/lib/ai/nvidiaModelCatalog';

interface ModelOption {
  id: string;
  name: string;
  category: string;
  multimodal?: boolean;
}


interface SetupStep {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  complete: boolean;
}

const STEPS: SetupStep[] = [
  { id: 'welcome', label: 'Bem-vindo', icon: Sparkles, complete: false },
  { id: 'credentials', label: 'Credenciais', icon: Key, complete: false },
  { id: 'connection', label: 'Teste Conexão', icon: TestTube2, complete: false },
  { id: 'models', label: 'Modelos', icon: Globe, complete: false },
  { id: 'complete', label: 'Concluído', icon: CheckCircle2, complete: false },
];

/**
 * Modelos do catálogo NVIDIA NIM, derivados de `NVIDIA_MODELS`.
 *
 * Antes estas duas listas eram escritas à mão e divergiam do servidor: os nomes
 * estavam trocados e `deepseek-ai/deepseek-v4.1-flash` não existe no catálogo.
 * Um NIM local roda o mesmo conjunto de pesos, então a lista local e a da nuvem
 * passam a ser a mesma — muda o endpoint, não o catálogo.
 */
const LOCAL_NIM_MODELS: string[] = ALL_NVIDIA_MODEL_IDS;

const CLOUD_FREE_MODELS: ModelOption[] = ALL_NVIDIA_MODEL_IDS.map((id) => {
  const info = NVIDIA_MODELS[id];
  return {
    id,
    name: info.name,
    category: info.category,
    ...(info.multimodal ? { multimodal: true as const } : {}),
  };
});

export default function NvidiaSetupWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLocalNIM, setIsLocalNIM] = useState(false);
  const [baseUrl, setBaseUrl] = useState('https://integrate.api.nvidia.com/v1');
  const [apiKeys, setApiKeys] = useState<string[]>(['']);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; latency?: number; error?: string; models?: string[] }>>({});
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [workerSecret, setWorkerSecret] = useState('');
  const [executorUrl, setExecutorUrl] = useState('');

  const stepIds = STEPS.map(s => s.id);

  const updateStepComplete = (stepId: string, complete: boolean) => {
    setCurrentStep(prev => {
      const idx = stepIds.indexOf(stepId);
      if (idx >= 0) {
        const newSteps = [...STEPS];
        newSteps[idx] = { ...newSteps[idx], complete };
        return currentStep;
      }
      return currentStep;
    });
  };

  const handleTestConnection = async () => {
    setTesting(true);
    const results: Record<string, { success: boolean; latency?: number; error?: string; models?: string[] }> = {};

    const keysToTest = isLocalNIM ? ['local-nim-key'] : apiKeys.filter(k => k.trim());
    const url = isLocalNIM ? baseUrl : 'https://integrate.api.nvidia.com/v1';

    for (const key of keysToTest) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const start = Date.now();
        const res = await fetch(`${url}/models`, {
          headers: { Authorization: `Bearer ${key}` },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const latency = Date.now() - start;

        if (res.ok) {
          const data = await res.json();
          const models = data.data?.map((m: any) => m.id) || [];
          results[key] = { success: true, latency, models };
        } else {
          results[key] = { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
        }
      } catch (err: any) {
        results[key] = { success: false, error: err.name === 'AbortError' ? 'Timeout (10s)' : err.message };
      }
    }

    setTestResults(results);
    setTesting(false);

    const anySuccess = Object.values(results).some(r => r.success);
    updateStepComplete('connection', anySuccess);
    if (anySuccess) updateStepComplete('models', true);
  };

  const handleSaveConfig = async () => {
    try {
      const config = {
        isLocalNIM,
        baseUrl,
        apiKeys: apiKeys.filter(k => k.trim()),
        selectedModels,
        workerSecret,
        executorUrl,
      };

      const res = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        setSaved(true);
        updateStepComplete('complete', true);
      } else {
        alert('Erro ao salvar configuração');
      }
    } catch (err) {
      alert('Erro de conexão ao salvar');
    }
  };

  const addApiKey = () => setApiKeys([...apiKeys, '']);
  const removeApiKey = (idx: number) => setApiKeys(apiKeys.filter((_, i) => i !== idx));
  const updateApiKey = (idx: number, value: string) => setApiKeys(apiKeys.map((k, i) => i === idx ? value : k));

  const toggleModel = (modelId: string) => {
    setSelectedModels(prev => prev.includes(modelId)
      ? prev.filter(m => m !== modelId)
      : [...prev, modelId]);
  };

  const goNext = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  const goPrev = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  const currentStepData = STEPS[currentStep];

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Progress Header */}
      <header className="sticky top-0 z-20 bg-stone-900/95 backdrop-blur-md border-b border-stone-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/admin/ia" className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-black text-lg text-white">Setup NVIDIA NIM</h1>
              <p className="text-xs text-stone-400">Configure sua conexão com modelos de IA</p>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="relative">
            <div className="absolute top-3 left-0 right-0 h-1 bg-stone-800" />
            <div className="flex items-center justify-between relative z-10">
              {STEPS.map((step, idx) => (
                <div key={step.id} className="flex flex-col items-center gap-1">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all',
                    idx < currentStep || step.complete
                      ? 'bg-emerald-500 border-emerald-500 text-stone-950'
                      : idx === currentStep
                        ? 'bg-amber-500 border-amber-500 text-stone-950 ring-4 ring-amber-500/20'
                        : 'bg-stone-800 border-stone-700 text-stone-500'
                  )}>
                    {React.createElement(step.icon, { className: 'w-4 h-4' })}
                  </div>
                  <span className={cn('text-[10px] font-medium', idx <= currentStep || step.complete ? 'text-stone-300' : 'text-stone-500')}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 pb-20">
        {/* Step Content */}
        <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-6 sm:p-8 animate-in slide-in-from-bottom-2 duration-200">
          {/* Step 1: Welcome */}
          {currentStep === 0 && (
            <div className="space-y-6 text-center">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white mb-2">Bem-vindo ao Setup NVIDIA</h2>
                <p className="text-stone-400 text-sm max-w-xl mx-auto">
                  Este assistente vai configurar sua conexão com a NVIDIA NIM para usar modelos de IA gratuitos e poderosos no TuaVia.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                {[
                  { icon: Key, title: 'API Keys', desc: 'Configure uma ou múltiplas chaves NVIDIA' },
                  { icon: Globe, title: 'Local ou Cloud', desc: 'Use NIM local (localhost) ou API cloud da NVIDIA' },
                  { icon: Shield, title: 'Modelos Free', desc: '7+ modelos gratuitos: Kimi K3, Nemotron, DeepSeek, GLM...' },
                ].map((item, i) => (
                  <div key={i} className="p-4 bg-stone-950 border border-stone-800 rounded-xl">
                    <div className="w-10 h-10 bg-stone-800 rounded-lg flex items-center justify-center mb-3">
                      <item.icon className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h3 className="font-bold text-white mb-1">{item.title}</h3>
                    <p className="text-stone-500 text-xs">{item.desc}</p>
                  </div>
                ))}
              </div>

              <button onClick={goNext} className="w-full sm:w-auto mx-auto px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold rounded-xl flex items-center gap-2 justify-center transition-colors">
                <ChevronRight className="w-5 h-5" />
                Começar
              </button>
            </div>
          )}

          {/* Step 2: Credentials */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-white mb-1">Credenciais NVIDIA</h2>
                <p className="text-stone-400 text-sm">Configure como você vai se conectar aos modelos</p>
              </div>

              <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={isLocalNIM}
                    onChange={() => setIsLocalNIM(true)}
                    className="w-4 h-4 accent-emerald-500 border-stone-600 text-emerald-500 focus:ring-emerald-500"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-white">NIM Local (localhost)</div>
                    <p className="text-stone-500 text-xs">Rodando seu próprio servidor NIM na máquina/container</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={!isLocalNIM}
                    onChange={() => setIsLocalNIM(false)}
                    className="w-4 h-4 accent-emerald-500 border-stone-600 text-emerald-500 focus:ring-emerald-500"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-white">NVIDIA Cloud API</div>
                    <p className="text-stone-500 text-xs">Use a API gerenciada da NVIDIA (gratuita com cadastro)</p>
                  </div>
                </label>
              </div>

              {isLocalNIM ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-400 mb-2">URL Base do NIM Local</label>
                    <input
                      type="text"
                      value={baseUrl}
                      onChange={e => setBaseUrl(e.target.value)}
                      placeholder="http://localhost:8000/v1"
                      className="w-full px-4 py-3 bg-stone-950 border border-stone-700 rounded-lg text-white placeholder-stone-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <p className="text-stone-500 text-xs mt-1">Ex: http://localhost:8000/v1 ou http://192.168.1.100:8000/v1</p>
                  </div>

                  <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-900/50">
                    <div className="flex items-center gap-2 text-emerald-300 text-xs">
                      <Info className="w-4 h-4 shrink-0" />
                      <span>Modelos disponíveis dependem do que você carregou no NIM local. Modelos comuns: Llama 3.1, Phi 3.5, Gemma 2.</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-400 mb-2">API Keys NVIDIA <span className="text-emerald-400">(múltiplas para fallback)</span></label>
                    <div className="space-y-2">
                      {apiKeys.map((key, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <input
                              type={showKeys ? 'text' : 'password'}
                              value={key}
                              onChange={e => updateApiKey(idx, e.target.value)}
                              placeholder={idx === 0 ? 'nvapi-xxxxxxxxxxxx' : 'Chave adicional (opcional)'}
                              className="w-full px-4 py-3 bg-stone-950 border border-stone-700 rounded-lg text-white placeholder-stone-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-12"
                            />
                            <button
                              type="button"
                              onClick={() => setShowKeys(!showKeys)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white"
                            >
                              {showKeys ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {apiKeys.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeApiKey(idx)}
                              className="p-2 text-stone-500 hover:text-rose-400 hover:bg-rose-950/50 rounded-lg transition-colors"
                              title="Remover chave"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={addApiKey} className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium text-sm rounded-lg flex items-center gap-2 transition-colors">
                        <Plus className="w-4 h-4" />
                        Adicionar outra chave
                      </button>
                    </div>
                    <p className="text-stone-500 text-xs mt-1">Múltiplas chaves permitem rotação automática e fallback em caso de rate limit (429) ou key inválida (401).</p>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-950/50 border border-amber-900/50">
                    <div className="flex items-center gap-2 text-amber-300 text-xs">
                      <ExternalLink className="w-4 h-4 shrink-0" />
                      <span>Obtenha sua key gratuita em <a href="https://build.nvidia.com" target="_blank" rel="noreferrer" className="underline hover:text-amber-100">build.nvidia.com</a> → My Account → API Keys</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced Config */}
              <details className="group">
                <summary className="flex items-center gap-2 cursor-pointer font-medium text-stone-400 hover:text-stone-200">
                  <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                  Configurações Avançadas (Worker & Executor)
                </summary>
                <div className="mt-4 space-y-4 pt-4 border-t border-stone-800">
                  <div>
                    <label className="block text-xs font-medium text-stone-400 mb-2">LLM_WORKER_SECRET</label>
                    <input
                      type="password"
                      value={workerSecret}
                      onChange={e => setWorkerSecret(e.target.value)}
                      placeholder="Secret para autenticação do worker"
                      className="w-full px-4 py-3 bg-stone-950 border border-stone-700 rounded-lg text-white placeholder-stone-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <p className="text-stone-500 text-xs mt-1">Deve ser idêntico no servidor e no worker (LLM_WORKER_SECRET)</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-400 mb-2">LLM_EXECUTOR_BASE_URL</label>
                    <input
                      type="text"
                      value={executorUrl}
                      onChange={e => setExecutorUrl(e.target.value)}
                      placeholder="https://seudominio.com"
                      className="w-full px-4 py-3 bg-stone-950 border border-stone-700 rounded-lg text-white placeholder-stone-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <p className="text-stone-500 text-xs mt-1">URL base do seu app para o worker fazer callbacks (ex: https://tuavia.com.br)</p>
                  </div>
                </div>
              </details>
            </div>
          )}

          {/* Step 3: Connection Test */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-white mb-1">Testar Conexão</h2>
                <p className="text-stone-400 text-sm">Verifique se as credenciais funcionam e veja os modelos disponíveis</p>
              </div>

              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="w-full sm:w-auto px-8 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-stone-700 disabled:cursor-not-allowed text-stone-950 font-bold rounded-xl flex items-center gap-2 justify-center transition-colors"
              >
                {testing ? <Loader2 className="w-5 h-5 animate-spin" /> : <TestTube2 className="w-5 h-5" />}
                {testing ? 'Testando...' : 'Testar Conexão'}
              </button>

              {Object.keys(testResults).length > 0 && (
                <div className="space-y-3">
                  {Object.entries(testResults).map(([key, result]) => (
                    <div key={key} className={cn('p-4 rounded-xl border', result.success ? 'border-emerald-500/30 bg-emerald-950/30' : 'border-rose-500/30 bg-rose-950/30')}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {result.success ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-rose-400" />
                          )}
                          <div>
                            <p className="font-bold text-white font-mono text-sm">
                              {isLocalNIM ? 'NIM Local' : key.slice(0, 12) + '...'}
                            </p>
                            <p className="text-stone-500 text-xs">
                              {result.success
                                ? `✅ Conectado · ${result.latency}ms · ${result.models?.length || 0} modelos`
                                : `❌ ${result.error}`}
                            </p>
                          </div>
                        </div>
                        {result.models && result.models.length > 0 && (
                          <details className="group">
                            <summary className="text-xs text-stone-400 hover:text-stone-200 cursor-pointer flex items-center gap-1">
                              Ver modelos ({result.models.length})
                              <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                            </summary>
                            <ul className="mt-2 space-y-1 text-[11px] font-mono text-stone-300">
                              {result.models.slice(0, 20).map(m => (
                                <li key={m} className="px-2 py-0.5 bg-stone-950 rounded">{m}</li>
                              ))}
                              {result.models.length > 20 && <li className="text-stone-500">... e mais {result.models.length - 20}</li>}
                            </ul>
                          </details>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {Object.keys(testResults).length > 0 && Object.values(testResults).some(r => r.success) && (
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Conexão bem-sucedida! Continue para selecionar os modelos.</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Models */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-white mb-1">Selecionar Modelos</h2>
                <p className="text-stone-400 text-sm">Escolha quais modelos ficarão disponíveis no painel (mínimo 1)</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(isLocalNIM ? LOCAL_NIM_MODELS : CLOUD_FREE_MODELS).map(model => {
                  const modelId = typeof model === 'string' ? model : model.id;
                  const modelName = typeof model === 'string' ? model : model.name;
                  const category = typeof model === 'string' ? 'local' : model.category;
                  const isMulti = typeof model === 'object' && model.multimodal;
                  const isSelected = selectedModels.includes(modelId);

                  const catColors: Record<string, string> = {
                    reasoning: 'bg-purple-950/50 text-purple-400 border-purple-500/30',
                    chat: 'bg-blue-950/50 text-blue-400 border-blue-500/30',
                    multimodal: 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30',
                    local: 'bg-stone-800 text-stone-300 border-stone-600',
                  };

                  return (
                    <label
                      key={modelId}
                      onClick={() => toggleModel(modelId)}
                      className={cn(
                        'p-4 rounded-xl border-2 transition-all cursor-pointer relative',
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20'
                          : 'border-stone-700 hover:border-stone-600 bg-stone-950/50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleModel(modelId)}
                        className="absolute top-3 right-3 w-5 h-5 accent-emerald-500"
                      />
                      <div className="flex items-start gap-3">
                        <div className={cn('px-2 py-0.5 rounded text-[9px] font-bold uppercase', catColors[category])}>
                          {category}
                        </div>
                        <div>
                          <p className="font-bold text-white">{modelName}</p>
                          <p className="text-stone-500 text-xs font-mono">{modelId}</p>
                          {isMulti && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 bg-emerald-950/50 text-emerald-300 text-[9px] font-bold rounded">Multimodal</span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="absolute inset-0 border-2 border-emerald-500/50 rounded-xl pointer-events-none" />
                      )}
                    </label>
                  );
                })}
              </div>

              {selectedModels.length === 0 && (
                <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-300 text-sm">
                  Selecione pelo menos um modelo para continuar.
                </div>
              )}
            </div>
          )}

          {/* Step 5: Complete */}
          {currentStep === 4 && (
            <div className="space-y-6 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white mb-2">Configuração Concluída!</h2>
                <p className="text-stone-400 max-w-xl mx-auto">
                  Sua conexão NVIDIA está pronta. Os modelos selecionados já estão disponíveis no Copiloto IA e no LLM Panel.
                </p>
              </div>

              {saved && (
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300">
                  <p className="font-medium">Configuração salva com sucesso no servidor!</p>
                  <p className="text-xs mt-1">As variáveis de ambiente foram atualizadas. O worker vai recarregar automaticamente.</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => router.push('/admin/ia')}
                  className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold rounded-xl transition-colors"
                >
                  Ir para o Copiloto IA
                </button>
                <button
                  onClick={() => router.push('/admin/ia?mode=llm_panel')}
                  className="px-8 py-3 bg-stone-800 hover:bg-stone-700 text-stone-100 font-bold rounded-xl border border-stone-600 transition-colors"
                >
                  Testar no LLM Panel
                </button>
              </div>

              <details className="group">
                <summary className="text-stone-500 hover:text-stone-300 text-sm cursor-pointer flex items-center justify-center gap-1">
                  Ver configuração salva
                  <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                </summary>
                <pre className="mt-4 p-4 bg-stone-950 border border-stone-800 rounded-lg text-[10px] font-mono text-stone-300 text-left overflow-x-auto max-h-64">
                  {JSON.stringify({
                    isLocalNIM,
                    baseUrl,
                    apiKeysCount: apiKeys.filter(k => k.trim()).length,
                    selectedModels,
                    hasWorkerSecret: !!workerSecret,
                    hasExecutorUrl: !!executorUrl,
                  }, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-stone-800 mt-8">
            <button
              onClick={goPrev}
              disabled={currentStep === 0}
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed text-stone-300 font-medium rounded-lg flex items-center gap-2 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </button>
            <div className="flex items-center gap-3">
              {currentStep === 3 && selectedModels.length > 0 && !saved && (
                <button
                  onClick={handleSaveConfig}
                  className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold rounded-xl flex items-center gap-2 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Salvar Configuração
                </button>
              )}
              {currentStep < STEPS.length - 1 && currentStep !== 3 && (
                <button
                  onClick={goNext}
                  disabled={currentStep === 1 && apiKeys.filter(k => k.trim()).length === 0}
                  className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-stone-700 disabled:cursor-not-allowed text-stone-950 font-bold rounded-xl flex items-center gap-2 transition-colors"
                >
                  Próximo
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}