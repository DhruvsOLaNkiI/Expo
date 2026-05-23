import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { boothCmsApiPlugin } from './vite-plugin-booth-cms-api';
import { pageindexApiPlugin } from './vite-plugin-pageindex-api';
import { r2ApiPlugin } from './vite-plugin-r2-api';
import { visitorsApiPlugin } from './vite-plugin-visitors-api';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      boothCmsApiPlugin(__dirname),
      visitorsApiPlugin(__dirname),
      r2ApiPlugin(__dirname),
      pageindexApiPlugin(__dirname),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@app': path.resolve(__dirname, 'src/app'),
        '@api': path.resolve(__dirname, 'src/api'),
        '@config': path.resolve(__dirname, 'src/config'),
        '@constants': path.resolve(__dirname, 'src/constants'),
        '@features': path.resolve(__dirname, 'src/features'),
        '@hooks': path.resolve(__dirname, 'src/hooks'),
        '@lib': path.resolve(__dirname, 'src/lib'),
        '@store': path.resolve(__dirname, 'src/store'),
        '@types': path.resolve(__dirname, 'src/types'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@pages': path.resolve(__dirname, 'src/pages'),
        '@layouts': path.resolve(__dirname, 'src/layouts'),
        '@server': path.resolve(__dirname, 'server'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    appType: 'spa',
  };
});
