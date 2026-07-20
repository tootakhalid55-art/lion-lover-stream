# LionTV — Developer Guide

> Premium Arabic RTL streaming shell built on TanStack Start, React 19,
> Tailwind v4, and TanStack Query. This document is the single entry point
> for anyone extending the codebase.

## 1. Folder Structure

```
src/
├── assets/               Static images (logos, artwork pointers)
├── components/
│   ├── primitives/       Design-system atoms shared across features
│   │                     (GlassPanel, IconBtn, Section, HighlightMatch)
│   └── ui/               shadcn/ui generated primitives
├── features/             Vertical slices — a folder per user-facing feature
│   ├── catalog/          Poster/Continue cards, Row, BadgePill
│   ├── home/             Greeting + Hero carousel
│   ├── navigation/       Header + BottomNav
│   ├── notifications/    Notifications popover
│   ├── player/           Reusable player contract + placeholder shell
│   ├── profile/          Profile popover
│   └── search/           Search popover with category tabs
├── hooks/                Reusable stateful hooks
├── lib/                  Framework-agnostic utilities
│   ├── analytics.ts      Typed event bus
│   ├── i18n.ts           Locale switcher + tiny dictionary
│   ├── storage.ts        Safe namespaced localStorage helpers
│   └── error-*.ts        Error capture + Lovable reporting
├── routes/               File-based routes (TanStack Router)
├── services/api/         Repository/service layer
│   ├── types.ts          Domain types + repository interfaces
│   ├── mock/             Mock implementation used today
│   └── index.ts          Composition root — swap providers here
├── router.tsx            Router factory (per-request QueryClient)
├── start.ts              TanStack Start middleware
└── styles.css            Tailwind v4 tokens, keyframes, utilities
```

## 2. State Management

- **Server state** flows through TanStack Query, seeded from `api.*`
  repositories. Rows, feeds, search suggestions, notifications, favorites,
  etc. all subscribe via `useQuery` (or a loader `ensureQueryData`).
- **Local UI state** is `useState` at the leaf.
- **User preferences** (nav tab, recent searches, future favorites/watch
  history) persist through `usePersistentState` → `lib/storage.ts` under
  the `liontv:` namespace. This survives reloads and hydrates safely on SSR.
- **Optimistic updates**: mutations (e.g. mark notifications read, favorite
  toggle) update local state immediately and fire the repository call in
  the background.

## 3. API / Repository Layer

Everything backend-shaped is behind `src/services/api/types.ts`. Each
domain has an interface (`HomeRepository`, `SearchRepository`,
`PlaybackRepository`, …) and a mock implementation under `services/api/mock/`.

Consumers import from `@/services/api` only:

```ts
import { api } from "@/services/api";
const feed = await api.home.getFeed();
```

To connect a real backend:

1. Create `src/services/api/http/` (or `supabase/`, `graphql/`).
2. Implement each repository against your transport.
3. Aggregate them in a single `Api` object.
4. Swap the export in `src/services/api/index.ts`.

Zero UI changes required.

## 4. Player Contract

`src/features/player/types.ts` defines the player surface: HLS/DASH,
Widevine/FairPlay/PlayReady DRM, audio/subtitle tracks, quality levels,
resume position, intro/credits ranges. The current `Player.tsx` is a
placeholder that returns a poster region — replace its body with hls.js
or Shaka Player when the streaming backend is live. The prop shape
already covers Picture-in-Picture, fullscreen, playback speed selection,
subtitle switching, and the "Skip Intro" / next-episode countdown hooks.

## 5. Analytics Event Layer

`src/lib/analytics.ts` exposes a typed event bus with no external
dependency. Components call `track({ name: "poster_clicked", posterId, row })`.
In development a console-logger subscriber is auto-wired via `bootstrap()`
in `routes/index.tsx`; in production the bus is silent until a subscriber
is added. Wire real providers (PostHog, Amplitude, Segment) in one place.

## 6. Design System

- Tokens live in `src/styles.css` (`@theme inline` block). Colors use OKLCH,
  spacing uses `--radius` scale, animations use `@keyframes` + `@theme`
  animation vars.
- All colors are semantic (`bg-background`, `text-foreground`,
  `bg-nav-active`, `bg-pill`, `text-brand`). Do NOT hardcode
  `text-white`/`bg-black`/`bg-[#...]`; those bypass dark mode and
  high-contrast theming.
- Reduced-motion and prefers-contrast media queries are in `styles.css`.

## 7. Routing

Single route today (`/`). New sections must live as top-level route files
under `src/routes/` (`about.tsx`, `movies.tsx`, etc.) — never as
hash-anchors — so each gets its own SSR HTML, head metadata, and
analytics pageview. The `__root.tsx` shell owns the `<html>` + fonts +
manifest + theme-color; leaf routes own their own head.

## 8. Accessibility

- Semantic landmarks: single `<main>`, `<nav>`, `<header>`, section
  labels, skip-to-content link.
- All icon-only buttons have `aria-label`.
- Popovers close on outside click + Escape (`useDismiss`).
- Full keyboard focus rings via `focus-visible:ring-nav-active`.
- `prefers-reduced-motion` and `prefers-contrast` are honored in CSS.
- Poster progress bars are true `role="progressbar"` with min/max/now.

## 9. Performance

- Route-level code splitting via TanStack Router's `autoCodeSplitting`.
- Poster cards defer heavy rendering behind `useInView` + skeleton
  shimmer; only the first 3 in each row render eagerly (LCP row).
- Fonts preconnect + `display=swap`.
- Reduced-motion short-circuits the Ken Burns and rotating hero.
- `momentum` + `snap-row` CSS utilities give iOS-quality scroll.
- No layout shifts: images use fixed aspect ratios; skeletons match final
  card dimensions.

## 10. PWA

`public/manifest.webmanifest` provides installability (Add to Home Screen).
No service worker is registered — offline behavior is scoped for a future
`vite-plugin-pwa` pass per the platform PWA skill.

## 11. Security

- All user input flows through validated forms (Zod recommended); avoid
  `dangerouslySetInnerHTML`.
- Storage helpers namespace and swallow exceptions.
- The repository layer is the only injection point for auth tokens — do
  not read tokens from components.
- CSP headers should be added at the deploy layer.

## 12. Build & Environment

- `bun run dev` — local Vite dev server (port 8080).
- `bun run build` — production build; typecheck runs automatically.
- Environment variables:
  - `VITE_*` — exposed to the client bundle.
  - Everything else is server-only and must be read inside a server
    function's `.handler()` body.

## 13. Extending the App

Adding a new feature slice:

1. Create `src/features/<name>/` with components, hooks, and a `types.ts`.
2. If the feature needs data, add its interface + mock to
   `src/services/api/`.
3. Wire the feature into a route under `src/routes/`.
4. Emit analytics events from user actions via `track({ name: ... })`.
5. Persist any user-facing preference with `usePersistentState`.
