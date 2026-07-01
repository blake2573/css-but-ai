import { promises as fs } from "node:fs";
import path from "node:path";
import { normalizePath, type HmrContext, type ModuleNode, type Plugin } from "vite";
import { compileAssFile } from "./compiler/compileAss.js";
import type { AssPluginOptions, CompileResult } from "./types.js";

const VIRTUAL_PREFIX = "\0ass:";

interface CacheEntry {
  sourceHash: string;
  result: CompileResult;
}

function defaultInclude(): RegExp {
  return /\.ass$/;
}

function toVirtualId(filePath: string): string {
  return `${VIRTUAL_PREFIX}${normalizePath(filePath)}`;
}

function fromVirtualId(id: string): string {
  return id.slice(VIRTUAL_PREFIX.length);
}

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

function toAbsoluteAssPath(source: string, importer?: string): string {
  if (path.isAbsolute(source)) {
    return source;
  }

  if (!importer) {
    return path.resolve(process.cwd(), source);
  }

  return path.resolve(path.dirname(importer), source);
}

async function compileWithCache(
  filePath: string,
  options: AssPluginOptions,
  cache: Map<string, CacheEntry>,
): Promise<CompileResult> {
  const source = await fs.readFile(filePath, "utf8");
  const sourceHash = simpleHash(source);

  const cached = cache.get(filePath);
  if (cached && cached.sourceHash === sourceHash) {
    return cached.result;
  }

  const result = await compileAssFile(filePath, source, options);
  cache.set(filePath, { sourceHash, result });
  return result;
}

function handleAssHmr(ctx: HmrContext): ModuleNode[] | void {
  if (!ctx.file.endsWith(".ass")) {
    return;
  }

  const virtualId = toVirtualId(ctx.file);
  const modules = new Set(ctx.modules);

  const linked = ctx.server.moduleGraph.getModuleById(virtualId);
  if (linked) {
    modules.add(linked);
  }

  for (const moduleNode of modules) {
    ctx.server.moduleGraph.invalidateModule(moduleNode);
  }

  return [...modules];
}

export function assPlugin(userOptions: AssPluginOptions): Plugin {
  if (!userOptions.model) {
    throw new Error("assPlugin requires a model option.");
  }

  const options: AssPluginOptions = {
    include: defaultInclude(),
    ...userOptions,
  };

  const cache = new Map<string, CacheEntry>();

  return {
    name: "vite-plugin-ass",
    enforce: "pre",

    async resolveId(source, importer) {
      if (!options.include?.test(source)) {
        return null;
      }

      const importerPath = importer?.startsWith(VIRTUAL_PREFIX)
        ? fromVirtualId(importer)
        : importer;
      const absolutePath = toAbsoluteAssPath(source, importerPath);
      return toVirtualId(absolutePath);
    },

    async load(id) {
      if (!id.startsWith(VIRTUAL_PREFIX)) {
        return null;
      }

      const filePath = fromVirtualId(id);
      const result = await compileWithCache(filePath, options, cache);
      return result.moduleCode;
    },

    handleHotUpdate(ctx) {
      cache.delete(ctx.file);
      return handleAssHmr(ctx);
    },
  };
}
