import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert, FileText, AlertTriangle, ExternalLink, Scale } from 'lucide-react';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Termos de Uso | TuaVia',
  description: 'Conheça os Termos de Uso e o compromisso de transparência do TuaVia, comparador independente de bicicletas elétricas.',
};

export default function TermosPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between text-ink" id="termos-page">
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
            <FileText className="w-3.5 h-3.5 text-ink shrink-0" />
            <span className="text-[11px] font-mono font-bold text-ink uppercase">Regras da Estrada • Transparência</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-ink tracking-tight">
            Termos de Uso
          </h1>
          <p className="text-xs sm:text-sm text-ink/80 font-sans leading-relaxed">
            Última atualização: Agosto de 2026 • Entenda como o TuaVia funciona e as regras aplicáveis ao uso da nossa plataforma.
          </p>
        </div>

        {/* Aviso Legal sobre Rascunho MVP */}
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-4 sm:p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-950 font-sans leading-relaxed">
            <strong>Nota de Isenção (MVP):</strong> Este documento é um rascunho inicial elaborado para a fase de lançamento do MVP (Produto Mínimo Viável) da plataforma TuaVia. Recomenda-se formalmente a revisão por profissional jurídico qualificado antes da operação comercial definitiva.
          </div>
        </div>

        {/* Conteúdo dos Termos */}
        <div className="flex flex-col gap-8 font-sans text-xs sm:text-sm text-ink/80 leading-relaxed">
          
          {/* Seção 1 */}
          <section className="bg-surface border border-line rounded-2xl p-6 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary shrink-0" />
              <h2 className="font-display font-bold text-base text-ink">1. Natureza do Serviço</h2>
            </div>
            <p>
              O <strong>TuaVia</strong> é um portal e comparador independente de preços e especificações de bicicletas elétricas (e-bikes) disponíveis no mercado brasileiro. 
            </p>
            <p>
              O TuaVia <strong>não é uma loja virtual</strong>, não vende, não comercializa, não estoca e não entrega qualquer tipo de produto. Nossa única função é agregar, comparar e direcionar o usuário às lojas oficiais parceiras onde as ofertas estão disponíveis.
            </p>
          </section>

          {/* Seção 2 */}
          <section className="bg-surface border border-line rounded-2xl p-6 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-primary shrink-0" />
              <h2 className="font-display font-bold text-base text-ink">2. Preços, Estoque e Links de Terceiros</h2>
            </div>
            <p>
              Os preços, prazos de entrega, condições de pagamento e disponibilidade em estoque exibidos no TuaVia são obtidos através de checagem regular das lojas parceiras. No entanto, por serem gerenciados diretamente pelos lojistas, <strong>podem sofrer alterações sem aviso prévio</strong> no site oficial de destino.
            </p>
            <p>
              Caso haja divergência entre o preço listado no TuaVia e o preço no site do lojista parceiro, o preço e as condições do site do lojista valerão para todos os fins.
            </p>
          </section>

          {/* Seção 3 */}
          <section className="bg-surface border border-line rounded-2xl p-6 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary shrink-0" />
              <h2 className="font-display font-bold text-base text-ink">3. Transparência de Afiliação e Remuneração</h2>
            </div>
            <p>
              Em conformidade com as diretrizes de transparência e boas práticas de consumo, informamos que o TuaVia participa de programas de afiliação comercial com lojas parceiras oficiais.
            </p>
            <p>
              Isso significa que, quando você clica em um link de oferta (&quot;Ir para a loja&quot;) e conclui uma compra no site do parceiro, o TuaVia <strong>pode receber uma comissão de afiliação</strong>. Essa comissão não gera nenhum custo adicional para você e nos ajuda a manter a plataforma gratuita, independente e com dados atualizados.
            </p>
          </section>

          {/* Seção 4 */}
          <section className="bg-surface border border-line rounded-2xl p-6 flex flex-col gap-3 shadow-sm">
            <h2 className="font-display font-bold text-base text-ink">4. Isenção de Responsabilidade</h2>
            <p>
              Toda transação comercial (pagamento, entrega, garantia, troca ou devolução) é realizada exclusivamente entre o usuário e a loja parceira vendedora. O TuaVia não possui qualquer responsabilidade sobre eventuais problemas relacionados a entregas, defeitos de fabricação ou atendimento pós-venda dos produtos adquiridos em sites de terceiros.
            </p>
          </section>

          {/* Seção 5 */}
          <section className="bg-surface border border-line rounded-2xl p-6 flex flex-col gap-3 shadow-sm">
            <h2 className="font-display font-bold text-base text-ink">5. Alterações nos Termos</h2>
            <p>
              O TuaVia reserva-se o direito de atualizar ou modificar estes Termos de Uso a qualquer momento para refletir melhorias no serviço ou novas exigências legais. Recomendamos a consulta periódica desta página.
            </p>
          </section>

        </div>

      </main>

      <Footer />
    </div>
  );
}
