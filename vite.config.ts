import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins, type Plugin } from "vite-plus";

// https://vite.dev/config/
/** Serves the note function during `vp dev`. Vercel runs `api/` itself once deployed. */
function devApi(): Plugin {
  return {
    name: "seqligase-dev-api",
    apply: "serve",
    configureServer(server) {
      try {
        process.loadEnvFile(".env");
      } catch {
        // No .env: the function answers 503 and the app uses its saved notes.
      }
      server.middlewares.use("/api/explain", (req, res) => {
        void (async () => {
          const { default: handler } = await server.ssrLoadModule("/api/explain.ts");
          const url = `http://${req.headers.host}${req.originalUrl}`;
          const response: Response = await handler.fetch(new Request(url));
          res.statusCode = response.status;
          response.headers.forEach((value, name) => res.setHeader(name, value));
          if (response.body) {
            for await (const chunk of response.body) res.write(chunk);
          }
          res.end();
        })().catch((err: unknown) => {
          server.config.logger.error(String(err));
          res.statusCode = 500;
          res.end();
        });
      });
    },
  };
}

export default defineConfig({
  fmt: {
    ignorePatterns: ["public/data/**", "scripts/**"],
  },
  lint: {
    ignorePatterns: ["public/data/**", "scripts/**", "src/components/ui/**"],
    plugins: ["react", "typescript", "oxc"],
    rules: {
      "react/rules-of-hooks": "error",
      "react/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
        },
      ],
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
  },
  plugins: lazyPlugins(() => [react(), tailwindcss(), devApi()]),
});
