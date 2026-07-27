// Тестовые данные

export const mockWandBResponse = {
  id: "chatcmpl-123456789",
  object: "chat.completion",
  created: 1701234567,
  model: "gpt-4",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: "Hello! I'm an AI assistant ready to help you."
      },
      finish_reason: "stop"
    }
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 12,
    total_tokens: 22
  }
};

export const mockWandBStreamResponse = {
  id: "chatcmpl-123456789",
  object: "chat.completion.chunk",
  created: 1701234567,
  model: "gpt-4",
  choices: [
    {
      index: 0,
      delta: { content: "Hello" },
      finish_reason: null
    }
  ]
};

export const mockModelListResponse = {
  object: "list",
  data: [
    {
      id: "gpt-4",
      object: "model",
      created: 1677610602,
      owned_by: "openai"
    },
    {
      id: "gpt-3.5-turbo",
      object: "model",
      created: 1677610602,
      owned_by: "openai"
    }
  ]
};

export const validOpenAIRequest = {
  model: "gpt-4",
  messages: [
    { role: "user", content: "Hello, how are you?" }
  ],
  max_tokens: 100
};

export const validOpenAIStreamRequest = {
  model: "gpt-4",
  messages: [
    { role: "user", content: "Tell me a story" }
  ],
  stream: true,
  max_tokens: 50
};

export const invalidRequest_noModel = {
  messages: [
    { role: "user", content: "Hello" }
  ]
};

export const invalidRequest_noMessages = {
  model: "gpt-4"
};