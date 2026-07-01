import type { AssGenerationRequest, AssGenerationResponse, AssPluginOptions } from "../types.js";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface ChatCompletionRequestBody {
  model: string;
  temperature: number;
  max_tokens: number;
  messages: Array<{
    role: "system" | "user";
    content: string;
  }>;
  response_format?: {
    type: "json_schema";
    json_schema: {
      name: string;
      strict: true;
      schema: Record<string, unknown>;
    };
  };
}

const RESPONSE_SCHEMA: ChatCompletionRequestBody["response_format"] = {
  type: "json_schema",
  json_schema: {
    name: "ass_css_response",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["css"],
      properties: {
        css: {
          type: "string",
          minLength: 1,
        },
        classes: {
          type: "array",
          items: {
            type: "string",
            minLength: 1,
          },
        },
      },
    },
  },
};

function validateGeneratedPayload(payload: AssGenerationResponse): AssGenerationResponse {
  if (typeof payload.css !== "string" || payload.css.trim().length === 0) {
    throw new Error("Model response JSON must include a non-empty css string.");
  }

  if (
    payload.classes !== undefined &&
    (!Array.isArray(payload.classes) || payload.classes.some((item) => typeof item !== "string" || item.trim().length === 0))
  ) {
    throw new Error("Model response JSON classes must be an array of non-empty strings when provided.");
  }

  return {
    css: payload.css,
    classes: payload.classes,
  };
}

function extractJsonPayload(input: string): AssGenerationResponse {
  const trimmed = input.trim();

  try {
    const parsed = JSON.parse(trimmed) as AssGenerationResponse;
    return validateGeneratedPayload(parsed);
  } catch {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Model response did not contain parseable JSON.");
    }

    const parsed = JSON.parse(jsonMatch[0]) as AssGenerationResponse;
    return validateGeneratedPayload(parsed);
  }
}

async function requestModel(
  endpoint: string,
  apiKey: string,
  body: ChatCompletionRequestBody,
  signal: AbortSignal,
): Promise<ChatCompletionResponse> {
  const response = await fetch(endpoint, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Model request failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as ChatCompletionResponse;
}

export async function generateFromPrompt(
  req: AssGenerationRequest,
  options: AssPluginOptions,
): Promise<AssGenerationResponse> {
  const endpoint = options.endpoint ?? "https://api.openai.com/v1/chat/completions";
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing API key. Set options.apiKey or OPENAI_API_KEY.");
  }

  const systemPrompt =
    options.systemPrompt ??
    "You generate CSS modules from plain-text style prompts. Return strict JSON only with keys: css (string) and classes (string array optional). CSS must use class selectors only and no at-rules except @media/@supports/@layer.";

  const userPrompt = [
    "Generate CSS from this prompt.",
    `File: ${req.filePath}`,
    `Basename: ${req.basename}`,
    "You must return structured data matching the API response schema.",
    "Prompt:",
    req.prompt,
  ].join("\n");

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 30000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const requestBase: ChatCompletionRequestBody = {
      model: options.model,
      temperature: options.temperature ?? 0,
      max_tokens: options.maxTokens ?? 1200,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };

    let payload: ChatCompletionResponse;
    try {
      payload = await requestModel(
        endpoint,
        apiKey,
        {
          ...requestBase,
          response_format: RESPONSE_SCHEMA,
        },
        controller.signal,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const likelyUnsupportedFormat =
        /response_format|json_schema|unsupported|unknown/i.test(message);
      if (!likelyUnsupportedFormat) {
        throw error;
      }

      payload = await requestModel(endpoint, apiKey, requestBase, controller.signal);
    }

    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Model response was empty.");
    }

    return extractJsonPayload(content);
  } finally {
    clearTimeout(timeout);
  }
}
