import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite config: React + Tailwind v4 plugin. Dev server runs on http://localhost:5173
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
