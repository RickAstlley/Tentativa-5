# TuaVia

TuaVia é um portal brasileiro de comparação e análise técnica de bicicletas elétricas construído com Next.js 15, App Router, TypeScript, Tailwind CSS, NVIDIA NIM e Firebase.

## Desenvolvimento local

```bash
npm ci
npm run dev
```

A aplicação fica disponível em `http://localhost:3000`.

## Produção na Hostinger

O projeto usa `output: 'standalone'` no `next.config.ts`. O build agora prepara automaticamente o pacote `.next/standalone`, copia os scripts do supervisor e configura o `start` interno para executar `scripts/start-hostinger.mjs`.

Na Hostinger, envie o **ZIP-fonte**, aquele que possui `app/`, `package.json` e `scripts/` diretamente na raiz após a extração. Mantenha o aplicativo como **Node.js server-side / Next.js**. Use `npm run build` como comando de compilação e `npm start` como comando de inicialização. O processo precisa ser iniciado a partir da raiz do projeto, onde existe a pasta `app/`; não use o ZIP standalone nesta modalidade.

O ZIP standalone é um artefato já compilado e contém `server.js`, `.next/`, `node_modules/` e `scripts/`, mas não contém `app/`. Portanto, se ele for enviado ao painel que executa `npm run build`, o Next.js falhará com `Couldn't find any pages or app directory` ou `next: not found`. Use o standalone somente em uma configuração da Hostinger que não execute novo build e que inicie diretamente `node scripts/start-hostinger.mjs`.

Para o ZIP-fonte, se o painel solicitar um diretório de saída, use o valor recomendado pela integração Next.js da Hostinger, normalmente `.next`. O comando `npm start` da raiz encontra o servidor em `.next/standalone/server.js`.

### Variáveis obrigatórias

Cadastre as variáveis no hPanel com os nomes exatos do `.env.example`. Não inclua espaços antes ou depois do nome. Para o Firebase Admin, use uma Service Account nova em `FIREBASE_ADMIN_SERVICE_ACCOUNT`, em JSON de uma linha ou Base64; não coloque o arquivo JSON dentro do ZIP nem no repositório.

A fila do worker deve apontar para um caminho absoluto gravável e persistente, fora de `.next/standalone`, por exemplo:

```bash
LLM_JOBS_FILE=/home/USUARIO/domains/tuavia.com.br/nodejs/data/llm_jobs.json
```

Depois de alterar as variáveis, salve e faça um **redeploy** ou use **Restart** no aplicativo. O processo em execução precisa ser reiniciado para receber o ambiente atualizado.

### Fluxo de deploy

```bash
npm ci
npm run build
npm start
```

O `npm run build` executa `next build` e, em seguida, `scripts/prepare-standalone.mjs`. O `npm start` executa `scripts/start-hostinger.mjs`, que carrega as variáveis, valida a fila persistente, inicia o servidor Next.js standalone e, quando habilitado, inicia o worker de IA.

### Diagnóstico

Após autenticar no painel administrativo, a rota `GET /api/admin/env-check` informa quais variáveis o processo em execução encontrou e quais arquivos `.env` foram lidos. A rota `GET /api/admin/llm/health` verifica a fila e o executor de IA.

## Verificações locais

```bash
npm run lint
npm run validate:data
npm run build
```

## Segurança

Credenciais de Firebase, chaves de API, passcodes e segredos de sessão devem existir somente no ambiente da Hostinger. Se alguma credencial foi exposta em um screenshot, ZIP, repositório ou log, revogue-a e gere outra antes de usar o deploy final.
