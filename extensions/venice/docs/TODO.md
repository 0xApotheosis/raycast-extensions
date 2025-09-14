# Venice Raycast Extension – TODO

Source of truth for implementation tasks. Keep updated as work progresses.

## Scope

Local-first AI chat and image generation for Raycast using the Venice API.

### Platform & Constraints
- Target: macOS (Raycast desktop)
- Language: TypeScript (strict), functional React components
- Privacy: All data stored locally (Raycast `LocalStorage`, `Cache`, `preferences`, optional files under `environment.supportPath`).
- Networking: Only Venice API endpoints are called for inference.
- Default Usage: If no personal key is set, obtain a limited-use token via a proxy endpoint you provide (used only to retrieve a token; chat/image content must NOT be routed through the proxy).

### Functional Requirements
- Chat with streaming responses; continue conversations.
- Dynamic models list from Venice; cache + periodic refresh; auto-select first model.
- Models filtered by capability: chat models for chat; image models for image.
- Local chat history with search; conversations auto-named by a cheap Venice summarization call.
- Model picker in Chat and a dedicated Models list view with details.
- Advanced settings for model parameters (temperature, top_p, top_k, max_tokens, and image-specific params where applicable).
- API key preferences: personal key stored securely; fallback to limited default usage via proxy-issued token.
- “Powered by Venice” badge on entry screen.
- Subtle animations/spinners for a polished UX.
- Image generation with configurable count, inline rendering, download, upscaling, and prompt-based search.
- Extra UX: export conversation as Markdown, quick actions (copy last response, regenerate), and slash-commands in the composer.

## Tasks

- [ ] Create Raycast best-practices reference and keep updated
- [ ] Design extension architecture and data model (messages, conversations, images)
- [ ] Implement Venice API client with streaming and types
- [ ] Add secure API key preference with Keychain and default fallback via proxy-issued token
- [ ] Implement models fetch, cache, and periodic refresh
- [ ] Filter models by capability (chat vs image) and surface accordingly
- [ ] Add Models list command with details and select-as-default
- [ ] Integrate model picker inside Chat command
- [ ] Build Chat UI with streaming responses and message composer
- [ ] Persist conversations locally and support continuation
- [ ] Auto-name conversations using cheap Venice summarization
- [ ] Create Conversations list with search and actions
- [ ] Create Advanced Model Settings form (temperature, top_p, top_k, max_tokens)
- [ ] Add Powered by Venice badge and about info
- [ ] Add subtle animations/loading indicators and polished UX
- [ ] Implement image generation: prompt to images via Venice models
- [ ] Render images inline in chat with download action
- [ ] Add image upscaling via Venice and replace/append results
- [ ] Support choosing number of images to generate
- [ ] Index and search generated images by prompt and metadata
- [ ] Verify ESLint + Prettier configuration and Raycast lint rules
- [ ] Enable TypeScript strict mode and resolve types
- [ ] Implement performance optimizations and caching (useCachedPromise/state)
- [ ] Add robust error handling, retries, and abort on navigation
- [ ] Prepare for Raycast Store submission (README, metadata, privacy)
- [ ] Add scripts for typecheck, build, lint, and CI sanity
- [ ] Export/share a conversation as Markdown
- [ ] Add Quick Actions to copy last response or regenerate
- [ ] Implement slash-commands in composer (e.g., /model, /temp, /image)

## Notes

- All data stays local using Raycast `LocalStorage`, `Cache`, and `preferences` APIs.
- Network calls only hit Venice API endpoints.
- Optimize rendering and network with caching and streaming.
 - The default-usage proxy MUST only issue a temporary token; no prompts or images are posted to it.
 - Auto-select the first model returned by Venice as default.
