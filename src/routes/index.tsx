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
  head: () => ({
    meta: [
      { title: "LionTV — بث الأفلام والمسلسلات بجودة عالية" },
      { name: "description", content: "استمتع بأحدث الأفلام والمسلسلات والقنوات المباشرة بجودة 4K وHDR على LionTV." },
      { property: "og:title", content: "LionTV — منصة البث الأولى" },
      { property: "og:description", content: "أفلام ومسلسلات وقنوات مباشرة. تجربة مشاهدة سينمائية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LionTV,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/index.tsx" functionName="LionTV" lineNumber={25} />
  ),
});

let analyticsBooted = false;

function LionTV() {
  const { data: feed } = useQuery({
    queryKey: ["home-feed"],
    queryFn: () => api.home.getFeed(),
    throwOnError: true,
  });

  useEffect(() => {
    if (!analyticsBooted) { bootstrap(); analyticsBooted = true; }
    track({ name: "home_viewed" });
  }, []);

  return (
    <div className="relative min-h-dvh text-foreground pb-32 overflow-x-clip">
      {/* Ambient gradient orbs */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-32 -right-32 h-[420px] w-[420px] rounded-full bg-brand/25 blur-[120px] motion-safe:animate-pulse-glow" />
        <div className="absolute top-1/3 -left-40 h-[380px] w-[380px] rounded-full bg-lime/10 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[300px] w-[300px] rounded-full bg-brand/15 blur-[120px]" />
      </div>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:right-3 focus:z-50 focus:rounded-md focus:bg-lime focus:px-3 focus:py-1.5 focus:text-neutral-900"
      >
        تخطي إلى المحتوى
      </a>
      <Header />
      <main id="main" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 space-y-12 lg:space-y-16">
        <Greeting />
        {feed && <Hero heroes={feed.heroes} />}
        {feed && feed.continueWatching.length > 0 && (
          <Row id="row-continue" title="متابعة المشاهدة" items={feed.continueWatching} variant="continue" viewAllTo="/favorites" />
        )}
        {feed?.rows.map((r) => {
          const kind = r.id === "row-new-movies" ? "movies" : r.id === "row-new-series" ? "series" : r.id === "row-live" ? "live" : undefined;
          const viewAllTo = kind ? `/browse/${kind}` : "/more";
          return (
            <Row
              key={r.id}
              id={r.id}
              title={r.title}
              items={r.items}
              viewAllTo={viewAllTo}
              prefetchKind={kind}
            />
          );
        })}


      </main>
      <BottomNav />
    </div>
  );
}
