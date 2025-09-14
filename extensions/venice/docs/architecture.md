# Architecture

This extension is a local‑first Raycast app that talks directly to the Venice API.

## Commands
- Chat (`src/chat.tsx`): main chat surface with model picker, streaming messages, slash commands, and image mode.
- Conversations (`src/conversations.tsx`): searchable history with actions (open, rename, delete, export Markdown).
- Models (`src/models.tsx`): list available models with details and select default.
- Model Settings (`src/model-settings.ts`): advanced params (temperature, top_p, top_k, max_tokens; image params when applicable).

## Directory Structure
- `src/api/` – Venice API client wrappers (models, chat stream, images, upscaling).
- `src/components/` – small reusable UI pieces (message bubbles, toolbar, badges).
- `src/hooks/` – `useModels`, `useChat`, `useConversations`, `useImages`.
- `src/storage/` – local persistence (conversations, images metadata) and caches.
- `src/utils/` – helpers (format, time, markdown export, slash parser, debounce).
- `src/types.ts` – shared TypeScript types.

## Data Model (summary)
- `VeniceModel`: { id, name, description, capabilities: ("chat"|"image")[], contextWindow?, default? }
- `ModelSettings`: { temperature, topP, topK, maxTokens }
- `ChatMessage`: { id, conversationId, role: "system"|"user"|"assistant"|"tool", content, createdAt, attachments? }
- `Conversation`: { id, title, modelId, createdAt, updatedAt, messageCount }
- `ImageAsset`: { id, conversationId?, prompt, modelId, filePath, size, createdAt, metadata }

## Persistence (local only)
- Conversations + messages: Raycast `LocalStorage` (JSON chunks keyed by conversation id). Large blobs (images) are stored under `environment.supportPath` with file references in metadata.
- Models cache: Raycast `Cache` with TTL and background refresh.
- Preferences: API key(s) and defaults via Raycast `preferences` with secure storage (Keychain).

## Networking
- Base URL: Venice API.
- Only two categories of calls:
  1) Metadata: models list (cached, periodic refresh).
  2) Inference: chat completion (streaming) and image generation/upscaling.
- If a personal key is not set, obtain a limited‑use token via a proxy endpoint (token only). All inference calls go directly to Venice.

## Streaming
- Chat responses stream token chunks. UI accumulates partial text and renders progressively with a caret animation.
- Abortable via `AbortController` when the user navigates, cancels, or sends a new prompt.

## Search & Index
- Maintain per‑conversation searchable text (title + last N messages) for fast local search in the Conversations list.

## Auto‑naming
- After first assistant reply, send a cheap summarization request to Venice to produce a concise title.

## Images
- Generation: choose count, model, and params. Render inline in Chat with actions: Download, Copy, Reveal in Finder, Upscale.
- Upscaling: call Venice upscale; optionally replace or append variants and update metadata.
- Search: by prompt substrings and date.

## Slash Commands (composer)
- `/model <query>` – quick model switch.
- `/temp <0..2>` – adjust temperature.
- `/image` – switch to image mode.
- Additional commands are parsed client‑side before sending.

## Export
- Export a conversation to Markdown (messages rendered with roles and timestamps). Save to a file or copy to clipboard.

## Error Handling
- Toast on transient errors; retry action; show friendly messages.
- Abort ongoing requests when navigating away.

## Performance
- `useCachedPromise` for models and expensive calls.
- Debounced searches; batched state updates during streaming.
- Avoid storing massive blobs in `LocalStorage`; use file system for images.

## Store Compliance
- README, privacy, and permission docs.
- No data sent anywhere except Venice; proxy only issues temporary tokens.
