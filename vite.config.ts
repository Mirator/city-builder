import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/city-builder/" : "/",
  build: {
    target: "es2022",
  },
}));
