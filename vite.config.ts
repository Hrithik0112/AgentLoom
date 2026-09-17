import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `@/` is what the shadcn and componentry registries emit in their imports.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Two entries: the landing page is the front door, the tool is its own bundle, so
  // visitors do not download React Flow just to read the pitch.
  build: {
    rollupOptions: {
      input: {
        landing: fileURLToPath(new URL('./index.html', import.meta.url)),
        app: fileURLToPath(new URL('./app.html', import.meta.url)),
      },
    },
  },
})
