import { handleRootRequest, handleModelsRequest, handleChatCompletionsRequest } from "./src/handlers.ts";
import {
  addCorsHeaders,
  methodNotAllowed,
  notFound,
  internalError,
  unauthorized,
  createOptionsResponse
} from "./src/utils.ts";

export async function handler(request: Request): Promise<Response> {
  const WANDB_API_KEY = Deno.env.get("WANDB_API_KEY") ?? "";
  const PROXY_API_KEY = Deno.env.get("PROXY_API_KEY") ?? "";

  try {
    if (request.method === "OPTIONS") {
      return createOptionsResponse();
    }

    if (request.method !== "GET" && request.method !== "POST") {
      return addCorsHeaders(methodNotAllowed());
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    // robots.txt
    if (pathname === "/robots.txt" && request.method === "GET") {
      return new Response("User-agent: *\nDisallow: /", {
        status: 200,
        headers: { "Content-Type": "text/plain" }
      });
    }

    if (pathname === "/" && request.method === "GET") {
      return handleRootRequest();
    }

    let authHeader = request.headers.get("Authorization");

    if (PROXY_API_KEY !== "") {
      // Строгий режим: клиент аутентифицируется ключом прокси,
      // upstream получает серверный WANDB_API_KEY. Клиентский ключ игнорируется.
      if (authHeader !== `Bearer ${PROXY_API_KEY}`) {
        return addCorsHeaders(unauthorized());
      }
      authHeader = `Bearer ${WANDB_API_KEY}`;
    } else {
      if (!authHeader && WANDB_API_KEY !== "") {
        authHeader = `Bearer ${WANDB_API_KEY}`;
      }
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return addCorsHeaders(unauthorized());
      }
    }

    if (pathname === "/v1/models" && request.method === "GET") {
      return handleModelsRequest(authHeader, request).then(addCorsHeaders);
    } else if (pathname === "/v1/chat/completions" && request.method === "POST") {
      return handleChatCompletionsRequest(authHeader, request).then(addCorsHeaders);
    } else {
      return addCorsHeaders(notFound());
    }

  } catch (error) {
    console.error("Server error:", error);
    return addCorsHeaders(internalError(error));
  }
}

// Локальный запуск
if (import.meta.main) {
  const PORT = parseInt(Deno.env.get("PORT") ?? "8000");
  const WANDB_API_KEY = Deno.env.get("WANDB_API_KEY") ?? "";
  const PROXY_API_KEY = Deno.env.get("PROXY_API_KEY") ?? "";

  if (PROXY_API_KEY !== "") {
    console.log(`🔒 Strict mode: clients must present PROXY_API_KEY`);
  } else if (WANDB_API_KEY === "") {
    console.log(`⚠️  WARNING: WANDB_API_KEY environment variable is not set.`);
    console.log(`   You must provide Authorization header with requests.`);
  } else {
    console.log(`✅ Using WANDB_API_KEY from environment`);
  }

  Deno.serve(
    { port: PORT, onListen: ({ port }) => console.log(`🚀 Deno server listening on port ${port}`) },
    handler
  );
}

// Deno Deploy entrypoint
export default handler;
