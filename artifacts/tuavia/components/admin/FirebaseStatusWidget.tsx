'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Database, CheckCircle2, AlertCircle, RefreshCw, Layers, ShieldAlert, Key } from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase';
import { fetchAdminJson } from '@/lib/apiResponse';

interface FirebaseReport {
  success: boolean;
  connected: boolean;
  databaseExists?: boolean;
  permissionDenied?: boolean;
  quotaExhausted?: boolean;
  isRealConfigured?: boolean;
  firestoreConsoleUrl?: string;
  loadedFiles?: string[];
  message: string;
  errorDetails?: string;
  envCheck?: Record<string, boolean | string>;
  totalDocsFound?: number;
  collections?: Record<string, { count: number; docs: Array<{ id: string; title?: string }> }>;
}

interface SyncStatus {
  lastSync?: string;
  intervalMinutes?: number;
  syncedArticlesCount?: number;
  syncedBikesCount?: number;
  syncedRankingsCount?: number;
  savedToDiskArticlesCount?: number;
  savedToDiskBikesCount?: number;
  savedToDiskRankingsCount?: number;
  uploadedToFirestoreArticlesCount?: number;
  uploadedToFirestoreBikesCount?: number;
  totalDiskArticles?: number;
  totalDiskBikes?: number;
  totalDiskRankings?: number;
  missingArticlesCount?: number;
  missingBikesCount?: number;
  status?: string;
  message?: string;
}

