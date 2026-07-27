// OpenAI API Types

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

// Дельта tool_call в SSE-стриме: поля приходят частично по чанкам,
// index обязателен, остальные — опциональны.
export interface ToolCallDelta {
  index: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "function" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIChoice {
  index: number;
  message: {
    role: string;
    content: string | null;
    tool_calls?: ToolCall[];
  };
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "function_call" | null;
}

export interface OpenAIChoiceStream {
  index: number;
  delta: {
    role?: string;
    content?: string | null;
    tool_calls?: ToolCallDelta[];
    function_call?: {
      name?: string;
      arguments?: string;
    };
  };
  finish_reason: string | null;
}

export interface OpenAICompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  system_fingerprint: string;
}

export interface OpenAIStreamResponse {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: OpenAIChoiceStream[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  system_fingerprint: string;
}


export interface OpenAIChatCompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  prompt?: string;
  tools?: OpenAITool[];
  tool_choice?: "auto" | "none" | "required" | {
    type: "function";
    function: { name: string };
  };
  functions?: OpenAICompatibleFunction[];
  function_call?: "auto" | "none" | {
    name: string;
  };
}

export interface OpenAITool {
  type: "function";
  function: OpenAICompatibleFunction;
}

export interface OpenAICompatibleFunction {
  name: string;
  description?: string;
  parameters: object;
}

// WandB API Types

export interface WandBChatCompletionRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string | null;
    tool_call_id?: string;
    tool_calls?: ToolCall[];
  }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  tools?: OpenAITool[];
  tool_choice?: string | object;
}

export interface WandBChoice {
  index: number;
  message: {
    role: string;
    content: string | null;
    tool_calls?: ToolCall[];
  };
  finish_reason: string | null;
}

export interface WandBStreamChoice {
  index: number;
  delta: {
    role?: string;
    content?: string | null;
    tool_calls?: ToolCallDelta[];
  };
  finish_reason: string | null;
}

export interface WandBCompletionResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices: WandBChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface WandBStreamResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices: WandBStreamChoice[];
}

// Model Types

export interface ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface ModelListResponse {
  object: string;
  data: ModelInfo[];
}
