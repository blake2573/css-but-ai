export interface AssGenerationRequest {
  prompt: string;
  filePath: string;
  basename: string;
  normalizedPromptHash: string;
}

export interface AssGenerationResponse {
  css: string;
  classes?: string[];
}

export interface SanitizationOptions {
  allowedAtRules: string[];
  allowedProperties: string[];
  allowDataUrls: boolean;
}

export interface AssPluginOptions {
  include?: RegExp;
  endpoint?: string;
  apiKey?: string;
  model: string;
  systemPrompt?: string;
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
  sanitization?: Partial<SanitizationOptions>;
}

export interface CompileResult {
  css: string;
  classes: Record<string, string>;
  moduleCode: string;
  promptHash: string;
}
