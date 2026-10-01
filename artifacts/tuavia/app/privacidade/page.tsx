import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock, ShieldCheck, Eye, AlertTriangle } from 'lucide-react';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Política de Privacidade | TuaVia',
  description: 'Saiba como o TuaVia protege seus dados e respeita a LGPD na navegação e comparação de e-bikes.',
};

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen flex flex-col justify-between text-ink" id="privacidade-page">
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
            <Lock className="w-3.5 h-3.5 text-ink shrink-0" />
            <span className="text-[11px] font-mono font-bold text-ink uppercase">Segurança &amp; LGPD</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-ink tracking-tight">
            Política de Privacidade
          </h1>
          <p className="text-xs sm:text-sm text-ink/80 font-sans leading-relaxed">
            Última atualização: Agosto de 2026 • Saiba como garantimos a proteção das suas informações e sua privacidade enquanto navega no TuaVia.
          </p>
        </div>

        {/* Aviso Legal sobre Rascunho MVP */}
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-4 sm:p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-950 font-sans leading-relaxed">
            <strong>Nota de Isenção (MVP):</strong> Este documento é um rascunho inicial em conformidade básica com a LGPD (Lei nº 13.709/2018) para a versão MVP da plataforma TuaVia. Recomenda-se revisão técnica por um profissional de compliance/jurídico antes da operação comercial final.
          </div>
        </div>

        {/* Conteúdo da Política */}
        <div className="flex flex-col gap-8 font-sans text-xs sm:text-sm text-ink/80 leading-relaxed">
          
          {/* Seção 1 */}
          <section className="bg-surface border border-line rounded-2xl p-6 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
              <h2 className="font-display font-bold text-base text-ink">1. Compromisso com a LGPD</h2>
            </div>
            <p>
              O TuaVia atua em conformidade com a <strong>Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018)</strong>. Respeitamos a sua privacidade e assumimos o compromisso de tratar suas informações de forma transparente, segura e limitada apenas ao estritamente necessário para o funcionamento do site.
            </p>
          </section>

          {/* Seção 2 */}
          <section className="bg-surface border border-line rounded-2xl p-6 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary shrink-0" />
              <h2 className="font-display font-bold text-base text-ink">2. Coleta de Dados Pessoais</h2>
            </div>
            <p>
              <strong>Não solicitamos nem armazenamos dados pessoais sensíveis</strong> (como CPF, cartão de crédito, endereço ou senha) durante a sua navegação padrão pelo TuaVia. 
            </p>
            <p>
              Durante o uso da plataforma, apenas coletamos dados técnicos anonimizados de navegação (como tipo de navegador, páginas consultadas e tempo de permanência) e cookies estritamente necessários para o funcionamento e análise agregada de métricas do site.
            </p>
          </section>

          {/* Seção 3 */}
          <section className="bg-surface border border-line rounded-2xl p-6 flex flex-col gap-3 shadow-sm">
            <h2 className="font-display font-bold text-base text-ink">3. Uso de Cookies e Rastreamento de Afiliação</h2>
            <p>
              Utilizamos cookies e tecnologias similares para lembrar suas preferências de filtro e registrar quando você clica em um link direcionado a um lojista parceiro. 
            </p>
            <p>
              Esses cookies de afiliação servem apenas para atestar à loja parceira que a visita se originou no TuaVia, permitindo a contabilização adequada das métricas de indicação sem expor sua identidade pessoal.
            </p>
          </section>

          {/* Seção 4 */}
          <section className="bg-surface border border-line rounded-2xl p-6 flex flex-col gap-3 shadow-sm">
            <h2 className="font-display font-bold text-base text-ink">4. Compartilhamento de Dados</h2>
            <p>
              O TuaVia <strong>não vende, não aluga e não compartilha</strong> dados pessoais de usuários com terceiros para fins de marketing direto ou envio de spams.
            </p>
          </section>

          {/* Seção 5 */}
          <section className="bg-surface border border-line rounded-2xl p-6 flex flex-col gap-3 shadow-sm">
            <h2 className="font-display font-bold text-base text-ink">5. Direitos do Titular de Dados e Contato</h2>
            <p>
              Como titular dos seus dados, você tem o direito de solicitar esclarecimentos sobre o tratamento de informações a qualquer momento. Para tirar dúvidas ou exercer seus direitos previstos pela LGPD, entre em contato através do nosso canal oficial na página de <Link href="/contato" className="text-primary font-bold hover:underline">Contato</Link> ou pelo e-mail <code className="bg-bg-base px-2 py-0.5 rounded text-primary font-mono font-bold">contato@tuavia.com.br</code>.
            </p>
          </section>

        </div>

      </main>

      <Footer />
    </div>
  );
}
