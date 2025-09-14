# Venice Raycast Extension

Chat with Venice AI, fully local-first. No data leaves your device except API requests directly to Venice.

## Development

- Node 18+
- Raycast CLI installed (`brew install raycast` or see docs)
- Commands:
  - `npm run dev` – develop locally
  - `npm run build` – build
  - `npm run lint` – lint using Raycast ESLint config
  - `npm run fix-lint` – auto-fix lint issues

## Store Requirements

We follow Raycast Store checklist: `docs/raycast-best-practices.md`.

## Privacy

- All data (conversations, settings, images metadata) are stored locally using Raycast APIs.
- Only requests to Venice API are sent over the network.
