import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronLeft,
  RotateCw,
  UserRound,
  Home,
  Tv,
  Film,
  Clapperboard,
  MoreHorizontal,
} from "lucide-react";
import lionLogo from "@/assets/lion-logo.png";

export const Route = createFileRoute("/")({
  component: LionTV,
});

type Poster = { title: string; year: string; gradient: string };

const newMovies: Poster[] = [
  { title: "They Fight", year: "2026", gradient: "from-slate-800 via-red-900 to-black" },
  { title: "The Bay", year: "2026", gradient: "from-sky-700 via-blue-900 to-slate-950" },
  { title: "Stop! That! Train!", year: "2026", gradient: "from-pink-500 via-fuchsia-700 to-indigo-900" },
  { title: "Kill Trip", year: "2026", gradient: "from-red-700 via-red-950 to-black" },
  { title: "Night Runner", year: "2026", gradient: "from-emerald-700 via-slate-900 to-black" },
];

const newSeries: Poster[] = [
  { title: "قسمة ونصيب", year: "2026", gradient: "from-amber-600 via-rose-800 to-neutral-900" },
  { title: "The Map of Longing", year: "2026", gradient: "from-violet-500 via-purple-800 to-indigo-950" },
  { title: "The East Palace", year: "2026", gradient: "from-emerald-800 via-teal-900 to-black" },
  { title: "Tomb Raider King", year: "2026", gradient: "from-yellow-500 via-orange-700 to-slate-900" },
  { title: "Silent Verdict", year: "2026", gradient: "from-cyan-700 via-blue-900 to-black" },
];

function LionTV() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <Header />
      <main className="px-4 space-y-8">
        <HeroCard />
        <QuickActions />
        <Row title="أفلام جديدة" items={newMovies} />
        <Row title="مسلسلات جديدة" items={newSeries} />
      </main>
      <BottomNav />
    </div>
  );
}

function Header() {
  return (
    <header className="relative flex items-center justify-between px-4 pt-4 pb-2">
      <button
        aria-label="تحديث"
        className="grid h-10 w-10 place-items-center rounded-full text-foreground/80 hover:bg-white/5"
      >
        <RotateCw className="h-5 w-5" />
      </button>
      <div className="absolute left-1/2 top-3 -translate-x-1/2 flex flex-col items-center">
        <img
          src={lionLogo}
          alt="LionTV"
          width={64}
          height={64}
          className="h-14 w-14 object-contain drop-shadow-[0_0_18px_rgba(168,85,247,0.45)]"
        />
        <span className="mt-0.5 text-[11px] font-extrabold tracking-widest">
          <span className="text-fuchsia-400">Lion</span>
          <span className="text-fuchsia-300">TV</span>
        </span>
      </div>
      <button
        aria-label="الحساب"
        className="grid h-10 w-10 place-items-center rounded-full text-foreground/80 hover:bg-white/5"
      >
        <UserRound className="h-5 w-5" />
      </button>
    </header>
  );
}

function HeroCard() {
  return (
    <div className="relative mt-6 overflow-hidden rounded-3xl bg-gradient-to-b from-neutral-800/80 to-neutral-900/90 ring-1 ring-white/5 aspect-[16/9] flex items-center justify-center">
      <img
        src={lionLogo}
        alt=""
        aria-hidden
        className="h-4/5 object-contain opacity-15 grayscale"
      />
      <div className="absolute bottom-3 right-4 text-xs text-white/60">مميز اليوم</div>
    </div>
  );
}

function QuickActions() {
  const items = ["بحث", "التنزيلات", "الدعم الفني"];
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((label) => (
        <button
          key={label}
          className="flex items-center justify-between gap-1 rounded-full bg-pill px-4 py-2.5 text-sm font-bold text-pill-foreground shadow-sm active:scale-[0.98] transition"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-center truncate">{label}</span>
        </button>
      ))}
    </div>
  );
}

function Row({ title, items }: { title: string; items: Poster[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">{title}</h2>
        <button className="text-xs text-muted-foreground hover:text-foreground">عرض الكل</button>
      </div>
      <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
        <ul className="flex gap-3 min-w-max">
          {items.map((p) => (
            <li key={p.title} className="w-32 shrink-0 space-y-2">
              <div
                className={`aspect-[2/3] w-full rounded-xl bg-gradient-to-br ${p.gradient} ring-1 ring-white/5 shadow-lg overflow-hidden relative flex items-end p-2`}
              >
                <span className="text-[13px] font-extrabold leading-tight text-white drop-shadow-md">
                  {p.title}
                </span>
              </div>
              <p className="text-xs text-foreground/90 truncate">
                {p.title} {p.year}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function BottomNav() {
  const items = [
    { label: "المزيد", icon: MoreHorizontal, active: false },
    { label: "مسلسلات", icon: Clapperboard, active: false },
    { label: "أفلام", icon: Film, active: false },
    { label: "بث مباشر", icon: Tv, active: false },
    { label: "الرئيسية", icon: Home, active: true },
  ];
  return (
    <nav className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-md">
      <div className="flex items-center justify-around rounded-full bg-neutral-900/95 ring-1 ring-white/10 backdrop-blur px-3 py-2 shadow-2xl">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button
              key={it.label}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-full transition ${
                it.active
                  ? "bg-nav-active/20 text-nav-active"
                  : "text-foreground/70 hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={it.active ? 2.4 : 2} />
              <span className="text-[10px] font-bold">{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
