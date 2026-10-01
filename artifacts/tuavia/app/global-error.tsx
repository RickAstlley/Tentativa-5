'use client';

import React, { useState } from 'react';

const isDev = process.env.NODE_ENV !== 'production';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  const handleHardReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    } else {
      reset();
    }
  };

  const handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  const handleClearCacheAndReset = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // Ignora restrições de sandbox de storage
      }
      window.location.href = '/';
    }
  };

  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <title>TuaVia | Recuperação do Sistema</title>
        <style dangerouslySetInnerHTML={{ __html: `
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #FAFAF7;
            color: #2E2B27;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 16px;
            box-sizing: border-box;
          }
          .card {
            background-color: #FFFFFF;
            border: 2px solid #2E2B27;
            border-radius: 24px;
            padding: 28px 24px;
            max-width: 460px;
            width: 100%;
            box-shadow: 6px 6px 0px 0px #2E2B27;
            text-align: center;
            box-sizing: border-box;
          }
          .badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background-color: #FEF3C7;
            border: 2px solid #2E2B27;
            color: #92400E;
            font-weight: 800;
            font-size: 20px;
            width: 52px;
            height: 52px;
            border-radius: 16px;
            margin-bottom: 16px;
          }
          .title {
            font-size: 20px;
            font-weight: 800;
            margin: 0 0 10px 0;
            text-transform: uppercase;
            letter-spacing: -0.5px;
            color: #2E2B27;
          }
          .desc {
            font-size: 14px;
            line-height: 1.5;
            color: #57534E;
            margin: 0 0 20px 0;
          }
          .btn-primary {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            min-height: 46px;
            background-color: #059669;
            color: #FFFFFF;
            font-weight: 700;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border: 2px solid #2E2B27;
            border-radius: 12px;
            cursor: pointer;
            box-shadow: 2px 2px 0px 0px #2E2B27;
            margin-bottom: 10px;
            text-decoration: none;
            box-sizing: border-box;
          }
          .btn-primary:active {
            transform: translate(1px, 1px);
            box-shadow: 1px 1px 0px 0px #2E2B27;
          }
          .btn-secondary {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            min-height: 46px;
            background-color: #FFFFFF;
            color: #2E2B27;
            font-weight: 700;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border: 2px solid #2E2B27;
            border-radius: 12px;
            cursor: pointer;
            box-shadow: 2px 2px 0px 0px #2E2B27;
            margin-bottom: 10px;
            text-decoration: none;
            box-sizing: border-box;
          }
          .btn-secondary:active {
            transform: translate(1px, 1px);
            box-shadow: 1px 1px 0px 0px #2E2B27;
          }
          .btn-link {
            background: none;
            border: none;
            color: #78716C;
            font-size: 12px;
            font-weight: 600;
            text-decoration: underline;
            cursor: pointer;
            padding: 8px;
            margin-top: 4px;
          }
          .details-box {
            margin-top: 14px;
            padding: 12px;
            background-color: #F5F5F4;
            border: 1px solid #D6D3D1;
            border-radius: 8px;
            text-align: left;
            font-size: 11px;
            font-family: monospace;
            word-break: break-all;
            color: #44403C;
            max-height: 120px;
            overflow-y: auto;
          }
        `}} />
      </head>
      <body>
        <div className="card">
          <div className="badge">!</div>
          <h1 className="title">Conexão Interrompida</h1>
          <p className="desc">
            Ocorreu uma falha temporária ao carregar o sistema TuaVia. Escolha uma das opções abaixo para restabelecer o acesso:
          </p>

          <button
            type="button"
            onClick={handleHardReload}
            className="btn-primary"
          >
            Recarregar Página
          </button>

          <button
            type="button"
            onClick={handleGoHome}
            className="btn-secondary"
          >
            Ir para a Página Inicial
          </button>

          <button
            type="button"
            onClick={handleClearCacheAndReset}
            className="btn-link"
          >
            Limpar dados em cache e reiniciar
          </button>

          <div style={{ marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              style={{ background: 'none', border: 'none', color: '#A8A29E', fontSize: '11px', cursor: 'pointer' }}
            >
              {showDetails ? 'Ocultar detalhes técnicos' : 'Exibir detalhes técnicos'}
            </button>
            {showDetails && (
              <div className="details-box">
                {/*
                  A mensagem crua costuma carregar nome do projeto do
                  Firestore, caminhos de arquivo e trechos de configuração. Em
                  produção só o digest é seguro — ele é o identificador de
                  correlação para procurar no servidor.
                */}
                {isDev && (
                  <div>
                    <strong>Mensagem:</strong> {error?.message || 'Falha não identificada'}
                  </div>
                )}
                {!isDev && (
                  <div>
                    <strong>Referência:</strong>{' '}
                    {error?.digest || 'sem identificador disponível'}
                  </div>
                )}
                {error?.digest && (
                  <div style={{ marginTop: '4px' }}>
                    <strong>Digest:</strong> {error.digest}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}

