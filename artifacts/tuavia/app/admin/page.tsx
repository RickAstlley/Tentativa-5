'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs, getCountFromServer } from 'firebase/firestore';
import AdminHeader from '@/components/admin/layout/AdminHeader';
import AIRadarPanel from '@/components/admin/AIRadarPanel';
import CSMTelemetryPanel from '@/components/admin/CSMTelemetryPanel';
import { fetchArticlesFromFirestore } from '@/lib/articles';
import { fetchEBikesFromFirestore } from '@/lib/ebikes';
import { fetchAdminJson } from '@/lib/ai/clientResponse';
import SectionErrorBoundary from '@/components/ui/SectionErrorBoundary';
import { Card, Button } from '@/components/admin/ui';
import {
  Bike,
  FileText,
  Settings,
  PlusCircle,
  ArrowRight,
  Database,
  UploadCloud,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Trophy,
  Zap,
  Brain,
} from 'lucide-react';

interface QuickStat {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  href: string;
  iconColor: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const [bikesCount, setBikesCount] = useState<number | null>(null);
  const [articlesCount, setArticlesCount] = useState<number | null>(null);
  const [rankingsCount, setRankingsCount] = useState<number | null>(null);
  
  const [migrating, setMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [bikesCountSnap, articlesCountSnap, rankingsCountSnap] = await Promise.allSettled([
          getCountFromServer(collection(db, 'bikes')),
          getCountFromServer(collection(db, 'articles')),
          getCountFromServer(collection(db, 'rankings')),
        ]);

        if (bikesCountSnap.status === 'fulfilled') {
          setBikesCount(bikesCountSnap.value.data().count);
        } else {
          const bikesList = await fetchEBikesFromFirestore();
          setBikesCount(bikesList.length);
        }

        if (articlesCountSnap.status === 'fulfilled') {
          setArticlesCount(articlesCountSnap.value.data().count);
        } else {
          const articlesList = await fetchArticlesFromFirestore();
          setArticlesCount(articlesList.length);
        }

        if (rankingsCountSnap.status === 'fulfilled') {
          setRankingsCount(rankingsCountSnap.value.data().count);
        } else {
          try {
            const res = await fetch('/api/rankings?count=1');
            if (res.ok) {
              const data = await res.json();
              setRankingsCount(data.count || 0);
            } else {
              setRankingsCount(0);
            }
          } catch {
            setRankingsCount(0);
          }
        }
      } catch (e) {
        console.warn('Erro ao buscar contagens otimizadas:', e);
      }
    };

    loadCounts();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleRunMigration = async () => {
    setMigrating(true);
    setMigrationStatus('Executando sincronização com o Firestore...');
    try {
      const result = await fetchAdminJson<{ success: boolean; data: { bikesCount: number; articlesCount: number } }>('/api/admin/migrate', { method: 'POST' });
      if (result.ok && result.data?.data) {
        setMigrationStatus(`✅ Sincronização concluída! ${result.data.data.bikesCount} e-bikes e ${result.data.data.articlesCount} artigos atualizados.`);
        const bikesSnap = await getDocs(collection(db, 'bikes'));
        setBikesCount(bikesSnap.size);
      } else {
        setMigrationStatus(`❌ Erro: ${result.error || 'Falha na migração'}`);
      }
    } catch {
      setMigrationStatus('❌ Falha na conexão.');
    } finally {
      setMigrating(false);
    }
  };

  const quickStats: QuickStat[] = [
    { label: 'E-Bikes', value: bikesCount, icon: <Bike className="w-5 h-5" />, color: 'text-emerald-600', bgColor: 'bg-emerald-100', href: '/admin/bikes', iconColor: 'text-emerald-800' },
    { label: 'Artigos', value: articlesCount, icon: <FileText className="w-5 h-5" />, color: 'text-indigo-600', bgColor: 'bg-indigo-100', href: '/admin/artigos', iconColor: 'text-indigo-800' },
    { label: 'Rankings', value: rankingsCount, icon: <Trophy className="w-5 h-5" />, color: 'text-amber-600', bgColor: 'bg-amber-100', href: '/admin/rankings', iconColor: 'text-amber-800' },
    { label: 'Rascunhos IA', value: null, icon: <Brain className="w-5 h-5" />, color: 'text-purple-600', bgColor: 'bg-purple-100', href: '/admin/ia', iconColor: 'text-purple-800' },
  ];

  const primaryActions = [
    { label: 'Novo Artigo', href: '/admin/artigos/novo', icon: <PlusCircle className="w-4 h-4" />, variant: 'primary' as const, color: 'emerald' },
    { label: 'Novo Ranking', href: '/admin/rankings/novo', icon: <PlusCircle className="w-4 h-4" />, variant: 'primary' as const, color: 'amber' },
    { label: 'Nova Bike', href: '/admin/bikes/novo', icon: <PlusCircle className="w-4 h-4" />, variant: 'primary' as const, color: 'emerald' },
    { label: 'LLM Panel', href: '/admin/ia?mode=llm_panel', icon: <Zap className="w-4 h-4" />, variant: 'secondary' as const, color: 'stone' },
  ];

  const secondaryAreas = [
    { label: 'E-Bikes', href: '/admin/bikes', icon: <Bike className="w-6 h-6" />, description: 'Catálogo de modelos, especificações de bateria e motor, preços e links afiliados.', color: 'emerald', count: bikesCount, countLabel: 'bikes' },
    { label: 'Artigos', href: '/admin/artigos', icon: <FileText className="w-6 h-6" />, description: 'Publicação de guias de compra, análises, comparativos e notícias do setor com IA.', color: 'indigo', count: articlesCount, countLabel: 'posts' },
    { label: 'Rankings', href: '/admin/rankings', icon: <Trophy className="w-6 h-6" />, description: 'Montador de Top 3 a Top 10 de bikes, baterias, peças e kits com IA e links de afiliados.', color: 'amber', count: rankingsCount, countLabel: 'rankings' },
    { label: 'Copiloto IA', href: '/admin/ia', icon: <Sparkles className="w-6 h-6" />, description: 'Central de geração de artigos, fichas técnicas e otimização SEO com modelos NVIDIA NIM.', color: 'purple', count: null, countLabel: '' },
    { label: 'Radar Global', href: '/admin/radar-global', icon: <Brain className="w-6 h-6" />, description: 'Varredura de tendências e notícias do setor de e-bikes a cada 2 horas.', color: 'blue', count: null, countLabel: '' },
    { label: 'Configurações', href: '/admin/configuracoes', icon: <Settings className="w-6 h-6" />, description: 'Personalize textos da barra lateral, chamadas de confiança, rodapé e metadados institucionais.', color: 'stone', count: null, countLabel: '' },
  ];

  const colorClasses = {
    emerald: { bg: 'bg-emerald-100', icon: 'text-emerald-800', border: 'border-emerald-800', hover: 'hover:bg-emerald-500 hover:text-white', shadow: 'shadow-[2px_2px_0px_0px_rgba(16,185,129,1)]' },
    indigo: { bg: 'bg-indigo-100', icon: 'text-indigo-800', border: 'border-indigo-800', hover: 'hover:bg-indigo-500 hover:text-white', shadow: 'shadow-[2px_2px_0px_0px_rgba(99,102,241,1)]' },
    amber: { bg: 'bg-amber-100', icon: 'text-amber-900', border: 'border-amber-800', hover: 'hover:bg-amber-500 hover:text-white', shadow: 'shadow-[2px_2px_0px_0px_rgba(245,158,11,1)]' },
    purple: { bg: 'bg-purple-100', icon: 'text-purple-700', border: 'border-purple-800', hover: 'hover:bg-purple-500 hover:text-white', shadow: 'shadow-[2px_2px_0px_0px_rgba(168,85,247,1)]' },
    blue: { bg: 'bg-blue-100', icon: 'text-blue-800', border: 'border-blue-800', hover: 'hover:bg-blue-500 hover:text-white', shadow: 'shadow-[2px_2px_0px_0px_rgba(59,130,246,1)]' },
    stone: { bg: 'bg-stone-100', icon: 'text-stone-800', border: 'border-stone-900', hover: 'hover:bg-stone-900 hover:text-white', shadow: 'shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]' },
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <AdminHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-28 sm:pb-36 space-y-10">
        {/* Welcome Banner */}
        <Card variant="elevated" className="bg-white dark:bg-stone-900 border-2 border-stone-900 dark:border-stone-700">
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-400 font-bold text-xs rounded-full border border-emerald-300 dark:border-emerald-800/30 w-fit mb-4">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Painel Administrativo TuaVia
          </div>
          <h1 className="text-3xl font-black text-stone-900 dark:text-white tracking-tight">
            Bem-vindo(a), {user?.email ? user.email.split('@')[0] : 'Admin'}
          </h1>
          <p className="text-stone-600 dark:text-stone-400 text-sm mt-2 font-medium max-w-2xl">
            Selecione uma das áreas abaixo para gerenciar o catálogo de e-bikes, publicar novos artigos no blog ou alterar as configurações globais do portal.
          </p>
        </Card>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickStats.map((stat, i) => (
            <Card key={i} variant="default" padding="md" hover className="bg-white dark:bg-stone-900 border-2 border-stone-900 dark:border-stone-700 cursor-pointer transition-all hover:border-emerald-500/50" onClick={() => router.push(stat.href)}>
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bgColor} dark:${stat.bgColor.replace('100', '950/30')}`}>
                  <span className={stat.iconColor}>{stat.icon}</span>
                </div>
                <a href={stat.href} className="text-xs font-bold text-stone-500 hover:text-emerald-600">
                  Ver →
                </a>
              </div>
              <p className="text-2xl font-black text-stone-900 dark:text-white">{stat.value !== null ? stat.value : '—'}</p>
              <p className="text-stone-500 dark:text-stone-400 text-xs font-medium">{stat.label}</p>
            </Card>
          ))}
        </div>

        {/* Primary Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {primaryActions.map((action, i) => (
            <Button
              key={i}
              asChild
              variant={action.variant}
              size="lg"
              className="w-full justify-center gap-2"
            >
              <Link href={action.href} className="flex items-center justify-center gap-2 w-full">
                {action.icon}
                <span>{action.label}</span>
              </Link>
            </Button>
          ))}
        </div>

        {/* Secondary Areas Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {secondaryAreas.map((area, i) => {
            const colors = colorClasses[area.color as keyof typeof colorClasses];
            return (
              <Link key={i} href={area.href} className="block group">
                <Card variant="default" padding="lg" hover className="bg-white dark:bg-stone-900 border-2 border-stone-900 dark:border-stone-700 transition-all hover:border-emerald-500/50">
                  <div className={`w-14 h-14 ${colors.bg} dark:${colors.bg.replace('100', '950/30')} ${colors.border} dark:border-${colors.border.replace('800', '800/30')} rounded-xl flex items-center justify-center mb-4 ${colors.shadow} ${colors.icon} dark:text-emerald-400 group-hover:scale-105 transition-all`}>
                    {area.icon}
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-black text-stone-900 dark:text-white group-hover:text-amber-500 transition-colors">{area.label}</h2>
                    {area.count !== null && (
                      <span className="text-[11px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 px-2 py-0.5 rounded-full border border-stone-300 dark:border-stone-700">
                        {area.count} {area.countLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-stone-600 dark:text-stone-400 text-xs font-medium leading-relaxed mb-4">
                    {area.description}
                  </p>
                  <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
                    <span className="text-xs font-bold text-stone-500 hover:text-emerald-600 transition-colors flex items-center gap-1">
                      Acessar <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* AI Activity Section */}
        <Card variant="default" padding="lg" className="bg-white dark:bg-stone-900 border-2 border-stone-900 dark:border-stone-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-black text-stone-900 dark:text-white">Atividade IA Recente</h3>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/ia?mode=telemetry">Ver Telemetria →</Link>
            </Button>
          </div>
          <SectionErrorBoundary sectionName="Radar IA Panel">
            <AIRadarPanel />
          </SectionErrorBoundary>
        </Card>

        <SectionErrorBoundary sectionName="CSM Telemetry Panel">
          <CSMTelemetryPanel />
        </SectionErrorBoundary>

        {/* Sync Tool */}
        <Card variant="outlined" padding="lg" className="bg-stone-50 dark:bg-stone-900/50 border-2 border-stone-900 dark:border-stone-700">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white dark:bg-stone-800 border-2 border-stone-900 dark:border-stone-700 rounded-xl flex items-center justify-center text-stone-900 dark:text-white shrink-0">
                <Database className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-stone-900 dark:text-white flex items-center gap-2">
                  Sincronização de Banco de Dados
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </h3>
                <p className="text-stone-600 dark:text-stone-400 text-xs mt-0.5 font-medium">
                  Recarregue os dados estáticos padrões do repositório para o Firestore.
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="lg"
              onClick={handleRunMigration}
              disabled={migrating}
              className="shrink-0"
            >
              {migrating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5 text-stone-700 dark:text-stone-300" />
                  Sincronizar Firestore
                </>
              )}
            </Button>
          </div>

          {migrationStatus && (
            <div className="mt-4 p-4 bg-white dark:bg-stone-900 border-2 border-stone-900 dark:border-stone-700 rounded-xl text-stone-900 dark:text-white text-xs font-bold">
              {migrationStatus}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}