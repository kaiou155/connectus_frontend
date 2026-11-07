import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Durante o desenvolvimento, as chamadas para /api são encaminhadas ao back-end Node.js
// (VITE_API_PROXY), evitando problemas de CORS. Em produção o front-end chama VITE_API_URL.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY || 'http://localhost:3333',
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'node',
    },
  };
});
