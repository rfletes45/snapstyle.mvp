import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  // Use relative asset paths so the build works from any mount path
  // (e.g. co-located at /starforge on the Colyseus server)
  base: "./",
  server: {
    host: true,
    port: 5174,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
