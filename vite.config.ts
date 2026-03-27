import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor'
          }
          if (id.includes('@supabase/supabase-js')) {
            return 'supabase'
          }
          if (id.includes('xlsx')) {
            return 'xlsx'
          }
          if (id.includes('react-signature-canvas')) {
            return 'signature'
          }
          return undefined
        },
      },
    },
  },
  define: {
    'process.env': {},
  },
})
