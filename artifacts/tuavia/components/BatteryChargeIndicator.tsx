'use client';

import React from 'react';
import { Tag } from 'lucide-react';

interface BatteryChargeIndicatorProps {
  price: number;
  minPrice: number;
  maxPrice: number;
  showLabel?: boolean;
}

export default function BatteryChargeIndicator({
  price,
  minPrice,
  maxPrice,
  showLabel = true,
}: BatteryChargeIndicatorProps) {
  // Se houver apenas uma oferta ou se o maior e menor preço forem iguais, a vantagem é de 100%
  const hasRange = maxPrice > minPrice;
  
  let percentage = 100;
  if (hasRange) {
    // Menor preço (melhor) = 100% de vantagem de oferta
    // Maior preço (pior) = 20% de vantagem
    const factor = (price - minPrice) / (maxPrice - minPrice);
    percentage = Math.round(100 - (factor * 80));
  }

  // Nível do Índice de Oferta (Vantagem de Preço)
  let barColorClass = 'bg-accent-verde';
  let textColorClass = 'text-accent-verde bg-accent-verde/15 border-accent-verde/30';
  let ratingLabel = 'Melhor Oferta do Dia';

  if (percentage >= 90) {
    barColorClass = 'bg-accent-verde';
    textColorClass = 'text-accent-verde bg-accent-verde/15 border-accent-verde/30';
    ratingLabel = 'Melhor Oferta';
  } else if (percentage >= 70) {
    barColorClass = 'bg-teal-600';
    textColorClass = 'text-teal-700 bg-teal-50 border-teal-200';
    ratingLabel = 'Preço Competitivo';
  } else if (percentage >= 50) {
    barColorClass = 'bg-amber-500';
    textColorClass = 'text-amber-800 bg-amber-50 border-amber-200';
    ratingLabel = 'Preço Médio';
  } else {
    barColorClass = 'bg-orange-500';
    textColorClass = 'text-orange-800 bg-orange-50 border-orange-200';
    ratingLabel = 'Preço Elevado';
  }

  const segmentCount = 5;
  const activeSegments = Math.max(1, Math.round((percentage / 100) * segmentCount));

  return (
    <div className="flex flex-col gap-1 select-none" id={`offer-index-indicator-${price}`}>
      <div className="flex items-center gap-2">
        {/* Marcador de Nível de Preço (Índice de Oferta) */}
        <div className="relative flex items-center" title={`Índice de Oferta: ${percentage}%`}>
          <div className="w-12 h-3.5 sm:w-16 sm:h-4 border border-ink/20 rounded-[4px] px-0.5 py-0.5 flex gap-0.5 bg-bg-base">
            {Array.from({ length: segmentCount }).map((_, i) => {
              const isActive = i < activeSegments;
              return (
                <div
                  key={i}
                  className={`h-full flex-1 rounded-[1px] transition-all duration-300 ${
                    isActive ? barColorClass : 'bg-line/30'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Badge do Nível de Oferta */}
        {showLabel && (
          <div className={`px-2 py-0.5 text-[10px] font-mono font-extrabold rounded-[4px] border ${textColorClass} flex items-center gap-1 shrink-0`}>
            <Tag className="w-2.5 h-2.5" />
            <span>{ratingLabel}</span>
          </div>
        )}
      </div>
      
      {showLabel && (
        <span className="text-[10px] font-mono text-ink/60 text-right">
          Índice: {percentage}%
        </span>
      )}
    </div>
  );
}


