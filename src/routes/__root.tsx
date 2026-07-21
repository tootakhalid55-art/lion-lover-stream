import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { buildRuntimeDiagnostic, logRuntimeDiagnostic } from "../lib/runtime-diagnostics";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const diagnostic = buildRuntimeDiagnostic({
    filename: "src/routes/__root.tsx",
    functionName: "ErrorComponent",
    lineNumber: 39,
    error,
  });
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    logRuntimeDiagnostic({
      filename: "src/routes/__root.tsx",
      functionName: "ErrorComponent",
      lineNumber: 39,
      error,
    });
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Runtime exception
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {diagnostic.message}
        </p>
        <dl className="mt-4 space-y-1 rounded-xl bg-white/5 p-3 text-left text-xs text-muted-foreground" dir="ltr">
          <div><dt className="inline font-bold text-foreground">file: </dt><dd className="inline">{diagnostic.filename}</dd></div>
          <div><dt className="inline font-bold text-foreground">function: </dt><dd className="inline">{diagnostic.functionName}</dd></div>
          <div><dt className="inline font-bold text-foreground">line: </dt><dd className="inline">{diagnostic.lineNumber ?? "unknown"}</dd></div>
          <div><dt className="inline font-bold text-foreground">status: </dt><dd className="inline">{diagnostic.httpStatus ?? "n/a"}</dd></div>
          <div><dt className="inline font-bold text-foreground">url: </dt><dd className="inline break-all">{diagnostic.requestUrl}</dd></div>
        </dl>
        {diagnostic.stack && (
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-3 text-left text-[11px] text-foreground/80" dir="ltr">
            {diagnostic.stack}
          </pre>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "LionTV — أفلام ومسلسلات" },
      { name: "description", content: "تطبيق ليون تي في لمشاهدة الأفلام والمسلسلات والبث المباشر" },
      { property: "og:title", content: "LionTV — أفلام ومسلسلات" },
      { property: "og:description", content: "تطبيق ليون تي في لمشاهدة الأفلام والمسلسلات والبث المباشر" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#0b0b0f" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "LionTV" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "twitter:title", content: "LionTV — أفلام ومسلسلات" },
      { name: "twitter:description", content: "تطبيق ليون تي في لمشاهدة الأفلام والمسلسلات والبث المباشر" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e13919d9-20af-44b9-9425-f8ba5262ecbd/id-preview-a54dd680--5ac0b86c-ce48-4d2e-83da-4a74087e7d38.lovable.app-1784589505341.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e13919d9-20af-44b9-9425-f8ba5262ecbd/id-preview-a54dd680--5ac0b86c-ce48-4d2e-83da-4a74087e7d38.lovable.app-1784589505341.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/favicon.ico" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    const RELOAD_KEY = "__chunk_reload_at";
    const isChunkError = (msg: string) =>
      /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|ChunkLoadError/i.test(
        msg,
      );
    const maybeReload = (msg: string) => {
      if (!isChunkError(msg)) return;
      const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
      if (Date.now() - last < 10_000) return;
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      window.location.reload();
    };
    const onError = (e: ErrorEvent) => maybeReload(e.message || String(e.error ?? ""));
    const onRejection = (e: PromiseRejectionEvent) =>
      maybeReload(String((e.reason as { message?: string })?.message ?? e.reason ?? ""));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <HealthBannerLazy />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}

import { lazy, Suspense } from "react";
const HealthBanner = lazy(() =>
  import("../components/HealthBanner").then((m) => ({ default: m.HealthBanner })),
);
function HealthBannerLazy() {
  return (
    <Suspense fallback={null}>
      <HealthBanner />
    </Suspense>
  );
}

