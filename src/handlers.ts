import {
  OpenAIChatCompletionRequest,
  OpenAICompletionResponse,
  WandBCompletionResponse,
  WandBStreamResponse,
  ModelListResponse
} from "./types.ts";
import {
  transformNonStreamResponse,
  transformStreamChunk,
  transformModelList,
  buildWandBRequest
} from "./transformers.ts";
import { CONFIG } from "../config.ts";

function markdownToHtml(markdown: string): string {
  // правила конвертации
  let html = markdown
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
    .replace(/^##### (.*$)/gim, '<h5>$1</h5>')
    .replace(/^###### (.*$)/gim, '<h6>$1</h6>')
    .replace(/^\*\*([^*].*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/^\*([^*].*?)\*/gim, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>')
    .replace(/^> (.*$)/gim, '<blockquote><p>$1</p></blockquote>')
    .replace(/^\* (.*$)/gim, '<ul><li>$1</li></ul>')
    .replace(/^\d+\. (.*$)/gim, '<ol><li>$1</li></ol>')
    .replace(/\n\n/gim, '</p><p>')
    .replace(/\n/gim, '<br />');
  
  // код-блоки
  html = html.replace(/```([a-z]*)\n([\s\S]*?)```/gim, '<pre><code class="language-$1">$2</code></pre>');
  
  // инлайн-код
  html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');
  
  return `<p>${html}</p>`;
}

function createHtmlPage(content: string): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wandb OpenAI Proxy</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1, h2, h3 { color: #2c3e50; }
    code { background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px; font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; }
    pre { background-color: #f4f4f4; padding: 12px; border-radius: 5px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #ddd; padding: 0 15px; color: #777; }
    a { color: #3498db; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
}

export async function handleRootRequest(): Promise<Response> {
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Погода в Москве</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      color: white;
    }
    .card {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 40px;
      width: 360px;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    .city { font-size: 28px; font-weight: 600; margin-bottom: 8px; }
    .date { font-size: 14px; opacity: 0.8; margin-bottom: 20px; }
    .temp { font-size: 64px; font-weight: 300; margin-bottom: 10px; }
    .desc { font-size: 18px; opacity: 0.9; margin-bottom: 20px; }
    .details { display: flex; justify-content: space-around; }
    .detail-item { text-align: center; }
    .detail-label { font-size: 12px; opacity: 0.7; }
    .detail-value { font-size: 18px; font-weight: 500; }
    .footer { margin-top: 24px; font-size: 11px; opacity: 0.4; }
    .update-btn {
      margin-top: 20px;
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.3);
      color: white;
      padding: 8px 24px;
      border-radius: 20px;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.3s;
    }
    .update-btn:hover { background: rgba(255,255,255,0.3); }
  </style>
</head>
<body>
  <div class="card">
    <div class="city">📍 Москва</div>
    <div class="date" id="date"></div>
    <div class="temp" id="temp">--°C</div>
    <div class="desc" id="desc">Загрузка...</div>
    <div class="details">
      <div class="detail-item">
        <div class="detail-label">Влажность</div>
        <div class="detail-value" id="humidity">--%</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Ветер</div>
        <div class="detail-value" id="wind">-- м/с</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Давление</div>
        <div class="detail-value" id="pressure">-- мм</div>
      </div>
    </div>
    <button class="update-btn" onclick="updateWeather()">🔄 Обновить</button>
    <div class="footer">Moscow Weather • данные с Open-Meteo</div>
  </div>
  <script>
    async function updateWeather() {
      try {
        const resp = await fetch('https://api.open-meteo.com/v1/forecast?latitude=55.75&longitude=37.62&current_weather=true&hourly=relative_humidity_2m,surface_pressure&forecast_days=1&timezone=Europe/Moscow');
        const data = await resp.json();
        const w = data.current_weather;
        const h = new Date().getHours();
        document.getElementById('temp').textContent = Math.round(w.temperature) + '°C';
        document.getElementById('desc').textContent = w.weathercode === 0 ? 'Ясно' : w.weathercode < 3 ? 'Облачно' : 'Пасмурно';
        document.getElementById('humidity').textContent = (data.hourly?.relative_humidity_2m?.[h] ?? '--') + '%';
        document.getElementById('wind').textContent = Math.round(w.windspeed) + ' м/с';
        document.getElementById('pressure').textContent = data.hourly?.surface_pressure?.[h] ? Math.round(data.hourly.surface_pressure[h] * 0.75) + ' мм' : '-- мм';
      } catch(e) {
        document.getElementById('desc').textContent = 'Ошибка загрузки';
      }
    }
    document.getElementById('date').textContent = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    updateWeather();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}


export async function handleModelsRequest(
  authHeader: string,
  request: Request
): Promise<Response> {
  try {
    const resp = await fetch(`${CONFIG.wandbBaseUrl}/v1/models`, {
      headers: {
        "Authorization": authHeader,
        "User-Agent": "OpenAI/NodeJS/4.0.0"
      }
    });

    if (!resp.ok) {
      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: resp.headers
      });
    }

    const wandbModels = await resp.json();
    const standardized = transformModelList(wandbModels.data || []);

    return new Response(JSON.stringify(standardized), {
      status: resp.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (error) {
    return createErrorResponse(error, 500);
  }
}

export async function handleChatCompletionsRequest(
  authHeader: string,
  request: Request
): Promise<Response> {
  const contentType = request.headers.get("Content-Type");
  if (!contentType || !contentType.includes("application/json")) {
    return createErrorResponse(
      "Unsupported Media Type, expected application/json",
      415
    );
  }

  let originalRequestBody;
  try {
    originalRequestBody = await request.json();
  } catch (e) {
    return createErrorResponse("Invalid JSON", 400);
  }

  if (!originalRequestBody.model) {
    return createErrorResponse("Missing required field: model", 400);
  }

  if (!Array.isArray(originalRequestBody.messages) && !originalRequestBody.prompt) {
    return createErrorResponse("Missing messages or prompt field", 400);
  }

  const wandbRequestBody = buildWandBRequest(originalRequestBody);

  if (originalRequestBody.stream) {
    return handleStreamRequest(wandbRequestBody, authHeader);
  }

  return handleNonStreamRequest(wandbRequestBody, authHeader, originalRequestBody.model);
}

async function handleNonStreamRequest(
  wandbRequestBody: any,
  authHeader: string,
  originalModel: string
): Promise<Response> {
  try {
    const resp = await fetch(`${CONFIG.wandbBaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
        "User-Agent": "OpenAI/NodeJS/4.0.0"
      },
      body: JSON.stringify(wandbRequestBody)
    });

    if (!resp.ok) {
      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: resp.headers
      });
    }

    const wandbResponse = await resp.json() as WandBCompletionResponse;
    const standardized = transformNonStreamResponse(wandbResponse, originalModel);

    return new Response(JSON.stringify(standardized), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    });
  } catch (error) {
    return createErrorResponse(error, 500);
  }
}

async function handleStreamRequest(
  wandbRequestBody: any,
  authHeader: string
): Promise<Response> {
  try {
    const upstreamResponse = await fetch(`${CONFIG.wandbBaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
        "User-Agent": "OpenAI/NodeJS/4.0.0"
      },
      body: JSON.stringify(wandbRequestBody)
    });

    if (!upstreamResponse.ok) {
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: upstreamResponse.headers
      });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    return new Response(
      new ReadableStream({
        async start(controller) {
          const reader = upstreamResponse.body!.getReader();
          let buffer = "";

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (line.trim() === "") continue;

                if (line.trim() === "data: [DONE]") {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  continue;
                }

                if (line.startsWith("data:")) {
                  try {
                    const raw = JSON.parse(line.slice(5));
                    const std = transformStreamChunk(raw, wandbRequestBody.model);
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify(std)}\n\n`)
                    );
                  } catch {
                    // Пропускаем строки которые не парсятся
                  }
                }
              }
            }

            if (buffer.includes("[DONE]")) {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            }
          } catch (err) {
            // клиент разорвал соединение — выходим
          } finally {
            try { controller.close(); } catch { /* уже закрыт */ }
            try { reader.releaseLock(); } catch { /* уже освобождён */ }
          }
        }
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no"
        }
      }
    );
  } catch (error) {
    return createErrorResponse(error, 500);
  }
}

function createErrorResponse(error: unknown, status: number): Response {
  const message = error instanceof Error ? error.message : String(error);
  return new Response(
    JSON.stringify({ 
      error: { 
        message, 
        type: "api_error" 
      } 
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}
