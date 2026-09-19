import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

type Product = 'analytics' | 'robot';

export function aiCompositionConfig(product: Product) {
  const configDirectory = path.dirname(fileURLToPath(import.meta.url));
  const forbidden = [
    '/src/app/router/', '/src/app/App.tsx', '/src/features/autodial/',
    '/src/features/voiceRobots/', '/src/features/routes/',
    '/src/features/callcenter/', '/src/features/ai-agents/',
  ];
  return defineConfig({
    plugins: [
      react(), tailwindcss(),
      {
        name: 'standalone-ai-boundary',
        generateBundle() {
          const violations = [...this.getModuleIds()]
            .map((id) => id.replaceAll('\\', '/'))
            .filter((id) => forbidden.some((fragment) => id.includes(fragment)));
          if (violations.length) this.error(`PBX source in ${product} composition: ${violations.join(', ')}`);
        },
      },
    ],
    resolve: { alias: {
      '@': path.resolve(configDirectory, './src'),
      '@krasterisk/shared': path.resolve(configDirectory, '../shared/src'),
    } },
    build: {
      outDir: `dist-${product}`,
      emptyOutDir: true,
      rollupOptions: { input: path.resolve(configDirectory, `${product}.html`) },
    },
    server: {
      proxy: { '/api': { target: `http://localhost:${product === 'analytics' ? 5011 : 5012}`, changeOrigin: true } },
    },
  });
}
