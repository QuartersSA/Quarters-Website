import { Hono } from "hono";
import type { Handler } from "hono/types";
import updatedFetch from "../src/__create/fetch";

const API_BASENAME = "/api";
const api = new Hono();

if (globalThis.fetch) {
  globalThis.fetch = updatedFetch;
}

// Vite resolves these at build time - no filesystem scanning needed
const routeModules = import.meta.glob("../src/app/api/**/route.js", {
  eager: false,
});

function getHonoPath(filePath: string): string {
  const withoutPrefix = filePath
    .replace("../src/app/api", "")
    .replace("/route.js", "");
  if (!withoutPrefix) return "/";
  return withoutPrefix
    .split("/")
    .map((segment) => {
      const match = segment.match(/^\[(\.{3})?([^\]]+)\]$/);
      if (match) {
        const [_, dots, param] = match;
        return dots === "..." ? `:${param}{.+}` : `:${param}`;
      }
      return segment;
    })
    .join("/");
}

async function registerRoutes() {
  api.routes = [];

  const entries = Object.entries(routeModules).sort(
    (a, b) => b[0].length - a[0].length,
  );

  for (const [filePath, importer] of entries) {
    try {
      const route = await (importer as () => Promise<any>)();
      const honoPath = getHonoPath(filePath) || "/";

      const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;
      for (const method of methods) {
        if (route[method]) {
          const handler: Handler = async (c) => {
            const params = c.req.param();
            return await route[method](c.req.raw, { params });
          };
          switch (method) {
            case "GET":
              api.get(honoPath, handler);
              break;
            case "POST":
              api.post(honoPath, handler);
              break;
            case "PUT":
              api.put(honoPath, handler);
              break;
            case "DELETE":
              api.delete(honoPath, handler);
              break;
            case "PATCH":
              api.patch(honoPath, handler);
              break;
          }
        }
      }
    } catch (error) {
      console.error(`Error registering route ${filePath}:`, error);
    }
  }
}

await registerRoutes();

// Hot reload in development
if (import.meta.env.DEV) {
  if (import.meta.hot) {
    import.meta.hot.accept(() => {
      registerRoutes().catch(console.error);
    });
  }
}

export { api, API_BASENAME };
