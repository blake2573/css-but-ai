import path from "node:path";
import { buildModuleCode } from "../runtime/moduleTemplate.js";
import type { AssPluginOptions, CompileResult } from "../types.js";
import { normalizePrompt, sha256, toSafeIdentifier } from "../utils/hash.js";
import { generateFromPrompt } from "./aiClient.js";
import { sanitizeCss, scopeSelectors } from "./cssPipeline.js";
import { DEFAULT_SANITIZATION_OPTIONS } from "./defaults.js";

export async function compileAssFile(
  filePath: string,
  source: string,
  options: AssPluginOptions,
): Promise<CompileResult> {
  const basenameRaw = path.basename(filePath, ".ass");
  const basename = toSafeIdentifier(basenameRaw || "component");

  const normalizedPrompt = normalizePrompt(source);
  if (!normalizedPrompt) {
    throw new Error(`ASS file is empty: ${filePath}`);
  }

  const promptHash = sha256(`${options.model}\n${normalizedPrompt}`);
  const modelResponse = await generateFromPrompt(
    {
      prompt: normalizedPrompt,
      filePath,
      basename,
      normalizedPromptHash: promptHash,
    },
    options,
  );

  const sanitized = sanitizeCss(modelResponse.css, {
    ...DEFAULT_SANITIZATION_OPTIONS,
    ...options.sanitization,
  });

  const shortHash = promptHash.slice(0, 8);
  const { css, classes } = scopeSelectors(sanitized, (local) => {
    const safeLocal = toSafeIdentifier(local);
    return `${basename}__${safeLocal}__${shortHash}`;
  });

  const styleId = `${basename}-${shortHash}`;
  const moduleCode = buildModuleCode(css, classes, styleId);

  return {
    css,
    classes,
    moduleCode,
    promptHash,
  };
}
