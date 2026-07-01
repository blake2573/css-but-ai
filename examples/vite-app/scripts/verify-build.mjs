import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

function startMockServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }

      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString("utf8");
      });

      req.on("end", () => {
        const css = [
          ".root { display: inline-flex; align-items: center; font-weight: 600; }",
          ".cta { background-color: #2563eb; color: #ffffff; padding: 10px 16px; border-radius: 10px; cursor: pointer; transition: background-color 180ms ease; }",
          ".cta:hover { background-color: #1d4ed8; }",
        ].join("\n");

        const content = JSON.stringify({
          css,
          classes: ["root", "cta"],
        });

        const payload = {
          id: "mock-chatcmpl",
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: "mock-model",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content,
              },
              finish_reason: "stop",
            },
          ],
        };

        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(payload));
      });
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to bind mock server."));
        return;
      }
      resolve({ server, port: address.port });
    });
  });
}

function runBuild() {
  const viteBin = path.resolve(appRoot, "node_modules", "vite", "bin", "vite.js");

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [viteBin, "build"], {
      cwd: appRoot,
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Sample build failed with exit code ${code ?? "unknown"}.`));
    });

    child.on("error", reject);
  });
}

const { server, port } = await startMockServer();

try {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "mock-key";
  process.env.ASS_MODEL = process.env.ASS_MODEL ?? "mock-model";
  process.env.ASS_ENDPOINT =
    process.env.ASS_ENDPOINT ?? `http://127.0.0.1:${port}/v1/chat/completions`;

  await runBuild();
  console.log("Sample Vite build verification succeeded.");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
