module.exports = {
  apps: [
    {
      name: 'tua-via-worker',
      // O loop contínuo (`process-llm-jobs-loop.mjs`), não o script de ciclo
      // único (`process-llm-jobs.mjs`). O de ciclo único faz uma passada e dá
      // `process.exit()` — o PM2 reiniciava o worker a cada 10s para ele sair de
      // novo em seguida, e a fila nunca ganhava um consumidor estável.
      script: 'scripts/process-llm-jobs-loop.mjs',
      cwd: '/home/u642036020/domains/tuavia.com.br/nodejs',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        // As variáveis abaixo JÁ DEVEM estar no painel Hostinger → Node.js →
        // Variáveis de Ambiente (não aqui):
        //   NVIDIA_API_KEY=
        //   LLM_WORKER_SECRET=
        //   LLM_EXECUTOR_BASE_URL=https://tuavia.com.br
        //   LLM_JOBS_FILE=/home/u642036020/domains/tuavia.com.br/data/llm_jobs.json
      },
      // Reinicio automático
      watch: false,
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 5000,
      // Logs
      error_file: '/home/u642036020/domains/tuavia.com.br/logs/worker-error.log',
      out_file: '/home/u642036020/domains/tuavia.com.br/logs/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Graceful shutdown
      kill_timeout: 5000,
    },
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
    }
  ]
};