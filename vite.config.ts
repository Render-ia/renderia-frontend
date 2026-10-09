import { defineConfig } from 'vite';

// In development, requests to /api are forwarded to the local Spring Boot
// backend, so the browser sees a single origin and no CORS setup is needed.
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
