import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            // tesseract.js chi duoc dynamic import() tu ScanCardModal (quet
            // danh thiep) — de rollup tu tach chunk rieng theo bien dynamic
            // import, KHONG gop vao 'vendor' (vendor duoc modulepreload tren
            // moi trang, se lam mat tac dung lazy-load).
            if (id.includes('tesseract.js')) return 'tesseract'
            // xlsx (SheetJS) chi duoc dynamic import() tu wizard nhap gia pha
            // (doc file .xlsx) — cung ly do voi tesseract o tren, phai tach
            // rieng khoi 'vendor' de khong bi modulepreload tren moi trang.
            if (id.includes('xlsx')) return 'xlsx'
            if (id.includes('@supabase')) return 'supabase'
            return 'vendor'
          }
        },
      },
    },
  },
})
