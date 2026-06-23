import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PUBLIC_HANDLERS = new Set([
  "auth/expo-web-success/route.js:GET",
  "auth/token/route.js:GET",
  "employees/login/route.js:POST",
  "health/route.js:GET",
  "marketing/activate/route.js:POST",
  "marketing/settings/route.js:GET",
  "marketing/welcome/[slug]/route.js:GET",
  "setup/route.js:GET",
  "setup/route.js:POST",
  "uploadcare/config/route.js:GET",
]);

function routeFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return entry.name === "route.js" ? [full] : [];
  });
}

describe("API route authentication", () => {
  it("requires an auth gate unless explicitly public", () => {
    const root = path.resolve("src/app/api");
    const unprotected = routeFiles(root).flatMap((file) => {
      const source = fs.readFileSync(file, "utf8");
      const relative = path.relative(root, file).replaceAll("\\", "/");
      const handlers = [
        ...source.matchAll(
          /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g,
        ),
      ];

      return handlers.flatMap((handler, index) => {
        const handlerKey = `${relative}:${handler[1]}`;
        if (PUBLIC_HANDLERS.has(handlerKey)) return [];
        const start = handler.index;
        const end = handlers[index + 1]?.index ?? source.length;
        const body = source.slice(start, end);
        const protectedHandler =
          /requireAuth\s*\(/.test(body) ||
          /requireWorkspaceEmployee\s*\(/.test(body) ||
          /requireCronSecret\s*\(/.test(body);
        return protectedHandler ? [] : [handlerKey];
      });
    });

    expect(unprotected).toEqual([]);
  });
});
