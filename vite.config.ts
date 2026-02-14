import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/kitaayase/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) {
            return "react-vendor";
          }

          if (
            id.includes("/@chakra-ui/") ||
            id.includes("/@emotion/") ||
            id.includes("/framer-motion/") ||
            id.includes("/@zag-js/")
          ) {
            return "ui-vendor";
          }

          if (id.includes("/react-icons/")) {
            return "icons-vendor";
          }

          return "vendor";
        },
      },
    },
  },
});
