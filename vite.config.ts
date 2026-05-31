import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { APP_BUILD } from "./server/buildVersion";

function injectBuildMeta() {
  return {
    name: "inject-build-meta",
    transformIndexHtml(html: string) {
      const tag = `<meta name="fv-build" content="${APP_BUILD}" />`;
      if (html.includes("name=\"fv-build\"")) return html;
      return html.replace("<head>", `<head>\n    ${tag}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths(), injectBuildMeta()],
  define: {
    "import.meta.env.VITE_APP_BUILD": JSON.stringify(APP_BUILD),
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
});
