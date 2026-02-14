import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    host: true,
    port: 5175,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../packages/golf-duels-shared/src"),
    },
  },
});
