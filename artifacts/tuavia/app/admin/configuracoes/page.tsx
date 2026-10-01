'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import AdminHeader from '@/components/admin/AdminHeader';
import { SiteSettings, DEFAULT_SITE_SETTINGS } from '@/types/settings';
import { fetchSiteSettingsFromFirestore, saveSiteSettingsToFirestore } from '@/lib/settings';
import {
  Settings,
  Save,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Layout,
  MessageSquare,
  HelpCircle,
  Compass
} from 'lucide-react';

export default function AdminConfiguracoesPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);

  const loadSettings = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSiteSettingsFromFirestore();
      setSettings(data);
    } catch (err) {
      console.error('Erro ao carregar configurações do site:', err);
      setStatusMsg({
        type: 'error',
        text: 'Não foi possível carregar as configurações do Firestore.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setCheckingAuth(false);
    loadSettings();
  }, [loadSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);

    try {
      const payload: SiteSettings = {
        ...settings,
        sidebarConfianca: settings.sidebarConfianca || (settings.sidebarConfiancaTitulo ? `${settings.sidebarConfiancaTitulo}: ${settings.sidebarConfiancaTexto || ''}` : DEFAULT_SITE_SETTINGS.sidebarConfianca),
        footerConfianca: settings.footerConfianca || settings.footerConfiancaTexto || DEFAULT_SITE_SETTINGS.footerConfianca,
      };

      await saveSiteSettingsToFirestore(payload, auth.currentUser?.email || undefined);
      setStatusMsg({
        type: 'success',
        text: 'Configurações do site salvas com sucesso no Firestore!',
      });
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);
      setStatusMsg({
        type: 'error',
        text: 'Erro ao salvar alterações no banco de dados.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Deseja restaurar todos os textos para os padrões originais?')) {
      setSettings(DEFAULT_SITE_SETTINGS);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
        <div className="flex items-center gap-3 bg-white p-6 rounded-2xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)]">
          <div className="w-6 h-6 border-3 border-stone-900 border-t-amber-500 rounded-full animate-spin" />
          <p className="font-bold text-stone-800 text-sm">Verificando autorização...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col" id="admin-configuracoes-page">
      <AdminHeader />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-stone-200">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-bold font-mono uppercase">
              <Settings className="w-3.5 h-3.5" />
              <span>Painel de Textos & Layout</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
              Configurações do Site
            </h1>
            <p className="text-stone-600 text-sm">
              Personalize títulos, descrições institucionais e blocos de confiança de todo o portal.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl border border-stone-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Padrões</span>
            </button>
          </div>
        </div>

        {/* Status Notification */}
        {statusMsg && (
          <div
            className={`my-6 p-4 rounded-xl border-2 flex items-start gap-3 text-sm font-bold shadow-[3px_3px_0px_0px_rgba(28,25,23,0.1)] ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-900 text-emerald-950'
                : 'bg-rose-50 border-rose-900 text-rose-950'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>{statusMsg.text}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-8 mt-6">
          
          {/* Seção 1: Hero Principal */}
          <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-stone-200">
              <Compass className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-black text-stone-900">Seção Principal (Hero da Home)</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                  Badge Superior (Etiqueta)
                </label>
                <input
                  type="text"
                  value={settings.heroBadge}
                  onChange={(e) => setSettings({ ...settings, heroBadge: e.target.value })}
                  placeholder="Portal de Mobilidade Elétrica"
                  className="w-full px-4 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-xl text-stone-900 font-medium text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                  Título Principal do Hero (H1)
                </label>
                <input
                  type="text"
                  value={settings.heroTitulo}
                  onChange={(e) => setSettings({ ...settings, heroTitulo: e.target.value })}
                  placeholder="Encontre a e-bike ideal..."
                  className="w-full px-4 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-xl text-stone-900 font-bold text-base focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                  Descrição do Hero
                </label>
                <textarea
                  rows={3}
                  value={settings.heroDescricao}
                  onChange={(e) => setSettings({ ...settings, heroDescricao: e.target.value })}
                  placeholder="Curadoria especializada e comparativos..."
                  className="w-full px-4 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-xl text-stone-900 font-medium text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Blocos de Confiança e Autoridade */}
          <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-stone-200">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-black text-stone-900">Blocos de Confiança & Rodapé</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Título do Box de Confiança (Sidebar)
                </label>
                <input
                  type="text"
                  value={settings.sidebarConfiancaTitulo}
                  onChange={(e) => setSettings({ ...settings, sidebarConfiancaTitulo: e.target.value })}
                  className="w-full px-4 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-xl text-stone-900 font-bold text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Texto do Box de Confiança (Sidebar)
                </label>
                <textarea
                  rows={2}
                  value={settings.sidebarConfiancaTexto}
                  onChange={(e) => setSettings({ ...settings, sidebarConfiancaTexto: e.target.value })}
                  className="w-full px-4 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-xl text-stone-900 font-medium text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="md:col-span-2 space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Texto Institucional do Rodapé (Footer)
                </label>
                <textarea
                  rows={2}
                  value={settings.footerConfiancaTexto}
                  onChange={(e) => setSettings({ ...settings, footerConfiancaTexto: e.target.value })}
                  className="w-full px-4 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-xl text-stone-900 font-medium text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Seção 3: Guia Rápido */}
          <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-stone-200">
              <HelpCircle className="w-5 h-5 text-sky-600" />
              <h2 className="text-base font-black text-stone-900">Seção Guia Rápido (Home)</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                  Título da Seção
                </label>
                <input
                  type="text"
                  value={settings.guiaRapidoTitulo}
                  onChange={(e) => setSettings({ ...settings, guiaRapidoTitulo: e.target.value })}
                  className="w-full px-4 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-xl text-stone-900 font-bold text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                  Subtítulo / Descrição
                </label>
                <input
                  type="text"
                  value={settings.guiaRapidoDescricao}
                  onChange={(e) => setSettings({ ...settings, guiaRapidoDescricao: e.target.value })}
                  className="w-full px-4 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-xl text-stone-900 font-medium text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Botão Salvar */}
          <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur border-2 border-stone-900 p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] flex items-center justify-between gap-4">
            <p className="text-xs text-stone-600 font-medium hidden sm:block">
              Alterações são salvas em tempo real no banco de dados Firestore.
            </p>
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-6 py-3 bg-stone-900 hover:bg-stone-800 text-amber-400 font-black text-sm rounded-xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_rgba(245,158,11,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ml-auto"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span>Salvando no Firestore...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Configurações</span>
                </>
              )}
            </button>
          </div>

        </form>
      </main>
    </div>
  );
}
