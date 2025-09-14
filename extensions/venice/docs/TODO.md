# Venice Raycast Extension – TODO

Source of truth for implementation tasks. Keep updated as work progresses.

## Scope

Local-first AI chat and image generation for Raycast using the Venice API.

## Tasks

- [ ] Create Raycast best-practices reference and keep updated
- [ ] Design extension architecture and data model (messages, conversations, images)
- [ ] Implement Venice API client with streaming and types
- [ ] Add secure API key preference with Keychain and default fallback key
- [ ] Implement models fetch, cache, and periodic refresh
- [ ] Add Models list command with details and select-as-default
- [ ] Integrate model picker inside Chat command
- [ ] Build Chat UI with streaming responses and message composer
- [ ] Persist conversations locally and support continuation
- [ ] Auto-name conversations using Venice summarize and fallback heuristic
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
- [ ] Implement performance optimizations and caching (useCachedPromise/state)
- [ ] Add robust error handling, retries, and abort on navigation
- [ ] Prepare for Raycast Store submission (README, metadata, privacy)
- [ ] Add scripts for typecheck, build, lint, and CI sanity

## Notes

- All data stays local using Raycast `LocalStorage`, `Cache`, and `preferences` APIs.
- Network calls only hit Venice API endpoints.
- Optimize rendering and network with caching and streaming.
