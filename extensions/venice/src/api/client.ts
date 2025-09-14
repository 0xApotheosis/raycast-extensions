import { getPreferenceValues } from "@raycast/api";
import type { VeniceModel, StreamChunk, VeniceCapability } from "../types";

type Preferences = {
  veniceApiKey?: string;
};

export class VeniceClient {
  private apiKey: string | undefined;
  private baseUrl: string;
  private proxyMode: boolean;

  constructor() {
    const prefs = getPreferenceValues<Preferences>();
    this.apiKey = prefs.veniceApiKey;
    this.baseUrl = "https://venice.anteambulo.dev/api/v1";
    this.proxyMode = true;
  }

  private async getAuthHeader(): Promise<string | undefined> {
    const key = this.apiKey;
    return key && key.length > 0 ? `Bearer ${key}` : undefined;
  }

  async listModels(
    type: "all" | "text" | "image" | "tts" | "embedding" | "upscale" | "inpaint" = "all",
  ): Promise<VeniceModel[]> {
    const auth = await this.getAuthHeader();
    const url = new URL(`${this.baseUrl}/models`);
    if (type && type !== "all") url.searchParams.set("type", type);
    const headers: Record<string, string> = {};
    if (auth) headers["Authorization"] = auth;
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
    const auth = await this.getAuthHeader();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    };
    if (auth) headers["Authorization"] = auth;
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
  }): Promise<{ images: string[] }> {
    const auth = await this.getAuthHeader();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (auth) headers["Authorization"] = auth;
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
    const auth = await this.getAuthHeader();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (auth) headers["Authorization"] = auth;
    if (this.proxyMode) headers["X-App"] = "venice-raycast";
    const resp = await fetch(`${this.baseUrl}/image/upscale`, {
      method: "POST",
      headers,
      body: JSON.stringify(args),
    });
    if (!resp.ok) throw new Error(`Upscale failed: ${resp.status}`);
    return (await resp.json()) as { image: string };
  }
}
