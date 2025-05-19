import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // para usar "@/components/..." em vez de "../../../components"
    },
  },
  server: {
    port: 3000,               // manter a porta antiga 
    proxy: {
      // redireciona /api ou /ws para o backend
      "/ws": "ws://localhost:8000",
      "/api": "http://localhost:8000",
    },
  },
});
