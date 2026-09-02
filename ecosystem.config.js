module.exports = {
  apps: [
    {
      name: 'convert-to-pdf',
      script: './src/server.js',
      instances: 1, // Hanya 1 instance karena kita pakai p-queue in-process
      autorestart: true,
      watch: false, // Jangan watch file di production (bikin boros resource)
      max_memory_restart: '500M', // Restart jika RAM melebihi 500MB (jaga-jaga memory leak)
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // Log configuration
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    }
  ]
};