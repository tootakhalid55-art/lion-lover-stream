import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import {
  Play,
  Plus,
  Search,
  Bell,
  UserRound,
  Home,
  Bookmark,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import lionLogo from "@/assets/lion-logo.png";
import { useScrollState } from "@/hooks/use-scroll-state";
import { useInView } from "@/hooks/use-in-view";

export const Route = createFileRoute("/")({
  component: LionTV,
});

type Poster = { title: string; year: string; gradient: string; tag?: string };

const newMovies: Poster[] = [
  { title: "They Fight", year: "2026", gradient: "from-slate-800 via-red-900 to-black", tag: "أكشن" },
  { title: "The Bay", year: "2026", gradient: "from-sky-700 via-blue-900 to-slate-950", tag: "غموض" },
  { title: "Stop! That! Train!", year: "2026", gradient: "from-pink-500 via-fuchsia-700 to-indigo-900", tag: "كوميدي" },
  { title: "Kill Trip", year: "2026", gradient: "from-red-700 via-red-950 to-black", tag: "إثارة" },
  { title: "Night Runner", year: "2026", gradient: "from-emerald-700 via-slate-900 to-black", tag: "درامي" },
  { title: "Silver Coast", year: "2025", gradient: "from-amber-500 via-orange-800 to-neutral-900", tag: "مغامرة" },
  { title: "Iron Vow", year: "2025", gradient: "from-zinc-700 via-neutral-900 to-black", tag: "حربي" },
];

const newSeries: Poster[] = [
  { title: "قسمة ونصيب", year: "2026", gradient: "from-amber-600 via-rose-800 to-neutral-900", tag: "عائلي" },
  { title: "The Map of Longing", year: "2026", gradient: "from-violet-500 via-purple-800 to-indigo-950", tag: "رومانسي" },
  { title: "The East Palace", year: "2026", gradient: "from-emerald-800 via-teal-900 to-black", tag: "تاريخي" },
  { title: "Tomb Raider King", year: "2026", gradient: "from-yellow-500 via-orange-700 to-slate-900", tag: "أنمي" },
  { title: "Silent Verdict", year: "2026", gradient: "from-cyan-700 via-blue-900 to-black", tag: "جريمة" },
  { title: "قلوب متصلة", year: "2025", gradient: "from-rose-500 via-pink-800 to-neutral-900", tag: "درامي" },
  { title: "ظلال المدينة", year: "2025", gradient: "from-indigo-700 via-slate-900 to-black", tag: "غموض" },
];

function LionTV() {
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
        <Hero />
        <Row title="أفلام جديدة" items={newMovies} />
        <Row title="مسلسلات جديدة" items={newSeries} />
      </main>
      <BottomNav />
    </div>
  );
}

function IconBtn({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid h-11 w-11 place-items-center rounded-full text-foreground/85 transition duration-200 hover:bg-white/10 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-nav-active"
    >
      {children}
    </button>
  );
}

