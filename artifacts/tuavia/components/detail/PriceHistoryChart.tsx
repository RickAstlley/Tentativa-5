'use client';

import React from 'react';
import { TrendingDown, Lightbulb, Info } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { EBikePriceHistoryPoint } from '@/types/ebike';
import { hasEnoughVerifiedHistory, getVerifiedPriceCount } from '@/lib/priceHistory';

interface PriceHistoryChartProps {
  priceHistory?: EBikePriceHistoryPoint[];
  data?: EBikePriceHistoryPoint[];
}

const CustomChartTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    const value = payload[0].value;
    const formattedPrice = value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    return (
      <div className="bg-stone-900 text-white p-3 rounded-xl border border-stone-700 shadow-xl font-mono text-xs">
        <p className="text-[10px] text-amber-400 uppercase font-black">{item.month || item.date || 'Registro'}</p>
        <p className="text-sm font-black text-emerald-400 mt-0.5">
          {formattedPrice}
        </p>
        {item.store && (
          <span className="text-[10px] text-stone-300 block mt-0.5 font-sans">
            Loja: {item.store}
          </span>
        )}
        {item.source && item.source !== 'simulado' && (
          <span className="text-[9px] text-stone-400 block mt-0.5 font-sans">
            Fonte: {item.source}
          </span>
        )}
        <span className="text-[9px] text-amber-300/80 block mt-1 font-sans">
          {item.verified ? '✓ Cotação verificada' : 'Estimativa de mercado em monitoramento'}
        </span>
      </div>
    );
  }
  return null;
};

