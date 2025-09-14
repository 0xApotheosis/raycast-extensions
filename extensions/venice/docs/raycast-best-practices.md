# Raycast Best Practices (Reference)

This file is our living checklist. Follow it for all edits.

## UX & Performance
- Prefer `List`, `Detail`, and `Form` for primary UIs; avoid custom heavy components.
- Use `useCachedPromise`, `usePromise`, or `useCachedState` for data fetching and caching.
- Debounce searches; avoid firing network calls on each keystroke.
- Use `ActionPanel` with keyboard shortcuts; provide sensible defaults.
- Keep render trees small; memoize large lists with stable `key`s.
- Stream responses with incremental UI updates; avoid long blocking operations on the main thread.

## Data & Privacy
- Store data locally only: `LocalStorage`, `Cache`, `preferences`, and `environment.supportPath` files.
- Never log sensitive data; avoid arbitrary `console.log` in production.
- Respect `networkAccess` requirements and document endpoints.

## Error Handling
- Show `Toast` for transient errors; `Alert` for destructive actions.
- Provide retry actions; support cancel via `AbortController`.
- Use type-safe error envelopes; surface friendly messages.

## Configuration
- Define preferences in `package.json` for API key and defaults.
- Validate preferences at runtime and show a `Form` to fix issues.

## Accessibility
- Use icons and accessory text; ensure keyboard shortcuts for major actions.
- Provide `tooltip` text and meaningful action titles.

## Store Submission
- Follow [Prepare an extension for Store](https://developers.raycast.com/basics/prepare-an-extension-for-store).
- Include clear `README`, permissions, privacy, and testing notes.
- Use semantic versioning in `CHANGELOG.md`.

## Coding Standards
- TypeScript strict mode; no `any`.
- ESLint with `@raycast/eslint-config`; Prettier for formatting.
- Functional components, hooks, and small, composable modules.
- Avoid large files; extract `utils/`, `api/`, `components/`.

## Testing & QA
- Manual walkthrough of commands; verify streaming, cancellations, preferences.
- Validate no data is sent anywhere except Venice API.

## Animations
- Use `Icon` state changes, spinners, and subtle timing; avoid flashy effects.