export default function FirebaseStatusWidget({ onSyncComplete }: { onSyncComplete?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<FirebaseReport | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const checkStatus = useCallback(async (isManual = false) => {
    setLoading(true);
    try {
      // As duas APIs são independentes; executá-las em paralelo evita esperar o dobro
      // quando o Firestore ou o proxy da hospedagem estiverem lentos.
      const [result, syncRes] = await Promise.all([
        fetchAdminJson<FirebaseReport>('/api/admin/firebase-status', { cache: 'no-store' }),
        fetchAdminJson<{ success: boolean; syncStatus: SyncStatus }>('/api/admin/sync-firestore', { cache: 'no-store' }),
      ]);

      if (result.ok && result.data) {
        setReport(result.data);
      } else {
        setReport({
          success: false,
          connected: false,
          message: result.error || 'Falha ao obter status do Firebase.',
        });
      }

      if (syncRes.ok && syncRes.data?.syncStatus) {
        setSyncStatus(syncRes.data.syncStatus);
      }

      if (isManual && onSyncComplete) {
        onSyncComplete();
      }
    } catch {
      setReport({
        success: false,
        connected: false,
        message: 'Não foi possível contatar o servidor para verificar a conexão do Firebase.',
      });
    } finally {
      setLoading(false);
    }
  }, [onSyncComplete]);

  const handleManualSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetchAdminJson<{ success: boolean; message?: string; syncStatus?: SyncStatus }>(
        '/api/admin/sync-firestore',
        { method: 'POST' }
      );
      if (res.ok && res.data) {
        if (res.data.syncStatus) setSyncStatus(res.data.syncStatus);
        setSyncMessage(res.data.syncStatus?.message || res.data.message || 'Sincronização 30min concluída!');
        if (onSyncComplete) onSyncComplete();
      } else {
        setSyncMessage(res.error || 'Falha ao sincronizar dados.');
      }
    } catch (err: any) {
      setSyncMessage(`Erro ao chamar sincronização: ${err?.message || err}`);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    checkStatus(false);
    return () => {
      mounted = false;
    };
  }, [checkStatus]);

  const isClientConfigured = isFirebaseConfigured;
  const isServerConnected = report?.connected;

  return (
    <div className="bg-white border-2 border-stone-900 rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl border-2 border-stone-900 flex items-center justify-center shrink-0 ${
            isServerConnected || isClientConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}>
            <Database className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-black text-sm text-stone-900">
                Conexão com Firebase Firestore & Disco Hostinger
              </h3>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                isServerConnected
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  : 'bg-amber-100 text-amber-900 border-amber-300'
              }`}>
                {isServerConnected ? 'Conectado (Admin SDK)' : isClientConfigured ? 'Parcial (Client SDK)' : 'Modo Fallback / Disco Hostinger'}
              </span>
            </div>
            <p className="text-stone-600 text-xs font-medium">
              {report?.message || 'Verificando sincronização bidirecional Firestore ⇄ Disco Hostinger...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleManualSync}
            disabled={syncing}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-bold text-xs rounded-xl border border-stone-900 flex items-center gap-1.5 transition-all shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] cursor-pointer disabled:opacity-60"
            title="Executa agora a sincronização bidirecional completa entre Firebase e o disco da Hostinger"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Sincronizando...' : 'Sincronizar Firebase ⇄ Disco (30min)'}</span>
          </button>

          <button
            type="button"
            onClick={() => checkStatus(true)}
            disabled={loading}
            className="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white font-mono font-bold text-xs rounded-xl border border-stone-900 flex items-center gap-1.5 transition-all shadow-[2px_2px_0px_0px_rgba(99,102,241,1)] cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Verificando...' : 'Reverificar'}</span>
          </button>

          <button
            type="button"
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-900 font-mono font-bold text-xs rounded-xl border border-stone-300 transition-colors cursor-pointer"
          >
            {detailsOpen ? 'Ocultar Detalhes' : 'Diagnóstico'}
          </button>
        </div>
      </div>

      {/* BANNER STATUS DE SINCRONIZAÇÃO AUTOMÁTICA DE 30 MINUTOS */}
      <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse shrink-0"></span>
          <div>
            <span className="font-bold text-stone-900">Sincronização Automática Firebase ⇄ Disco Hostinger (a cada 30min):</span>
            <span className="text-stone-600 ml-1">
              {syncStatus?.lastSync
                ? `Última sincronização: ${new Date(syncStatus.lastSync).toLocaleString('pt-BR')}`
                : 'Pendente ou primeira execução em andamento.'}
            </span>
          </div>
        </div>

        {syncStatus?.message && (
          <span className="text-[11px] font-mono text-stone-700 bg-white px-2 py-1 border border-stone-200 rounded-lg">
            {syncStatus.message}
          </span>
        )}
      </div>

      {syncMessage && (
        <div className="p-2.5 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-mono">
          {syncMessage}
        </div>
      )}

      {/* Detalhes de Diagnóstico Expansíveis */}
      {detailsOpen && (
        <div className="mt-2 pt-3 border-t-2 border-dashed border-stone-200 flex flex-col gap-3 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5">
              <div className="font-bold text-stone-900 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-600" />
                <span>Variáveis de Ambiente:</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-stone-600">NEXT_PUBLIC_FIREBASE_API_KEY:</span>
                  <span className={report?.envCheck?.NEXT_PUBLIC_FIREBASE_API_KEY ? 'text-emerald-700 font-bold' : 'text-rose-600'}>
                    {report?.envCheck?.NEXT_PUBLIC_FIREBASE_API_KEY ? '✓ Definida' : '✗ Ausente'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">NEXT_PUBLIC_FIREBASE_PROJECT_ID:</span>
                  <span className={report?.envCheck?.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'text-emerald-700 font-bold' : 'text-rose-600'}>
                    {report?.envCheck?.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✓ Definida' : '✗ Ausente'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">FIREBASE_ADMIN_SERVICE_ACCOUNT:</span>
                  <span className={
                    report?.envCheck?.FIREBASE_ADMIN_SERVICE_ACCOUNT_VALID
                      ? 'text-emerald-700 font-bold'
                      : report?.envCheck?.FIREBASE_ADMIN_SERVICE_ACCOUNT
                      ? 'text-amber-600 font-bold'
                      : 'text-stone-500'
                  }>
                    {report?.envCheck?.FIREBASE_ADMIN_SERVICE_ACCOUNT_VALID
                      ? '✓ Válida'
                      : report?.envCheck?.FIREBASE_ADMIN_SERVICE_ACCOUNT
                      ? '⚠ JSON Inválido'
                      : 'Não configurada'}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-stone-200 text-[10px] text-stone-500">
                  <span>Arquivos .env lidos no servidor: </span>
                  <strong className="text-stone-800">
                    {report?.loadedFiles && report.loadedFiles.length > 0
                      ? report.loadedFiles.map(f => f.split('/').pop()).join(', ')
                      : 'Nenhum .env detectado no disco'}
                  </strong>
                </div>
              </div>
            </div>

            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5">
              <div className="font-bold text-stone-900 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Coleções Pesquisadas:</span>
              </div>
              <div className="space-y-1 text-[11px]">
                {report?.collections ? (
                  Object.entries(report.collections).map(([col, data]) => (
                    <div key={col} className="flex justify-between">
                      <span className="text-stone-600">/{col}:</span>
                      <span className={data.count > 0 ? 'text-emerald-700 font-bold' : 'text-stone-500'}>
                        {data.count >= 0 ? `${data.count} docs` : 'indisponível'}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-stone-500">Nenhum dado retornado</span>
                )}
              </div>
            </div>
          </div>

          {report?.databaseExists === false && (
            <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-xl text-amber-950 flex flex-col gap-2 text-xs">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-900 text-sm font-bold block">
                    Atenção: Banco Cloud Firestore (default) ainda não foi criado no console
                  </strong>
                  <p className="mt-1 text-amber-800 leading-relaxed font-sans">
                    As credenciais do projeto estão configuradas, mas o banco de dados Cloud Firestore ainda não foi inicializado no Google Firebase Console para este projeto.
                  </p>
                </div>
              </div>
              <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 text-[11px] font-mono text-stone-700 space-y-1">
                <div className="font-bold text-stone-900 font-sans">Passo a passo para ativar:</div>
                <div>1. Acesse o console do Firebase: <a href={report.firestoreConsoleUrl || 'https://console.firebase.google.com'} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-bold">{report.firestoreConsoleUrl || 'Firebase Console'}</a></div>
                <div>2. Clique no botão <strong>&ldquo;Criar banco de dados&rdquo; / &ldquo;Create database&rdquo;</strong>.</div>
                <div>3. Selecione o modo (Produção ou Teste) e a localização (ex: <code>southamerica-east1</code>).</div>
                <div>4. Após criado, clique em <strong>&ldquo;Reverificar&rdquo;</strong> acima.</div>
              </div>
            </div>
          )}

          {report?.permissionDenied && (
            <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-950 flex flex-col gap-2 text-xs">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-rose-900 text-sm font-bold block">
                    Permissão Negada no Firestore (PERMISSION_DENIED)
                  </strong>
                  <p className="mt-1 text-rose-800 leading-relaxed font-sans">
                    A conta de serviço (Service Account) utilizada não possui permissão para ler ou escrever no Cloud Firestore deste projeto.
                  </p>
                </div>
              </div>
              <div className="bg-white/80 p-2.5 rounded-lg border border-rose-200 text-[11px] font-mono text-stone-700 space-y-1">
                <div className="font-bold text-stone-900 font-sans">Como resolver:</div>
                <div>1. Acesse o <a href="https://console.cloud.google.com/iam-admin/iam" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-bold">Google Cloud IAM Console</a>.</div>
                <div>2. Localize o e-mail da sua Service Account (ex: <code>firebase-adminsdk-...@...iam.gserviceaccount.com</code>).</div>
                <div>3. Atribua o papel (Role): <strong>&ldquo;Usuário do Cloud Datastore&rdquo; (Cloud Datastore User)</strong> ou <strong>&ldquo;Administrador do Firebase&rdquo;</strong>.</div>
              </div>
            </div>
          )}

          {(!report?.envCheck?.FIREBASE_ADMIN_SERVICE_ACCOUNT_VALID && !report?.permissionDenied && report?.databaseExists !== false) && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-950 flex flex-col gap-2 text-xs">
              <div className="flex items-start gap-2">
                <Key className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-indigo-950 text-xs font-bold block">
                    Como ativar leitura e escrita total do servidor (Service Account):
                  </strong>
                  <p className="mt-0.5 text-indigo-900 leading-relaxed font-sans">
                    No painel do Firebase: vá em <em>Configurações do Projeto &gt; Contas de Serviço &gt; Gerar nova chave privada</em>. Baixe o arquivo <code>.json</code> e salve-o como <code>serviceAccountKey.json</code> na pasta raiz do site na Hostinger, ou cole seu conteúdo na variável <code>FIREBASE_ADMIN_SERVICE_ACCOUNT</code>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {(!isServerConnected && !isClientConfigured && report?.databaseExists !== false && !report?.permissionDenied) && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2 text-xs">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Como conectar ao seu Firebase real:</strong>
                <p className="mt-0.5 text-amber-800">
                  Adicione as credenciais do seu projeto Firebase (<code>NEXT_PUBLIC_FIREBASE_API_KEY</code>, <code>NEXT_PUBLIC_FIREBASE_PROJECT_ID</code>, etc.) no arquivo <code>.env</code> ou nas variáveis de ambiente do hPanel da Hostinger para que as publicações cadastradas no console do Firebase sejam lidas e sincronizadas automaticamente.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
