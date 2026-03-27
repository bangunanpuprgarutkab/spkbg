import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: '/spkbg/',
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
    'process.env': {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
      VITE_GOOGLE_CLIENT_ID: process.env.VITE_GOOGLE_CLIENT_ID,
      VITE_GOOGLE_API_KEY: process.env.VITE_GOOGLE_API_KEY,
    },
  },
})