export default function PriceHistoryChart({ priceHistory, data }: PriceHistoryChartProps) {
  const chartData = (priceHistory && priceHistory.length > 0)
    ? priceHistory
    : (data && data.length > 0)
    ? data
    : [];

  const verifiedCount = getVerifiedPriceCount(chartData);
  const isVerifiedSufficient = hasEnoughVerifiedHistory(chartData, 3);
  const pointCount = chartData.length;
  const isFullyVerified = pointCount > 0 && verifiedCount === pointCount;
  const isPartiallyVerified = verifiedCount > 0 && verifiedCount < pointCount;
  const isAllSimulated = pointCount > 0 && verifiedCount === 0;

  if (pointCount === 0) {
    return (
      <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[4px_4px_0_0_rgba(28,25,23,1)] flex flex-col gap-4">
        <div className="flex items-center gap-2.5 border-b-2 border-stone-100 pb-3">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-900 shrink-0 border border-amber-300">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-stone-900 uppercase tracking-wider">
              Histórico de Preços
            </h3>
            <p className="text-[11px] text-stone-500 font-medium">Monitoramento de cotações em lojas parceiras</p>
          </div>
        </div>

        <div className="p-4 bg-stone-50 border border-dashed border-stone-300 rounded-xl text-center text-xs font-mono text-stone-600">
          Histórico insuficiente para determinar a tendência de preço.
        </div>

        <div className="flex items-start gap-2.5 text-xs text-stone-800 bg-amber-50/70 border border-amber-300 rounded-xl p-3 leading-relaxed">
          <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span className="text-[11px] leading-tight">
            <strong>Inteligência de Mercado TuaVia:</strong> Histórico de preços insuficiente para confirmar o menor preço dos últimos meses.
          </span>
        </div>
      </div>
    );
  }

  // Cálculos analíticos estritamente baseados em pontos verificados quando disponíveis
  const verifiedPoints = chartData.filter((d) => d.verified === true && (d.source !== 'simulado'));
  const verifiedPrices = verifiedPoints.map((d) => d.price).filter((p) => p > 0);

  const minVerifiedPrice = verifiedPrices.length > 0 ? Math.min(...verifiedPrices) : 0;
  const maxVerifiedPrice = verifiedPrices.length > 0 ? Math.max(...verifiedPrices) : 0;

  // Preço atual e primeiro preço da série completa para exibição no gráfico
  const currentPrice = chartData[chartData.length - 1]?.price || 0;
  const firstPrice = chartData[0]?.price || currentPrice;
  const diffFromFirst = firstPrice > 0 ? Math.round(((currentPrice - firstPrice) / firstPrice) * 100) : 0;

  // Badge de "Menor Preço" SÓ é acionado se houver histórico verificado suficiente E o preço atual for <= min verificado
  const isLowest = isVerifiedSufficient && verifiedCount >= 3 && currentPrice <= minVerifiedPrice;

  const firstPoint = chartData[0];
  const lastPoint = chartData[chartData.length - 1];

  return (
    <div className="bg-white border-2 border-stone-900 rounded-2xl p-5 sm:p-6 shadow-[4px_4px_0_0_rgba(28,25,23,1)] flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-stone-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl shrink-0 border ${
            isAllSimulated
              ? 'bg-amber-100 text-amber-900 border-amber-300'
              : 'bg-emerald-100 text-emerald-900 border-emerald-300'
          }`}>
            <TrendingDown className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-black text-sm text-stone-900 uppercase tracking-wider">
              Histórico de Preços
            </h3>
            <p className="text-[11px] text-stone-500 font-medium">
              {isFullyVerified
                ? verifiedCount >= 3
                  ? `Série real auditada (${verifiedCount} meses registrados)`
                  : verifiedCount === 2
                  ? `Comparativo real (${firstPoint.month} → ${lastPoint.month})`
                  : `Cotação real atual registrada (${lastPoint.month})`
                : isPartiallyVerified
                ? `Histórico misto (${verifiedCount} de ${pointCount} meses confirmados)`
                : `Estimativa de mercado (${pointCount} meses em monitoramento sem cotação confirmada)`}
            </p>
          </div>
        </div>

        {isLowest ? (
          <span className="inline-flex items-center gap-1 bg-emerald-100 border-2 border-emerald-500 text-emerald-900 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(16,185,129,0.4)]">
            🔥 Menor Preço Histórico ({verifiedCount}m auditados)
          </span>
        ) : isAllSimulated ? (
          <span className="inline-flex items-center gap-1 bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
            📊 Estimativa de Mercado
          </span>
        ) : isPartiallyVerified ? (
          <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-300 text-blue-900 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
            🔍 {verifiedCount}/{pointCount} Cotações Reais
          </span>
        ) : verifiedCount < 3 ? (
          <span className="inline-flex items-center gap-1 bg-stone-100 border border-stone-300 text-stone-700 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
            📊 Histórico em Formação ({verifiedCount} {verifiedCount === 1 ? 'mês' : 'meses'})
          </span>
        ) : diffFromFirst < 0 ? (
          <span className="inline-flex items-center gap-1 bg-amber-100 border border-amber-400 text-amber-900 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
            📉 Queda de {Math.abs(diffFromFirst)}% no período
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 bg-stone-100 border border-stone-300 text-stone-700 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
            📊 Preço Estável
          </span>
        )}
      </div>

      {/* Gráfico Recharts adaptável */}
      {pointCount >= 2 ? (
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorPriceAdmin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isAllSimulated ? '#f59e0b' : '#10b981'} stopOpacity={0.25}/>
                  <stop offset="95%" stopColor={isAllSimulated ? '#f59e0b' : '#10b981'} stopOpacity={0.01}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis 
                dataKey="month" 
                tickLine={false} 
                axisLine={false}
                tick={{ fill: '#44403c', fontSize: 10, fontFamily: 'monospace', fontWeight: 700 }}
              />
              <YAxis 
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#78716c', fontSize: 9, fontFamily: 'monospace', fontWeight: 600 }}
                domain={['dataMin - 150', 'dataMax + 100']}
              />
              <Tooltip content={<CustomChartTooltip />} />
              <Area 
                type="monotone" 
                dataKey="price" 
                stroke={isAllSimulated ? '#d97706' : '#059669'} 
                strokeWidth={3}
                strokeDasharray={isAllSimulated ? '4 4' : undefined}
                dot={{ r: 4, fill: isAllSimulated ? '#d97706' : '#059669', strokeWidth: 1.5, stroke: '#ffffff' }}
                activeDot={{ r: 6, fill: '#f59e0b', stroke: '#1c1917', strokeWidth: 2 }}
                fillOpacity={1} 
                fill="url(#colorPriceAdmin)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        /* Caso com 1 ponto registrado */
        <div className={`p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 font-mono border-2 ${
          firstPoint.verified
            ? 'bg-emerald-50/70 border-emerald-900/20'
            : 'bg-amber-50/70 border-amber-900/20'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center font-black text-sm ${
              firstPoint.verified ? 'bg-emerald-600' : 'bg-amber-600'
            }`}>
              R$
            </div>
            <div>
              <span className={`text-[10px] font-black uppercase tracking-wider block ${
                firstPoint.verified ? 'text-emerald-900' : 'text-amber-900'
              }`}>
                {firstPoint.verified ? `Cotação Atual Registrada (${firstPoint.month})` : `Estimativa de Preço (${firstPoint.month})`}
              </span>
              <span className="text-base font-black text-stone-900">
                {currentPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
              {firstPoint.store && (
                <span className="text-[11px] text-stone-600 block font-sans">
                  Loja: <strong>{firstPoint.store}</strong>
                </span>
              )}
            </div>
          </div>
          <div className="text-right sm:text-right w-full sm:w-auto">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border ${
              firstPoint.verified
                ? 'text-emerald-800 bg-emerald-100 border-emerald-300'
                : 'text-amber-800 bg-amber-100 border-amber-300'
            }`}>
              {firstPoint.verified ? '✓ Cotação Auditada' : 'Estimativa em Monitoramento'}
            </span>
          </div>
        </div>
      )}

      <div className={`flex items-start gap-2.5 text-xs rounded-xl p-3 leading-relaxed border ${
        isAllSimulated
          ? 'bg-stone-50 border-stone-300 text-stone-700'
          : 'bg-amber-50/70 border-amber-300 text-stone-800'
      }`}>
        {isAllSimulated ? (
          <Info className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
        ) : (
          <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        )}
        <span className="text-[11px] leading-tight">
          <strong>Inteligência de Mercado TuaVia:</strong>{' '}
          {isAllSimulated ? (
            <>Curva de preços estimada por inteligência de mercado com base no valor de lançamento (R$ {currentPrice.toLocaleString('pt-BR')}). Cotações reais auditadas serão exibidas conforme o histórico for confirmado em lojas parceiras.</>
          ) : isPartiallyVerified ? (
            <>Exibindo {verifiedCount} cotação(ões) confirmada(s) de um total de {pointCount} meses mapeados. Preço verificado variando entre R$ {minVerifiedPrice.toLocaleString('pt-BR')} e R$ {maxVerifiedPrice.toLocaleString('pt-BR')}.</>
          ) : verifiedCount === 1 ? (
            <>Cotação real inicial de R$ {currentPrice.toLocaleString('pt-BR')} registrada em {firstPoint.month}{firstPoint.store ? ` na ${firstPoint.store}` : ''}. O gráfico traçará curvas históricas conforme novos meses forem auditados.</>
          ) : verifiedCount === 2 ? (
            <>Registros reais encontrados entre {firstPoint.month} (R$ {firstPrice.toLocaleString('pt-BR')}) e {lastPoint.month} (R$ {currentPrice.toLocaleString('pt-BR')}). {diffFromFirst < 0 ? `Variação de ${Math.abs(diffFromFirst)}% de queda no período.` : diffFromFirst > 0 ? `Variação de +${diffFromFirst}% no período.` : 'Preço estável entre os dois meses.'}</>
          ) : isLowest ? (
            <>Este é o menor preço registrado nos últimos {verifiedCount} meses auditados, com base em dados verificados (R$ {currentPrice.toLocaleString('pt-BR')}).</>
          ) : (
            <>Preço atual em R$ {currentPrice.toLocaleString('pt-BR')}, com variação histórica real entre R$ {minVerifiedPrice.toLocaleString('pt-BR')} e R$ {maxVerifiedPrice.toLocaleString('pt-BR')} ao longo de {verifiedCount} meses auditados.</>
          )}
        </span>
      </div>
    </div>
  );
}
