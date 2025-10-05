import { getPreferenceValues } from "@raycast/api";

import type { VeniceModel, StreamChunk, VeniceCapability, VeniceParameters } from "../types";

type Preferences = {
  veniceApiKey?: string;
};

export class VeniceClient {
  private apiKey: string | undefined;
  private baseUrl: string;
  private proxyMode: boolean;
  private static instance: VeniceClient | null = null;

  constructor() {
    getPreferenceValues<Preferences>();
    this.apiKey = undefined; // Always use proxy
    this.baseUrl = "https://venice.anteambulo.dev/api/v1";
    this.proxyMode = true;
  }

  /**
   * Get the singleton instance of VeniceClient
   */
  static getInstance(): VeniceClient {
    if (!VeniceClient.instance) {
      VeniceClient.instance = new VeniceClient();
    }
    return VeniceClient.instance;
  }

  async listModels(
    type: "all" | "text" | "image" | "tts" | "embedding" | "upscale" | "inpaint" = "all",
  ): Promise<VeniceModel[]> {
    // No auth in proxy mode
    const url = new URL(`${this.baseUrl}/models`);
    if (type && type !== "all") url.searchParams.set("type", type);
    const headers: Record<string, string> = {};
    if (this.proxyMode) headers["X-App"] = "venice-raycast";
    const resp = await fetch(url.toString(), { headers });
    if (!resp.ok) throw new Error(`List models failed: ${resp.status}`);
    const payload = (await resp.json()) as {
      data: Array<{
        id: string;
        type: string;
        model_spec?: { name?: string; availableContextTokens?: number; traits?: string[] };
      }>;
    };
    
    if (!Array.isArray(payload.data)) {
      throw new Error("Invalid response format: expected data array");
    }
    const mapTypeToCaps = (t: string): VeniceCapability[] => {
      if (t === "text") return ["chat"];
      if (t === "image" || t === "upscale" || t === "inpaint") return ["image"];
      return ["chat"];
    };
    const models: VeniceModel[] = payload.data.map((m) => ({
      id: m.id,
      name: m.model_spec?.name || m.id,
      description: (m.model_spec?.traits || []).join(", "),
      capabilities: mapTypeToCaps(m.type),
      contextWindow: m.model_spec?.availableContextTokens,
    }));
    return models;
  }

  async streamChat(args: {
    model: string;
    messages: { role: string; content: string }[];
    settings?: { temperature?: number; top_p?: number; top_k?: number; max_tokens?: number };
    signal?: AbortSignal;
    onChunk: (chunk: StreamChunk) => void;
  }): Promise<void> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    };
    // Do not forward Authorization in proxy mode; worker adds it
    if (this.proxyMode) headers["X-App"] = "venice-raycast";
    const resp = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: args.model,
        messages: args.messages,
        stream: true,
        ...args.settings,
      }),
      signal: args.signal,
    });
    if (!resp.ok) {
      const msg = await resp.text().catch(() => "");
      throw new Error(`Chat stream failed: ${resp.status} ${msg}`);
    }
    if (!resp.body) throw new Error("Chat stream failed: empty body");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\n/);
        buffer = lines.pop() ?? ""; // leftover
        
        // Process multiple chunks in a batch to reduce overhead
        const chunks: string[] = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") {
            continue;
          }
          chunks.push(payload);
        }
        
        // Batch process chunks to reduce function call overhead
        for (const payload of chunks) {
          try {
            const json = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const delta = json.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length > 0) {
              args.onChunk({ type: "text", data: delta });
            }
          } catch (error) {
            // Log malformed lines for debugging but don't break the stream
            console.warn("Malformed streaming chunk:", payload, error);
          }
        }
      }
      args.onChunk({ type: "end" });
    } catch (e) {
      args.onChunk({ type: "error", data: (e as Error).message });
      throw e;
    }
  }

  async generateImages(args: {
    model: string;
    prompt: string;
    n: number;
    size?: string;
  }): Promise<{ images: string[] }> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.proxyMode) headers["X-App"] = "venice-raycast";
    const resp = await fetch(`${this.baseUrl}/image/generations`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: args.model, prompt: args.prompt, n: args.n, size: args.size }),
    });
    if (!resp.ok) throw new Error(`Image generation failed: ${resp.status}`);
    return (await resp.json()) as { images: string[] };
  }

  async upscaleImage(args: { model: string; imageUrl: string }): Promise<{ image: string }> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.proxyMode) headers["X-App"] = "venice-raycast";
    const resp = await fetch(`${this.baseUrl}/image/upscale`, {
      method: "POST",
      headers,
      body: JSON.stringify(args),
    });
    if (!resp.ok) throw new Error(`Upscale failed: ${resp.status}`);
    return (await resp.json()) as { image: string };
  }

  async completeChat(args: {
    model: string;
    messages: { role: string; content: string }[];
    settings?: { temperature?: number; top_p?: number; top_k?: number; max_tokens?: number };
    veniceParameters?: VeniceParameters;
  }): Promise<string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.proxyMode) headers["X-App"] = "venice-raycast";

    // Map the settings to the correct parameter names expected by Venice API
    const mappedSettings = args.settings
      ? {
          ...(args.settings.temperature !== undefined && { temperature: args.settings.temperature }),
          ...(args.settings.top_p !== undefined && { top_p: args.settings.top_p }),
          ...(args.settings.top_k !== undefined && { top_k: args.settings.top_k }),
          ...(args.settings.max_tokens !== undefined && { max_tokens: args.settings.max_tokens }),
        }
      : {};

    const resp = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: args.model,
        messages: args.messages,
        stream: false,
        ...mappedSettings,
        ...(args.veniceParameters && { venice_parameters: args.veniceParameters }),
      }),
    });
    if (!resp.ok) {
      const msg = await resp.text().catch(() => "");
      throw new Error(`Chat completion failed: ${resp.status} ${msg}`);
    }
    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("Invalid response format: missing content");
    }
    return content;
  }
}
