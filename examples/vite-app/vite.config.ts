import { assPlugin } from "css-but-ai";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    assPlugin({
      model: process.env.ASS_MODEL ?? "gpt-4.1-mini",
      endpoint: process.env.ASS_ENDPOINT,
      apiKey: process.env.OPENAI_API_KEY,
    }),
  ],
});
