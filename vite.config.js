import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Local development only: with ARKIV_ACCESS_KEY in .env.local, `npm run dev` serves /arkiv-rpc, which
  // forwards reads to Arkiv with the key added on this machine. The key never reaches the browser or the build.
  const env = loadEnv(mode, process.cwd(), '');
  const key = env.ARKIV_ACCESS_KEY;
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: key
        ? {
            '/arkiv-rpc': {
              target: 'https://rpc.tiramisu.db-chain.testnet.arkiv.network',
              changeOrigin: true,
              rewrite: () => '/',
              headers: { 'X-API-KEY': key },
            },
          }
        : undefined,
    },
    build: { chunkSizeWarningLimit: 1200 },
  };
});