function Header() {
  const { scrolled } = useScrollState();
  return (
    <header
      className={`sticky top-0 z-30 border-b transition-colors duration-300 backdrop-blur-xl ${
        scrolled
          ? "bg-background/85 border-white/10 shadow-[0_6px_20px_-12px_rgba(0,0,0,0.7)]"
          : "bg-background/40 border-transparent"
      }`}
    >
      <div className="mx-auto max-w-6xl grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6 lg:px-10 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={lionLogo}
            alt="LionTV"
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 object-contain drop-shadow-[0_0_16px_color-mix(in_oklab,var(--color-brand)_55%,transparent)]"
          />
          <span className="text-sm font-extrabold tracking-widest">
            <span className="text-brand">Lion</span>
            <span className="text-foreground/90">TV</span>
          </span>
        </div>
        <div />
        <div className="flex items-center gap-1">
          <IconBtn label="بحث"><Search className="h-5 w-5" /></IconBtn>
          <IconBtn label="الإشعارات">
            <span className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />
              </span>
            </span>
          </IconBtn>
          <IconBtn label="الحساب"><UserRound className="h-5 w-5" /></IconBtn>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section aria-label="محتوى مميز" className="mt-4">
      <div className="relative overflow-hidden rounded-3xl ring-1 ring-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] aspect-[16/10] sm:aspect-[21/9] lg:aspect-[24/9] animate-fade-in">
        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-900 via-neutral-900 to-black" />
        <div className="absolute inset-0 opacity-40 mix-blend-screen bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklab,var(--color-brand)_60%,transparent),transparent_60%)]" />
        <img
          src={lionLogo}
          alt=""
          aria-hidden
          fetchPriority="high"
          className="absolute -left-6 bottom-0 h-full w-auto opacity-25 grayscale object-contain"
        />
        {/* Readability gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-black/40" />

        <div className="relative z-10 flex h-full flex-col justify-end p-5 sm:p-8 lg:p-12 animate-hero-in">
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-foreground/90 backdrop-blur ring-1 ring-white/15">
            مميز اليوم
          </span>
          <h1 className="mt-2 text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight">
            أسطورة الأسد
          </h1>
          <p className="mt-1 max-w-md text-xs sm:text-sm lg:text-base text-foreground/80">
            رحلة ملحمية عبر ممالك منسية — حصريًا على ليون تي في.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full bg-pill px-5 py-2.5 text-sm font-extrabold text-pill-foreground shadow-lg transition duration-200 hover:brightness-110 hover:scale-[1.02] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-nav-active focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Play className="h-4 w-4 fill-current" />
              تشغيل الآن
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-5 py-2.5 text-sm font-extrabold text-foreground ring-1 ring-white/15 backdrop-blur-md transition duration-200 hover:bg-white/20 hover:scale-[1.02] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-nav-active"
            >
              <Plus className="h-4 w-4" />
              أضف إلى قائمتي
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ title, items }: { title: string; items: Poster[] }) {
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState<{ start: boolean; end: boolean }>({ start: true, end: false });

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // In RTL, scrollLeft goes negative as you scroll toward the row's end.
    const max = el.scrollWidth - el.clientWidth;
    const distance = Math.abs(el.scrollLeft);
    setEdges({ start: distance < 4, end: distance >= max - 4 });
  }, []);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.85;
    // RTL: "next" (visually left) means negative scrollLeft.
    el.scrollBy({ left: dir * -amount, behavior: "smooth" });
  };

  return (
    <section aria-labelledby={`row-${title}`} className="space-y-3 group/row">
      <div className="flex items-center justify-between">
        <h2 id={`row-${title}`} className="text-lg sm:text-xl lg:text-2xl font-extrabold">
          {title}
        </h2>
        <button className="inline-flex items-center gap-0.5 text-xs text-muted-foreground transition hover:text-foreground focus:outline-none focus-visible:text-foreground">
          عرض الكل
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
      <div className="relative">
        {/* Desktop-only arrows */}
        <button
          type="button"
          aria-label="السابق"
          onClick={() => scrollBy(-1)}
          disabled={edges.start}
          className="hidden lg:grid absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-2 h-11 w-11 place-items-center rounded-full bg-neutral-900/80 text-foreground ring-1 ring-white/10 backdrop-blur opacity-0 group-hover/row:opacity-100 transition disabled:opacity-0 hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-nav-active"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="التالي"
          onClick={() => scrollBy(1)}
          disabled={edges.end}
          className="hidden lg:grid absolute left-0 top-1/2 z-10 -translate-y-1/2 -translate-x-2 h-11 w-11 place-items-center rounded-full bg-neutral-900/80 text-foreground ring-1 ring-white/10 backdrop-blur opacity-0 group-hover/row:opacity-100 transition disabled:opacity-0 hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-nav-active"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="-mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 overflow-x-auto scrollbar-hide snap-row" >
          <ul
            ref={scrollerRef}
            onScroll={updateEdges}
            className="flex gap-3 sm:gap-4 lg:gap-5 min-w-max"
          >
            {items.map((p, i) => (
              <li
                key={p.title}
                className="w-32 sm:w-40 md:w-44 lg:w-48 shrink-0 snap-start"
              >
                <PosterCard poster={p} eager={i < 3} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function PosterCard({ poster, eager }: { poster: Poster; eager?: boolean }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const visible = eager || inView;

  return (
    <button
      type="button"
      aria-label={`${poster.title} ${poster.year}`}
      className="group block w-full text-right focus:outline-none"
    >
      <div
        ref={ref}
        className={`relative aspect-[2/3] w-full overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)] transition duration-300 ease-out will-change-transform group-hover:-translate-y-1 group-hover:scale-[1.05] group-hover:brightness-110 group-hover:shadow-[0_25px_45px_-15px_rgba(0,0,0,0.9)] group-focus-visible:ring-2 group-focus-visible:ring-nav-active`}
      >
        {!visible && <div className="absolute inset-0 skeleton rounded-2xl" />}
        {visible && (
          <div
            className={`absolute inset-0 bg-gradient-to-br ${poster.gradient} animate-fade-in`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_60%)]" />
            {poster.tag && (
              <span className="absolute top-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-foreground backdrop-blur">
                {poster.tag}
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-2.5 pt-8">
              <p className="text-[13px] font-extrabold leading-tight text-foreground drop-shadow line-clamp-2">
                {poster.title}
              </p>
            </div>
            <div className="absolute inset-0 grid place-items-center opacity-0 transition duration-200 group-hover:opacity-100">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-pill text-pill-foreground shadow-[0_10px_30px_-6px_color-mix(in_oklab,var(--color-nav-active)_60%,transparent)] scale-90 transition duration-300 group-hover:scale-100">
                <Play className="h-5 w-5 fill-current" />
              </span>
            </div>
          </div>
        )}
      </div>
      <p className="mt-2 truncate text-xs text-foreground/85">
        {poster.title} · {poster.year}
      </p>
    </button>
  );
}

function BottomNav() {
  const { hidden } = useScrollState();
  const items = [
    { label: "المزيد", icon: MoreHorizontal, active: false },
    { label: "قائمتي", icon: Bookmark, active: false },
    { label: "البحث", icon: Search, active: false },
    { label: "الرئيسية", icon: Home, active: true },
  ];
  return (
    <nav
      aria-label="التنقل الرئيسي"
      className={`fixed bottom-4 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 transition-all duration-300 ease-out ${
        hidden ? "translate-y-24 opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
      }`}
      style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
    >
      <ul className="flex items-center justify-around rounded-full border border-white/10 bg-neutral-900/60 px-2 py-2 shadow-2xl backdrop-blur-xl">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.label}>
              <button
                type="button"
                aria-current={it.active ? "page" : undefined}
                aria-label={it.label}
                className={`relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-full px-3 py-1.5 transition-all duration-200 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-nav-active ${
                  it.active
                    ? "bg-nav-active/20 text-nav-active shadow-[0_0_20px_-4px_color-mix(in_oklab,var(--color-nav-active)_70%,transparent)]"
                    : "text-foreground/70 hover:text-foreground hover:bg-white/5"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={it.active ? 2.4 : 2} />
                <span className="text-[10px] font-bold">{it.label}</span>
                {it.active && (
                  <span
                    aria-hidden
                    className="absolute -bottom-1 h-1 w-1 rounded-full bg-nav-active animate-glow"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
