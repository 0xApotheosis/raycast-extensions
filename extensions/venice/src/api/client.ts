import { getPreferenceValues } from "@raycast/api";
import type { VeniceModel, StreamChunk } from "../types";

type Preferences = {
  veniceApiKey?: string;
  useDefaultToken?: boolean;
  defaultTokenProxy?: string; // Endpoint that returns a short-lived token
};

export class VeniceClient {
  private apiKey: string | undefined;
  private baseUrl = "https://api.venice.ai"; // placeholder; adjust if different

  constructor() {
    const prefs = getPreferenceValues<Preferences>();
    this.apiKey = prefs.veniceApiKey;
  }

  private async getAuthHeader(): Promise<string> {
    const prefs = getPreferenceValues<Preferences>();
    if (this.apiKey && this.apiKey.length > 0) return `Bearer ${this.apiKey}`;
    if (prefs.useDefaultToken && prefs.defaultTokenProxy) {
      const resp = await fetch(prefs.defaultTokenProxy, { method: "GET" });
      if (!resp.ok) throw new Error(`Proxy token failed: ${resp.status}`);
      const { token } = (await resp.json()) as { token: string };
      return `Bearer ${token}`;
    }
    throw new Error("No Venice API key configured");
  }

  async listModels(): Promise<VeniceModel[]> {
    const auth = await this.getAuthHeader();
    const resp = await fetch(`${this.baseUrl}/models`, {
      headers: { Authorization: auth },
    });
    if (!resp.ok) throw new Error(`List models failed: ${resp.status}`);
    const data = (await resp.json()) as VeniceModel[];
    return data;
  }

  async streamChat(args: {
    model: string;
    messages: { role: string; content: string }[];
    settings?: { temperature?: number; top_p?: number; top_k?: number; max_tokens?: number };
    signal?: AbortSignal;
    onChunk: (chunk: StreamChunk) => void;
  }): Promise<void> {
    const auth = await this.getAuthHeader();
    const resp = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: args.model,
        messages: args.messages,
        stream: true,
        ...args.settings,
      }),
      signal: args.signal,
    });
    if (!resp.ok || !resp.body) throw new Error(`Chat stream failed: ${resp.status}`);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        args.onChunk({ type: "text", data: text });
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
  }): Promise<{ images: string[] }>{
    const auth = await this.getAuthHeader();
    const resp = await fetch(`${this.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: args.model, prompt: args.prompt, n: args.n, size: args.size }),
    });
    if (!resp.ok) throw new Error(`Image generation failed: ${resp.status}`);
    return (await resp.json()) as { images: string[] };
  }

  async upscaleImage(args: { model: string; imageUrl: string }): Promise<{ image: string }>{
    const auth = await this.getAuthHeader();
    const resp = await fetch(`${this.baseUrl}/images/upscale`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    if (!resp.ok) throw new Error(`Upscale failed: ${resp.status}`);
    return (await resp.json()) as { image: string };
  }
}
