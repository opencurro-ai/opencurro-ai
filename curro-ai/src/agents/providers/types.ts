/** A single streamed delta from the provider. */
export interface StreamDelta {
  text?: string;
  reasoning?: string;
  toolCalls?: ToolCallDelta[];
  finishReason?: string | null;
}

/** Incremental tool-call fragment as emitted by OpenAI-style streaming. */
export interface ToolCallDelta {
  index: number;
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

/** Fully-formed tool call after merging deltas. */
export interface ToolCall {
  id: string | null;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ProviderModel {
  id: string;
  provider: string;
  label: string;
  owned_by?: string | null;
  context_window?: number | null;
}

export interface ProviderMetadata {
  id: string;
  label: string;
  defaultBaseUrl: string;
  /** Extra headers appended on every request (e.g. attribution headers). */
  extraHeaders?: Record<string, string>;
}

export interface ChatCompletionOptions {
  apiKey: string;
  model: string;
  messages: Array<Record<string, unknown>>;
  tools: unknown[];
  baseUrl?: string;
  temperature?: number;
  signal?: AbortSignal;
}

/** Common interface implemented by every provider. */
export interface Provider {
  readonly metadata: ProviderMetadata;
  listModels(apiKey: string, baseUrl?: string): Promise<ProviderModel[]>;
  streamChatCompletion(options: ChatCompletionOptions): AsyncGenerator<StreamDelta, void, unknown>;
}
