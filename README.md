# css-but-ai

Vite-first compile-time CSS framework where `.ass` (**A**i **S**tyle **S**heet) files contain plain-text prompts.

At load time, the plugin calls a real LLM API, receives CSS, sanitizes it, scopes selectors using a CSS Modules-like naming scheme, and injects the generated CSS through JS.

## Current Status

Initial implementation is complete for:

- `.ass` import resolution through a Vite plugin
- Build/dev-time LLM call through OpenAI-compatible chat completions endpoint
- Strict CSS sanitization with allowlist checks
- Scoped class name rewriting with format `[basename]__[local]__[hash:8]`
- Default export of class map object from each `.ass` module
- HMR invalidation on `.ass` changes

## Install

```bash
npm install css-but-ai
```

## Usage (Vite)

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { assPlugin } from "css-but-ai";

export default defineConfig({
  plugins: [
    assPlugin({
      model: "gpt-4.1-mini",
      apiKey: process.env.OPENAI_API_KEY,
      // endpoint: "https://api.openai.com/v1/chat/completions",
      // timeoutMs: 30000,
    }),
  ],
});
```

```ts
// component.ts
import styles from "./Button.ass";

const className = styles.root;
```

For TypeScript projects, enable built-in `.ass` import types once in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["vite/client", "css-but-ai/ass"]
  }
}
```

```text
# Button.ass
A bold primary button with subtle hover lift, strong contrast text,
12px horizontal padding, rounded corners, and smooth transition.
```

## Environment

Set one of:

- `OPENAI_API_KEY`
- or pass `apiKey` in plugin options

## Safety Model

The sanitizer currently enforces:

- At-rules allowlist: `@media`, `@supports`, `@layer`
- Property allowlist from curated defaults
- Rejects `javascript:`, `expression()`, and `url()` by default

You can override sanitizer values via `sanitization` plugin option.

## Caveats (Current MVP Slice)

- Uses JS style-tag injection only
- Does not yet emit dedicated `.css` assets
- Relies on model returning strict JSON payload
- Type declarations for individual class keys are not generated yet

## Development

```bash
npm run build
npm run typecheck
```

## In-Repo Vite Sample App

A real Vite app is included at `examples/vite-app` for end-to-end verification.

From the repository root:

```bash
npm run sample:install
npm run sample:verify
```

What `sample:verify` does:

- Starts a local mock OpenAI-compatible endpoint
- Runs a Vite production build in the sample app
- Compiles a real `.ass` import through this plugin pipeline

You can also use a live API key in dev mode:

PowerShell:

```powershell
$env:OPENAI_API_KEY = "your_key_here"
npm run sample:dev
```

cmd.exe:

```bat
set OPENAI_API_KEY=your_key_here
npm run sample:dev
```

bash/zsh:

```bash
export OPENAI_API_KEY=your_key_here
npm run sample:dev
```

Run both commands in the same terminal session.

## Publishing Note

The root `.npmignore` excludes `examples/` so the sample app is never included in published npm package contents.
