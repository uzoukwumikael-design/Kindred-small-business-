import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ command }) => {
  const isPreview = process.argv.includes("preview");
  return {
    server: { host: "0.0.0.0", port: 8080, strictPort: true },
    preview: { host: "127.0.0.1", port: 8081, strictPort: true },
    resolve: { tsconfigPaths: true },
    plugins: [
      tailwindcss(),
      tanstackStart(),
      // Nitro packages the server for Vercel. It only runs for a production build or a preview of one.
      ...(command === "build" || isPreview ? [nitro({ preset: "vercel" })] : []),
      viteReact(),
    ],
  };
});
