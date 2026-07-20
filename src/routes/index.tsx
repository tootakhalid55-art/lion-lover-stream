import { createFileRoute } from "@tanstack/react-router";
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
} from "lucide-react";
import lionLogo from "@/assets/lion-logo.png";

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
];

const newSeries: Poster[] = [
  { title: "قسمة ونصيب", year: "2026", gradient: "from-amber-600 via-rose-800 to-neutral-900", tag: "عائلي" },
  { title: "The Map of Longing", year: "2026", gradient: "from-violet-500 via-purple-800 to-indigo-950", tag: "رومانسي" },
  { title: "The East Palace", year: "2026", gradient: "from-emerald-800 via-teal-900 to-black", tag: "تاريخي" },
  { title: "Tomb Raider King", year: "2026", gradient: "from-yellow-500 via-orange-700 to-slate-900", tag: "أنمي" },
  { title: "Silent Verdict", year: "2026", gradient: "from-cyan-700 via-blue-900 to-black", tag: "جريمة" },
  { title: "قلوب متصلة", year: "2025", gradient: "from-rose-500 via-pink-800 to-neutral-900", tag: "درامي" },
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
      <main id="main" className="mx-auto max-w-5xl px-4 sm:px-6 space-y-10">
        <Hero />
        <Row title="أفلام جديدة" items={newMovies} />
        <Row title="مسلسلات جديدة" items={newSeries} />
      </main>
      <BottomNav />
    </div>
  );
}

function IconBtn({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid h-11 w-11 place-items-center rounded-full text-foreground/85 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-nav-active"
    >
      {children}
    </button>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-white/5">
      <div className="mx-auto max-w-5xl grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6 py-3">
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
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-nav-active ring-2 ring-background" />
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
      <div className="relative overflow-hidden rounded-3xl ring-1 ring-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] aspect-[16/10] sm:aspect-[21/9]">
        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-900 via-neutral-900 to-black" />
        <div className="absolute inset-0 opacity-30 mix-blend-screen bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklab,var(--color-brand)_60%,transparent),transparent_60%)]" />
        <img
          src={lionLogo}
          alt=""
          aria-hidden
          className="absolute -left-6 bottom-0 h-full w-auto opacity-25 grayscale object-contain"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        <div className="relative z-10 flex h-full flex-col justify-end p-5 sm:p-8">
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-foreground/90 backdrop-blur">
            مميز اليوم
          </span>
          <h1 className="mt-2 text-2xl sm:text-4xl font-black tracking-tight">
            أسطورة الأسد
          </h1>
          <p className="mt-1 max-w-md text-xs sm:text-sm text-foreground/75">
            رحلة ملحمية عبر ممالك منسية — حصريًا على ليون تي في.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full bg-pill px-5 py-2.5 text-sm font-extrabold text-pill-foreground shadow-lg transition duration-200 hover:brightness-110 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-nav-active focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Play className="h-4 w-4 fill-current" />
              تشغيل الآن
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-5 py-2.5 text-sm font-extrabold text-foreground ring-1 ring-white/15 backdrop-blur transition duration-200 hover:bg-white/15 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-nav-active"
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
  return (
    <section aria-labelledby={`row-${title}`} className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id={`row-${title}`} className="text-lg sm:text-xl font-extrabold">
          {title}
        </h2>
        <button className="inline-flex items-center gap-0.5 text-xs text-muted-foreground transition hover:text-foreground focus:outline-none focus-visible:text-foreground">
          عرض الكل
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
      <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto scrollbar-hide">
        <ul className="flex gap-3 sm:gap-4 min-w-max">
          {items.map((p, i) => (
            <li key={p.title} className="w-32 sm:w-40 md:w-44 shrink-0">
              <PosterCard poster={p} eager={i < 3} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PosterCard({ poster, eager }: { poster: Poster; eager?: boolean }) {
  return (
    <button
      type="button"
      aria-label={`${poster.title} ${poster.year}`}
      className="group block w-full text-right focus:outline-none"
      // hint the browser to defer offscreen posters — mirrors "lazy loading for rows"
      style={{ contentVisibility: eager ? "visible" : "auto" }}
    >
      <div
        className={`relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-gradient-to-br ${poster.gradient} ring-1 ring-white/10 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)] transition duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.9)] group-focus-visible:ring-2 group-focus-visible:ring-nav-active`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_60%)]" />
        {poster.tag && (
          <span className="absolute top-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-foreground backdrop-blur">
            {poster.tag}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2.5 pt-8">
          <p className="text-[13px] font-extrabold leading-tight text-foreground drop-shadow line-clamp-2">
            {poster.title}
          </p>
        </div>
        <div className="absolute inset-0 grid place-items-center opacity-0 transition duration-200 group-hover:opacity-100">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-pill text-pill-foreground shadow-lg">
            <Play className="h-5 w-5 fill-current" />
          </span>
        </div>
      </div>
      <p className="mt-2 truncate text-xs text-foreground/85">
        {poster.title} · {poster.year}
      </p>
    </button>
  );
}

function BottomNav() {
  const items = [
    { label: "المزيد", icon: MoreHorizontal, active: false },
    { label: "قائمتي", icon: Bookmark, active: false },
    { label: "البحث", icon: Search, active: false },
    { label: "الرئيسية", icon: Home, active: true },
  ];
  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2"
    >
      <ul className="flex items-center justify-around rounded-full border border-white/10 bg-neutral-900/70 px-2 py-2 shadow-2xl backdrop-blur-xl">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.label}>
              <button
                type="button"
                aria-current={it.active ? "page" : undefined}
                aria-label={it.label}
                className={`flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-full px-3 py-1.5 transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-nav-active ${
                  it.active
                    ? "bg-nav-active/20 text-nav-active"
                    : "text-foreground/70 hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={it.active ? 2.4 : 2} />
                <span className="text-[10px] font-bold">{it.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
