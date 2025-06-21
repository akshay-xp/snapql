import { defineConfig } from "vite"
import react from "@vitejs/plugin-react-swc"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        devtools: path.resolve(__dirname, "devtools.html"),
        panel: path.resolve(__dirname, "panel.html"),
        devtoolsScript: path.resolve(__dirname, "src/devtools.ts"),
        main: path.resolve(__dirname, "src/main.tsx"),
      },
    },
    outDir: "dist",
    emptyOutDir: true,
  },
})
