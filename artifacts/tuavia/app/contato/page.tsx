import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, MessageCircle, Clock, MapPin } from 'lucide-react';
import Footer from '@/components/Footer';
import ContactForm from '@/components/ContactForm';

export const metadata = {
  title: 'Contato | TuaVia',
  description: 'Fale com a equipe do TuaVia. Dúvidas, sugestões de modelos de e-bikes ou parcerias comerciais.',
};

export default function ContatoPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between text-ink" id="contato-page">
      {/* Navegação / Breadcrumb */}
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-6">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-xs font-mono font-bold text-ink bg-surface border-2 border-ink px-3.5 py-2 rounded-xl shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:bg-neutral-100 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 text-primary group-hover:-translate-x-1 transition-transform" />
          <span>Voltar para o início</span>
        </Link>
      </div>

      <main className="flex-grow max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        
        {/* Cabeçalho da página */}
        <div className="bg-surface border-2 border-ink rounded-3xl p-6 sm:p-8 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent-charge border border-ink rounded-full w-fit shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
            <Mail className="w-3.5 h-3.5 text-ink shrink-0" />
            <span className="text-[11px] font-mono font-bold text-ink uppercase">Fale Conosco</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-ink tracking-tight">
            Contato &amp; Suporte
          </h1>
          <p className="text-xs sm:text-sm text-ink/80 font-sans leading-relaxed">
            Tem alguma dúvida sobre comparações de e-bikes, quer sugerir um novo modelo para o catálogo ou falar sobre parcerias? Mande uma mensagem para nós!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* Informações de Contato Direto */}
          <div className="md:col-span-5 flex flex-col gap-6">
            <div className="bg-surface border border-line rounded-2xl p-6 flex flex-col gap-5 shadow-sm">
              <h2 className="font-display font-bold text-base text-ink border-b border-line pb-3">
                Canais Oficiais
              </h2>

              <div className="flex flex-col gap-4 text-xs font-sans">
                
                {/* E-mail */}
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0 mt-0.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] uppercase font-bold text-ink/50">E-mail Direto</span>
                    <a href="mailto:contato@tuavia.com.br" className="font-mono font-bold text-sm text-primary hover:underline">
                      contato@tuavia.com.br
                    </a>
                  </div>
                </div>

                {/* Resposta */}
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-accent-charge/20 text-primary rounded-xl shrink-0 mt-0.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] uppercase font-bold text-ink/50">Tempo de Resposta</span>
                    <span className="text-xs text-ink/80 font-medium">Respondemos em até 24 horas úteis</span>
                  </div>
                </div>

                {/* Localização */}
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-accent-warm/10 text-accent-warm rounded-xl shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] uppercase font-bold text-ink/50">Origem</span>
                    <span className="text-xs text-ink/80 font-medium">São Paulo - SP, Brasil • Feito para todo o país</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Dica para Lojistas */}
            <div className="bg-primary text-white border border-primary/20 rounded-2xl p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-accent-charge" />
                <h3 className="font-display font-bold text-xs uppercase tracking-wider text-accent-charge">
                  É lojista ou fabricante de E-bike?
                </h3>
              </div>
              <p className="text-xs text-white/80 leading-relaxed">
                Quer listar os seus modelos e ofertas em nosso comparador? Envie um e-mail com o assunto &quot;Parceria de Catálogo&quot; para avaliarmos a inclusão dos seus links.
              </p>
            </div>
          </div>

          {/* Formulário de Contato */}
          <div className="md:col-span-7">
            <ContactForm />
          </div>

        </div>

      </main>

      <Footer />
    </div>
  );
}
