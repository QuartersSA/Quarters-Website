import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { queryKeys } from "../src/utils/queryKeys.js";

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(absolute);
      return /\.(?:js|jsx|ts|tsx)$/.test(entry.name) ? [absolute] : [];
    }),
  );
  return files.flat();
}

describe("React Query key factory", () => {
  it("provides a unique array prefix for every key factory", () => {
    const prefixes = Object.entries(queryKeys).map(([name, factory]) => {
      expect(factory, name).toBeTypeOf("function");
      const key = factory();
      expect(Array.isArray(key), name).toBe(true);
      expect(key.length, name).toBeGreaterThan(0);
      return JSON.stringify(key);
    });

    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it("keeps query keys centralized instead of declaring inline arrays", async () => {
    const root = path.resolve("src");
    const files = await sourceFiles(root);
    const offenders = [];

    for (const file of files) {
      if (file.endsWith(path.join("utils", "queryKeys.js"))) continue;
      const source = await readFile(file, "utf8");
      if (/queryKey\s*:\s*\[/.test(source)) {
        offenders.push(path.relative(root, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});
