'use client';

import React, { useState } from 'react';
import { Mail, Send, CheckCircle2, MessageSquare, User, AtSign, Loader2, AlertCircle } from 'lucide-react';

export default function ContactForm() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ nome?: string; email?: string; mensagem?: string }>({});

  const validate = () => {
    const newErrors: { nome?: string; email?: string; mensagem?: string } = {};
    if (!nome.trim()) {
      newErrors.nome = 'Por favor, informe seu nome.';
    }
    if (!email.trim()) {
      newErrors.email = 'Por favor, informe seu e-mail.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Insira um endereço de e-mail válido.';
    }
    if (!mensagem.trim()) {
      newErrors.mensagem = 'Por favor, digite sua mensagem.';
    } else if (mensagem.trim().length < 10) {
      newErrors.mensagem = 'A mensagem deve ter pelo menos 10 caracteres.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    // Simulação de envio com delay elegante
    setTimeout(() => {
      console.log('[TuaVia Contato Enviado]', { nome, email, mensagem, data: new Date().toISOString() });
      setIsSubmitting(false);
      setSubmitted(true);
      setToastMessage('Mensagem enviada com sucesso! Retornaremos em breve.');
      
      setTimeout(() => {
        setToastMessage(null);
      }, 5000);
    }, 1200);
  };

  return (
    <div className="relative">
      {/* Toast flutuante de sucesso */}
      {toastMessage && (
        <div className="absolute -top-16 left-0 right-0 z-20 flex items-center justify-center animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-ink text-white px-4 py-3 rounded-xl shadow-lg border border-line flex items-center gap-2.5 text-xs font-mono">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      <div className="bg-surface border border-line rounded-2xl p-6 sm:p-8 shadow-sm">
        {submitted ? (
          <div className="flex flex-col items-center justify-center text-center py-8 gap-4 animate-in fade-in duration-300">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="font-display font-bold text-xl text-ink">Mensagem Enviada!</h2>
            <p className="text-xs sm:text-sm text-ink/70 max-w-md">
              Obrigado por entrar em contato com a equipe TuaVia. Analisaremos sua mensagem e retornaremos pelo e-mail <strong>{email}</strong> em breve.
            </p>
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setNome('');
                setEmail('');
                setMensagem('');
                setErrors({});
              }}
              className="mt-2 text-xs font-mono font-bold text-primary hover:underline cursor-pointer min-h-[44px] px-4 py-2 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg"
            >
              Enviar outra mensagem
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="nome" className="text-xs font-mono font-bold text-ink/80 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                <span>Seu Nome *</span>
              </label>
              <input
                id="nome"
                type="text"
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  if (errors.nome) setErrors({ ...errors, nome: undefined });
                }}
                placeholder="ex: João Silva"
                className={`px-4 py-2.5 bg-bg-base border rounded-xl text-xs sm:text-sm text-ink focus:outline-none focus:ring-1 transition-all ${
                  errors.nome ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-line focus:border-primary focus:ring-primary'
                }`}
                aria-invalid={!!errors.nome}
              />
              {errors.nome && (
                <span className="text-[11px] text-red-600 font-mono flex items-center gap-1 mt-0.5">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {errors.nome}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-mono font-bold text-ink/80 flex items-center gap-1.5">
                <AtSign className="w-3.5 h-3.5 text-primary" />
                <span>E-mail para Contato *</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({ ...errors, email: undefined });
                }}
                placeholder="seu@email.com"
                className={`px-4 py-2.5 bg-bg-base border rounded-xl text-xs sm:text-sm text-ink focus:outline-none focus:ring-1 transition-all ${
                  errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-line focus:border-primary focus:ring-primary'
                }`}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <span className="text-[11px] text-red-600 font-mono flex items-center gap-1 mt-0.5">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {errors.email}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="mensagem" className="text-xs font-mono font-bold text-ink/80 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                <span>Sua Mensagem *</span>
              </label>
              <textarea
                id="mensagem"
                rows={5}
                value={mensagem}
                onChange={(e) => {
                  setMensagem(e.target.value);
                  if (errors.mensagem) setErrors({ ...errors, mensagem: undefined });
                }}
                placeholder="Como podemos te ajudar? Dúvidas sobre e-bikes, sugestões de novos modelos ou parcerias..."
                className={`px-4 py-2.5 bg-bg-base border rounded-xl text-xs sm:text-sm text-ink focus:outline-none focus:ring-1 transition-all resize-y ${
                  errors.mensagem ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-line focus:border-primary focus:ring-primary'
                }`}
                aria-invalid={!!errors.mensagem}
              />
              {errors.mensagem && (
                <span className="text-[11px] text-red-600 font-mono flex items-center gap-1 mt-0.5">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {errors.mensagem}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`mt-2 h-12 bg-primary hover:bg-primary-dark text-white font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer ${
                isSubmitting ? 'opacity-80 cursor-not-allowed' : ''
              }`}
              aria-label={isSubmitting ? 'Enviando mensagem...' : 'Enviar Mensagem'}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Enviando mensagem...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 shrink-0" />
                  <span>Enviar Mensagem</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
