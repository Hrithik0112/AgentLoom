import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `@/` is what the shadcn and componentry registries emit in their imports.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
