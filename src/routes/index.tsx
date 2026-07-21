import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/services/api";
import { Header } from "@/features/navigation/Header";
import { BottomNav } from "@/features/navigation/BottomNav";
import { Greeting } from "@/features/home/Greeting";
import { Hero } from "@/features/home/Hero";
import { Row } from "@/features/catalog/Row";
import { bootstrap, track } from "@/lib/analytics";
import { useQuery } from "@tanstack/react-query";
import { RouteError } from "@/components/RouteError";

/**
 * Home route. All heavy lifting lives in feature modules; this file only
 * composes them, fetches the home feed through the API layer, and emits
 * the home_viewed analytics event.
 */
export const Route = createFileRoute("/")({
  component: LionTV,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/index.tsx" functionName="LionTV" lineNumber={25} />
  ),
});

// Ensure the dev-mode analytics logger is only wired once per session.
let analyticsBooted = false;

function LionTV() {
  const { data: feed } = useQuery({
    queryKey: ["home-feed"],
    queryFn: () => api.home.getFeed(),
    throwOnError: true,
  });

  useEffect(() => {
    if (!analyticsBooted) {
      bootstrap();
      analyticsBooted = true;
    }
    track({ name: "home_viewed" });
  }, []);

  return (
    <div className="min-h-dvh bg-background text-foreground pb-32">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:right-3 focus:z-50 focus:rounded-md focus:bg-nav-active focus:px-3 focus:py-1.5 focus:text-neutral-900"
      >
        تخطي إلى المحتوى
      </a>
      <Header />
      <main id="main" className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 space-y-10 lg:space-y-14">
        <Greeting />
        {feed && <Hero heroes={feed.heroes} />}
        {feed && feed.continueWatching.length > 0 && (
          <Row id="row-continue" title="متابعة المشاهدة" items={feed.continueWatching} variant="continue" />
        )}
        {feed?.rows.map((r) => (
          <Row key={r.id} id={r.id} title={r.title} items={r.items} />
        ))}
      </main>
      <BottomNav />
    </div>
  );
}
