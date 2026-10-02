/**
 * Configuração do PM2 — TuaVia
 *
 * Antes isto também definia um app `tua-via-worker`, que rodava o supervisor
 * da fila de jobs de LLM. O subsistema de IA foi removido do projeto, então o
 * worker deixou de ter o que consumir e saiu daqui junto.
 *
 * O app do site é a única coisa que o PM2 precisa manter no ar.
 */
module.exports = {
  apps: [
    {
      name: 'tua-via-app',
      script: 'server.js',
      cwd: '/home/u642036020/domains/tuavia.com.br/nodejs',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      watch: false,
      max_memory_restart: '1G',
      instances: 1,
      exec_mode: 'fork',
      error_file: '/home/u642036020/domains/tuavia.com.br/logs/app-error.log',
      out_file: '/home/u642036020/domains/tuavia.com.br/logs/app-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
