import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Rutas a los certificados SSL locales generados con mkcert.
// Si no existen, Vite arrancará en HTTP (fallback graceful).
const CERTS_DIR = resolve(__dirname, '../server/certs');
const certFile = resolve(CERTS_DIR, 'localhost.pem');
const keyFile  = resolve(CERTS_DIR, 'localhost-key.pem');
const hasCerts = fs.existsSync(certFile) && fs.existsSync(keyFile);

export default defineConfig({
  root: 'packages/client',
  plugins: [react()],
  server: {
    // Activar HTTPS si los certificados están disponibles
    ...(hasCerts && {
      https: {
        key:  fs.readFileSync(keyFile),
        cert: fs.readFileSync(certFile),
      }
    }),
    proxy: {
      '/api': {
        target: hasCerts ? 'https://localhost:3000' : 'http://localhost:3000',
        changeOrigin: true,
        secure: false,   // false = acepta cert auto-firmado de desarrollo
      }
    }
  },
  resolve: {
    alias: {
      'shared': resolve(__dirname, '../shared'),
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom']
        }
      },
      external: ['pino', 'pino-pretty', 'pino-roll']
    }
  }
});
