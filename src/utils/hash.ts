import { createHash } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function normalizePrompt(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function toSafeIdentifier(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, "_");
}
