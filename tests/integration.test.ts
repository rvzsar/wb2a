import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { handler } from "../main.ts";
import { CONFIG } from "../config.ts";
import { buildWandBRequest } from "../src/transformers.ts";

const mockFetch = (response: any, ok = true) => {
  return () => Promise.resolve({
    ok,
    json: () => Promise.resolve(response),
    status: ok ? 200 : 400,
    statusText: ok ? "OK" : "Bad Request",
    headers: new Headers(),
    body: null as any,
    clone: () => ({} as any)
  });
};

function createRequest(
  url: string,
  method = "GET",
  body?: any,
  headers: Record<string, string> = {}
): Request {
  return new Request(`http://localhost:8000${url}`, {
    method,
    headers: {
      "Authorization": "Bearer test-token",
      "Content-Type": "application/json",
      ...headers
    },
    body: body ? JSON.stringify(body) : null
  });
}

const originalFetch = globalThis.fetch;

async function withMock(response: any, test: () => Promise<void>) {
  globalThis.fetch = mockFetch(response) as any;
  try {
    await test();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

Deno.test("корневой путь", async () => {
  const request = createRequest("/", "GET");
  const response = await handler(request);
  assertEquals(response.status, 200);
});

Deno.test("ограничение методов", async () => {
  const request = createRequest("/v1/chat/completions", "PUT");
  const response = await handler(request);
  assertEquals(response.status, 405);
});

Deno.test("проверка авторизации - нет заголовка", async () => {
  const request = new Request("http://localhost:8000/v1/models");
  const response = await handler(request);
  assertEquals(response.status, 401);
});

Deno.test("проверка пути - невалидный путь", async () => {
  const request = createRequest("/invalid", "GET");
  const response = await handler(request);
  assertEquals(response.status, 404);
});

Deno.test("предварительный запрос", async () => {
  const request = new Request("http://localhost:8000/v1/chat/completions", {
    method: "OPTIONS"
  });
  const response = await handler(request);
  assertEquals(response.status, 204);
});

Deno.test("список моделей", async () => {
  await withMock({
    object: "list",
    data: [
      { id: "gpt-4", owned_by: "openai" },
      { id: "gpt-3.5-turbo", owned_by: "openai" }
    ]
  }, async () => {
    const request = createRequest("/v1/models", "GET");
    const response = await handler(request);
    const data = await response.json();
    
    assertEquals(response.status, 200);
    assertEquals(data.object, "list");
    assertEquals(Array.isArray(data.data), true);
    assertEquals(data.data.length, 2);
  });
});

Deno.test("завершение чата - нестрим", async () => {
  await withMock({
    id: "test-123",
    object: "chat.completion",
    created: Date.now(),
    model: "gpt-4",
    choices: [{
      index: 0,
      message: { role: "assistant", content: "Hello test" },
      finish_reason: "stop"
    }],
    usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
  }, async () => {
    const request = createRequest("/v1/chat/completions", "POST", {
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello" }]
    });
    
    const response = await handler(request);
    const data = await response.json();
    
    assertEquals(response.status, 200);
    assertEquals(data.object, "chat.completion");
    assertEquals(data.model, "gpt-4");
    assertEquals(Array.isArray(data.choices), true);
  });
});

Deno.test("невалидный JSON", async () => {
  const request = new Request("http://localhost:8000/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer test-token",
      "Content-Type": "application/json"
    },
    body: "invalid json"
  });
  
  const response = await handler(request);
  assertEquals(response.status, 400);
});

Deno.test("отсутствует параметр model", async () => {
  const request = createRequest("/v1/chat/completions", "POST", {
    messages: [{ role: "user", content: "Hello" }]
  });
  
  const response = await handler(request);
  assertEquals(response.status, 400);
});

Deno.test("отсутствует messages", async () => {
  const request = createRequest("/v1/chat/completions", "POST", {
    model: "gpt-4"
  });
  
  const response = await handler(request);
  assertEquals(response.status, 400);
});

Deno.test("проверка Content-Type", async () => {
  const request = createRequest("/v1/chat/completions", "POST", {}, {
    "Content-Type": "text/plain"
  });
  
  const response = await handler(request);
  assertEquals(response.status, 415);
});

// --- Tool calls ---

Deno.test("tool_calls не форсируются для модели без tool_choice", async () => {
  const req = {
    model: "zai-org/GLM-5.2",
    messages: [{ role: "user", content: "Привет" }],
    tools: [
      { type: "function", function: { name: "get_weather", description: "x", parameters: {} } }
    ]
  };
  const wandbReq = buildWandBRequest(req as any);
  // Никакого хардкода: клиент не просил tool_choice → прокси не добавляет его.
  assertEquals(wandbReq.tool_choice, undefined);
});

Deno.test("явный tool_choice прокидывается как есть", async () => {
  const req = {
    model: "zai-org/GLM-5.2",
    messages: [{ role: "user", content: "Привет" }],
    tools: [{ type: "function", function: { name: "f", description: "x", parameters: {} } }],
    tool_choice: "auto"
  };
  const wandbReq = buildWandBRequest(req as any);
  assertEquals(wandbReq.tool_choice, "auto");
});

Deno.test("function_call конвертируется в tool_choice", async () => {
  const req = {
    model: "gpt-4",
    messages: [{ role: "user", content: "Привет" }],
    functions: [{ name: "f", description: "x", parameters: {} }],
    function_call: { name: "f" }
  };
  const wandbReq = buildWandBRequest(req as any);
  assertEquals(wandbReq.tool_choice, { type: "function", function: { name: "f" } });
});

Deno.test("добавляется system-сообщение по умолчанию если нет", async () => {
  const req = {
    model: "gpt-4",
    messages: [{ role: "user", content: "Привет" }]
  };
  const wandbReq = buildWandBRequest(req as any);
  assertEquals(wandbReq.messages[0].role, "system");
});

// --- Strict mode (PROXY_API_KEY) ---

Deno.test("strict: без Authorization → 401", async () => {
  Deno.env.set("PROXY_API_KEY", "proxy-secret");
  try {
    const request = new Request("http://localhost:8000/v1/models");
    const response = await handler(request);
    assertEquals(response.status, 401);
  } finally {
    Deno.env.delete("PROXY_API_KEY");
  }
});

Deno.test("strict: неверный ключ → 401", async () => {
  Deno.env.set("PROXY_API_KEY", "proxy-secret");
  try {
    const request = createRequest("/v1/models", "GET"); // Bearer test-token ≠ proxy-secret
    const response = await handler(request);
    assertEquals(response.status, 401);
  } finally {
    Deno.env.delete("PROXY_API_KEY");
  }
});

Deno.test("strict: верный ключ прокси → 200 и upstream получает серверный WANDB_API_KEY", async () => {
  Deno.env.set("PROXY_API_KEY", "proxy-secret");
  Deno.env.set("WANDB_API_KEY", "wandb-secret");
  let seenAuth = "";
  const orig = globalThis.fetch;
  globalThis.fetch = ((_url: any, init: any) => {
    seenAuth = new Headers(init?.headers).get("Authorization") ?? "";
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ object: "list", data: [] }),
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      body: null as any,
      clone: () => ({} as any)
    });
  }) as any;
  try {
    const request = new Request("http://localhost:8000/v1/models", {
      headers: { "Authorization": "Bearer proxy-secret" }
    });
    const response = await handler(request);
    assertEquals(response.status, 200);
    assertEquals(seenAuth, "Bearer wandb-secret");
  } finally {
    globalThis.fetch = orig;
    Deno.env.delete("PROXY_API_KEY");
    Deno.env.delete("WANDB_API_KEY");
  }
});