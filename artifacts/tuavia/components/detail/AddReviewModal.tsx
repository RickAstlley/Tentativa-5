'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Star, 
  Sparkles, 
  Send, 
  ShieldCheck, 
  BatteryCharging, 
  Gauge, 
  Check, 
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Info
} from 'lucide-react';
import { EBikeReview } from '@/types/ebike';

interface AddReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  bikeSlug: string;
  bikeModelo: string;
  advertisedRangeKm?: number;
  onReviewAdded: (newReview: EBikeReview) => void;
}

const QUICK_PROS = [
  '🔋 Bateria duradoura no plano',
  '⚡ Bom torque nas subidas',
  '🛋️ Posição de pilotagem ereta',
  '🚲 Muito silenciosa',
  '🛠️ Peças fáceis de repor',
  '💡 Farol dianteiro bem forte'
];

const QUICK_CONS = [
  '🛑 Freio mecânico pesado',
  '⚖️ Pesada para carregar na mão',
  '📉 Bateria descarrega rápido no Turbo',
  '🌧️ Para-lama curto na chuva',
  '🔌 Recarga um pouco lenta',
  '🧱 Suspensão dianteira dura'
];

export default function AddReviewModal({
  isOpen,
  onClose,
  bikeSlug,
  bikeModelo,
  advertisedRangeKm = 45,
  onReviewAdded,
}: AddReviewModalProps) {
  const [author, setAuthor] = useState('');
  const [city, setCity] = useState('');
  const [userWeightKg, setUserWeightKg] = useState('75');
  const [usageProfile, setUsageProfile] = useState('Uso urbano diário para trabalho');
  const [terrain, setTerrain] = useState<'plano' | 'misto' | 'íngreme'>('misto');
  const [assistanceModeUsed, setAssistanceModeUsed] = useState('Níveis 2 e 3 (assistência média)');
  
  // Slider + Input sincronizados para autonomia real
  const defaultInitialKm = Math.round(advertisedRangeKm * 0.78);
  const [realRangeKm, setRealRangeKm] = useState(String(defaultInitialKm));
  const [timeUsing, setTimeUsing] = useState('Uso há 6 meses');
  
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [criteria, setCriteria] = useState({
    batteryAutonomy: 4,
    motorPower: 5,
    comfort: 4,
    reliability: 5,
  });
  
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [selectedPros, setSelectedPros] = useState<string[]>([]);
  const [selectedCons, setSelectedCons] = useState<string[]>([]);
  
  // Proteção anti-bot (Honeypot)
  const [honeypot, setHoneypot] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Trava o scroll da página enquanto o modal estiver aberto e escuta tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Cálculo instantâneo da diferença em relação ao anunciado
  const numericRealRange = Number(realRangeKm) || defaultInitialKm;
  const rangeRatio = Math.round((numericRealRange / advertisedRangeKm) * 100);
  const rangeDelta = numericRealRange - advertisedRangeKm;

  // Classificação do feedback de autonomia
  const rangeFeedback = useMemo(() => {
    if (rangeRatio >= 90) {
      return {
        label: 'Excelente rendimento! Quase igual ou superior ao catálogo.',
        color: 'text-emerald-800 bg-emerald-100 border-emerald-300',
      };
    }
    if (rangeRatio >= 70) {
      return {
        label: 'Consumo normal e realista para trânsito urbano com paradas.',
        color: 'text-amber-800 bg-amber-100 border-amber-300',
      };
    }
    return {
      label: 'Consumo acelerado (provável uso intenso em subidas ou modo Turbo).',
      color: 'text-rose-800 bg-rose-100 border-rose-300',
    };
  }, [rangeRatio]);

  if (!isOpen) return null;

  const togglePro = (pro: string) => {
    setSelectedPros(prev => 
      prev.includes(pro) ? prev.filter(p => p !== pro) : [...prev, pro]
    );
  };

  const toggleCon = (con: string) => {
    setSelectedCons(prev => 
      prev.includes(con) ? prev.filter(c => c !== con) : [...prev, con]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Evita duplo clique
    setErrorMsg(null);

    // Validações de frontend amigáveis
    if (!author.trim()) {
      setErrorMsg('Por favor, informe seu nome ou apelido para assinar a avaliação.');
      return;
    }

    const parsedKm = Number(realRangeKm);
    if (isNaN(parsedKm) || parsedKm < 5 || parsedKm > 250) {
      setErrorMsg('Por favor, informe uma autonomia real entre 5 km e 250 km.');
      return;
    }

    if (!title.trim()) {
      setErrorMsg('Adicione um título resumindo sua experiência de pedalada.');
      return;
    }

    if (!comment.trim() || comment.trim().length < 20) {
      setErrorMsg('Por favor, conte um pouco mais no relato (mínimo de 20 caracteres para ajudar outros ciclistas).');
      return;
    }

    // Monta o comentário com os prós e contras selecionados se houver
    let fullComment = comment.trim();
    if (selectedPros.length > 0 || selectedCons.length > 0) {
      fullComment += '\n\n';
      if (selectedPros.length > 0) {
        fullComment += `Pontos Fortes: ${selectedPros.join(', ')}.\n`;
      }
      if (selectedCons.length > 0) {
        fullComment += `Pontos a Melhorar: ${selectedCons.join(', ')}.`;
      }
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bikeSlug,
          author: author.trim(),
          city: city.trim() || 'Brasil',
          userWeightKg: Number(userWeightKg) || 75,
          usageProfile: usageProfile.trim(),
          terrain,
          assistanceModeUsed: assistanceModeUsed.trim(),
          realRangeKm: parsedKm,
          advertisedRangeKm,
          rating,
          criteria,
          title: title.trim(),
          comment: fullComment,
          timeUsing: timeUsing.trim(),
          honeypot,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao salvar sua avaliação.');
      }

      setSuccessMsg('Avaliação auditada e registrada com sucesso! Muito obrigado pelo relato.');
      onReviewAdded(data.review);

      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocorreu um erro ao enviar sua avaliação. Tente novamente.');
      setIsSubmitting(false);
    }
  };

  const getRatingLabel = (stars: number) => {
    switch (stars) {
      case 1: return '1 estrela - Decepcionante';
      case 2: return '2 estrelas - Abaixo do esperado';
      case 3: return '3 estrelas - Razoável / Mediana';
      case 4: return '4 estrelas - Muito boa';
      case 5: return '5 estrelas - Excelente / Superou expectativas';
      default: return '';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-review-title"
    >
      <div className="relative w-full max-w-2xl bg-white border-2 border-stone-900 rounded-3xl shadow-[8px_8px_0px_0px_rgba(28,25,23,1)] overflow-hidden my-6">
        {/* Cabeçalho do Modal */}
        <div className="bg-amber-400 border-b-2 border-stone-900 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-white border-2 border-stone-900 rounded-xl text-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]">
              <Sparkles className="w-4 h-4 text-stone-900" />
            </div>
            <div>
              <h3 id="modal-review-title" className="font-black text-base sm:text-lg text-stone-900 uppercase tracking-tight">
                Avaliar Autonomia &amp; Experiência Real
              </h3>
              <p className="text-xs font-bold text-stone-800">
                Modelo: {bikeModelo} • Promessa de Fábrica: {advertisedRangeKm} km
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar formulário de avaliação"
            className="p-2 bg-white hover:bg-stone-100 border-2 border-stone-900 rounded-xl text-stone-900 transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] active:translate-x-[1px] active:translate-y-[1px]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário com Scroll Suave */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 bg-rose-100 border-2 border-rose-500 rounded-xl text-xs font-bold text-rose-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-100 border-2 border-emerald-500 rounded-xl text-xs font-black text-emerald-950 flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Honeypot invisível anti-spam */}
          <input
            type="text"
            name="website_security_hp"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
          />

          {/* BLOCO 1: Autonomia Real Medida (O Coração da Comunidade) */}
          <div className="bg-emerald-50/80 border-2 border-emerald-900 rounded-2xl p-4 sm:p-5 space-y-4 shadow-[3px_3px_0px_0px_rgba(16,185,129,1)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
                  <BatteryCharging className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black uppercase text-emerald-950">
                    Sua Autonomia Real Medida (km por carga)
                  </h4>
                  <span className="text-[11px] text-emerald-800 font-medium">
                    Quantos quilômetros ela roda até a bateria esgotar no seu dia a dia?
                  </span>
                </div>
              </div>
            </div>

            {/* Slider + Campo Numérico Sincronizados */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-8 space-y-1.5">
                <input
                  type="range"
                  min="5"
                  max="160"
                  step="1"
                  value={realRangeKm}
                  onChange={(e) => setRealRangeKm(e.target.value)}
                  className="w-full accent-emerald-600 cursor-pointer h-2 bg-emerald-200 rounded-lg"
                />
                <div className="flex justify-between text-[10px] font-mono font-bold text-emerald-900">
                  <span>5 km</span>
                  <span>Catálogo: {advertisedRangeKm} km</span>
                  <span>160 km</span>
                </div>
              </div>

              <div className="sm:col-span-4">
                <div className="relative">
                  <input
                    type="number"
                    min="5"
                    max="250"
                    step="1"
                    required
                    value={realRangeKm}
                    onChange={(e) => setRealRangeKm(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 bg-white border-2 border-stone-900 rounded-xl text-lg font-black font-mono text-stone-900 focus:outline-hidden shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-600">
                    km
                  </span>
                </div>
              </div>
            </div>

            {/* Comparativo Instantâneo Dinâmico */}
            <div className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${rangeFeedback.color}`}>
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 shrink-0" />
                <span>
                  Sua medição representa <strong>{rangeRatio}%</strong> da promessa da fábrica ({rangeDelta >= 0 ? `+${rangeDelta}` : rangeDelta} km vs catálogo).
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase font-black px-2 py-0.5 rounded bg-white/70 border border-current shrink-0">
                {rangeRatio}%
              </span>
            </div>

            {/* Condições de Teste: Relevo, Peso e Modo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-emerald-200">
              <div>
                <label className="block text-[10px] font-black uppercase text-emerald-950 mb-1">
                  Relevo do Seu Trajeto *
                </label>
                <select
                  value={terrain}
                  onChange={(e) => setTerrain(e.target.value as any)}
                  className="w-full px-2.5 py-2 bg-white border-2 border-stone-900 rounded-xl text-xs font-bold text-stone-900 focus:outline-hidden shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]"
                >
                  <option value="plano">100% Plano / Orla</option>
                  <option value="misto">Misto (retas e ladeiras)</option>
                  <option value="íngreme">Muitas Ladeiras Íngremes</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-emerald-950 mb-1">
                  Seu Peso com Mochila (kg)
                </label>
                <input
                  type="number"
                  min="35"
                  max="200"
                  step="1"
                  value={userWeightKg}
                  onChange={(e) => setUserWeightKg(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-stone-900 rounded-xl text-xs font-mono font-bold text-stone-900 focus:outline-hidden shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-emerald-950 mb-1">
                  Modo de Assistência
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={assistanceModeUsed}
                  onChange={(e) => setAssistanceModeUsed(e.target.value)}
                  placeholder="Ex: Nível 2 e 3"
                  className="w-full px-3 py-2 bg-white border-2 border-stone-900 rounded-xl text-xs font-medium text-stone-900 focus:outline-hidden shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]"
                />
              </div>
            </div>
          </div>

          {/* BLOCO 2: Avaliação em Estrelas e Subcritérios */}
          <div className="bg-stone-50 border-2 border-stone-900 rounded-2xl p-4 sm:p-5 space-y-4 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-black uppercase text-stone-900 block">
                  Nota Geral da E-Bike *
                </label>
                <span className="text-[11px] text-stone-500 font-bold">
                  {getRatingLabel(hoverRating || rating)}
                </span>
              </div>

              <div className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-xl border-2 border-stone-900 shadow-xs">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    onMouseEnter={() => setHoverRating(s)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`${s} estrelas`}
                    className="p-1 cursor-pointer transition-transform hover:scale-125 focus:outline-hidden"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        s <= (hoverRating || rating)
                          ? 'text-amber-500 fill-amber-500'
                          : 'text-stone-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* 4 Pilares de Avaliação Técnica */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-stone-200">
              <div>
                <span className="text-[10px] font-bold text-stone-700 block">🔋 Bateria / Autonomia</span>
                <select
                  value={criteria.batteryAutonomy}
                  onChange={(e) => setCriteria({ ...criteria, batteryAutonomy: Number(e.target.value) })}
                  className="w-full mt-1 px-2 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold"
                >
                  <option value="5">5/5 - Excelente</option>
                  <option value="4">4/5 - Muito boa</option>
                  <option value="3">3/5 - Mediana</option>
                  <option value="2">2/5 - Fraca</option>
                  <option value="1">1/5 - Decepcionante</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] font-bold text-stone-700 block">⚡ Força nas Subidas</span>
                <select
                  value={criteria.motorPower}
                  onChange={(e) => setCriteria({ ...criteria, motorPower: Number(e.target.value) })}
                  className="w-full mt-1 px-2 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold"
                >
                  <option value="5">5/5 - Muito Forte</option>
                  <option value="4">4/5 - Adequada</option>
                  <option value="3">3/5 - Justa</option>
                  <option value="2">2/5 - Falta Força</option>
                  <option value="1">1/5 - Fraca</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] font-bold text-stone-700 block">🛋️ Conforto / Ergonomia</span>
                <select
                  value={criteria.comfort}
                  onChange={(e) => setCriteria({ ...criteria, comfort: Number(e.target.value) })}
                  className="w-full mt-1 px-2 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold"
                >
                  <option value="5">5/5 - Muito Confortável</option>
                  <option value="4">4/5 - Boa</option>
                  <option value="3">3/5 - Regular</option>
                  <option value="2">2/5 - Rígida</option>
                  <option value="1">1/5 - Desconfortável</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] font-bold text-stone-700 block">🔧 Confiabilidade</span>
                <select
                  value={criteria.reliability}
                  onChange={(e) => setCriteria({ ...criteria, reliability: Number(e.target.value) })}
                  className="w-full mt-1 px-2 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold"
                >
                  <option value="5">5/5 - Nunca deu defeito</option>
                  <option value="4">4/5 - Boa robustez</option>
                  <option value="3">3/5 - Exige ajustes</option>
                  <option value="2">2/5 - Peças frágeis</option>
                  <option value="1">1/5 - Deu problema</option>
                </select>
              </div>
            </div>
          </div>

          {/* BLOCO 3: Identificação do Ciclista */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-black uppercase text-stone-800 mb-1">
                Seu Nome ou Apelido *
              </label>
              <input
                type="text"
                required
                maxLength={60}
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Ex: Carlos M."
                className="w-full px-3 py-2 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-bold text-stone-900 focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase text-stone-800 mb-1">
                Sua Cidade / Estado
              </label>
              <input
                type="text"
                maxLength={60}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex: Curitiba - PR"
                className="w-full px-3 py-2 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-bold text-stone-900 focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase text-stone-800 mb-1">
                Tempo com a Bike
              </label>
              <input
                type="text"
                maxLength={50}
                value={timeUsing}
                onChange={(e) => setTimeUsing(e.target.value)}
                placeholder="Ex: Uso há 8 meses"
                className="w-full px-3 py-2 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-bold text-stone-900 focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]"
              />
            </div>
          </div>

          {/* BLOCO 4: Tags Rápidas de Prós e Contras */}
          <div className="space-y-3">
            <div>
              <span className="text-[11px] font-black uppercase text-stone-700 flex items-center gap-1.5 mb-1.5">
                <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                Destaques Positivos Rápidos (opcional):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROS.map(pro => {
                  const isSelected = selectedPros.includes(pro);
                  return (
                    <button
                      key={pro}
                      type="button"
                      onClick={() => togglePro(pro)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-emerald-600 text-white border-emerald-800 shadow-xs' 
                          : 'bg-stone-50 text-stone-700 border-stone-300 hover:border-emerald-600'
                      }`}
                    >
                      {pro} {isSelected ? '✓' : '+'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="text-[11px] font-black uppercase text-stone-700 flex items-center gap-1.5 mb-1.5">
                <ThumbsDown className="w-3.5 h-3.5 text-rose-600" />
                Pontos de Atenção / Contras (opcional):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_CONS.map(con => {
                  const isSelected = selectedCons.includes(con);
                  return (
                    <button
                      key={con}
                      type="button"
                      onClick={() => toggleCon(con)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-rose-600 text-white border-rose-800 shadow-xs' 
                          : 'bg-stone-50 text-stone-700 border-stone-300 hover:border-rose-600'
                      }`}
                    >
                      {con} {isSelected ? '✓' : '+'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* BLOCO 5: Título e Relato Completo com Contadores */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-black uppercase text-stone-800">
                  Título Resumido do seu Relato *
                </label>
                <span className="text-[10px] text-stone-500 font-mono font-bold">
                  {title.length}/120
                </span>
              </div>
              <input
                type="text"
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Surpreendeu na autonomia, perfeita para ir ao trabalho"
                className="w-full px-3 py-2 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-bold text-stone-900 focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-black uppercase text-stone-800">
                  Relato Completo da sua Rotina de Pedalada *
                </label>
                <span className="text-[10px] text-stone-500 font-mono font-bold">
                  {comment.length}/1500
                </span>
              </div>
              <textarea
                required
                maxLength={1500}
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Compartilhe como ela se comporta no asfalto molhado, se o motor responde rápido após parar no farol, o tempo exato de recarga na tomada e se você recomenda a compra..."
                className="w-full px-3 py-2 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] leading-relaxed"
              />
            </div>
          </div>

          {/* Ações do Rodapé */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-stone-200">
            <div className="flex items-center gap-1.5 text-[11px] text-stone-500 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Sua avaliação ajuda ciclistas de todo o Brasil.</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 border-2 border-stone-900 text-stone-900 font-bold rounded-xl text-xs cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 border-2 border-stone-900 text-stone-900 font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 transition-all select-none"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Enviando Avaliação...' : 'Publicar Minha Avaliação'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
