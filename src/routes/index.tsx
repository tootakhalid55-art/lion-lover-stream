import { createFileRoute } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
  Star,
  Clock,
  Mic,
  TrendingUp,
  X,
  Check,
  Download,
  Settings,
  LogOut,
  ListVideo,
} from "lucide-react";
import lionLogo from "@/assets/lion-logo.png";
import { useScrollState } from "@/hooks/use-scroll-state";
import { useInView } from "@/hooks/use-in-view";
import { useRowScrollMemory } from "@/hooks/use-row-scroll-memory";

export const Route = createFileRoute("/")({
  component: LionTV,
});

type Poster = {
  title: string;
  year: string;
  gradient: string;
  tag?: string;
  rating?: number;
  quality?: "4K" | "HD";
  duration?: string;
  description?: string;
};

type Hero = {
  title: string;
  subtitle: string;
  badge: string;
  gradient: string;
};

const heroes: Hero[] = [
  {
    title: "أسطورة الأسد",
    subtitle: "رحلة ملحمية عبر ممالك منسية — حصريًا على ليون تي في.",
    badge: "مميز اليوم",
    gradient: "from-fuchsia-900 via-neutral-900 to-black",
  },
  {
    title: "ليالي الصحراء",
    subtitle: "قصة حب وخيانة تحت سماء الصحراء الذهبية.",
    badge: "جديد كليًا",
    gradient: "from-amber-800 via-red-950 to-black",
  },
  {
    title: "ظلال المدينة",
    subtitle: "جريمة غامضة تهز أعتى شوارع العاصمة.",
    badge: "الأكثر مشاهدة",
    gradient: "from-cyan-900 via-slate-900 to-black",
  },
  {
    title: "قسمة ونصيب",
    subtitle: "دراما عائلية تُلامس قلوب الملايين.",
    badge: "حصري",
    gradient: "from-rose-800 via-purple-950 to-black",
  },
];

const newMovies: Poster[] = [
  { title: "They Fight", year: "2026", gradient: "from-slate-800 via-red-900 to-black", tag: "أكشن", rating: 8.4, quality: "4K", duration: "١ س ٥٨ د", description: "معركة أخيرة بين فارسين في عالم مُنهار." },
  { title: "The Bay", year: "2026", gradient: "from-sky-700 via-blue-900 to-slate-950", tag: "غموض", rating: 7.9, quality: "HD", duration: "٢ س ١٢ د", description: "أسرار الخليج تعود إلى السطح بعد عقود." },
  { title: "Stop! That! Train!", year: "2026", gradient: "from-pink-500 via-fuchsia-700 to-indigo-900", tag: "كوميدي", rating: 7.1, quality: "HD", duration: "١ س ٤٠ د", description: "مطاردة جنونية على متن قطار عبر القارات." },
  { title: "Kill Trip", year: "2026", gradient: "from-red-700 via-red-950 to-black", tag: "إثارة", rating: 8.0, quality: "4K", duration: "٢ س ٠٥ د", description: "رحلة عطلة تتحول إلى كابوس دموي." },
  { title: "Night Runner", year: "2026", gradient: "from-emerald-700 via-slate-900 to-black", tag: "درامي", rating: 7.6, quality: "HD", duration: "١ س ٥٠ د", description: "عدّاء ليلي يهرب من ماضيه في شوارع المدينة." },
  { title: "Silver Coast", year: "2025", gradient: "from-amber-500 via-orange-800 to-neutral-900", tag: "مغامرة", rating: 8.2, quality: "4K", duration: "٢ س ١٨ د", description: "بحث عن كنز مفقود على ساحل مسحور." },
  { title: "Iron Vow", year: "2025", gradient: "from-zinc-700 via-neutral-900 to-black", tag: "حربي", rating: 8.7, quality: "4K", duration: "٢ س ٣٠ د", description: "قسم لا يُنقض في زمن الحرب الكبرى." },
];

const newSeries: Poster[] = [
  { title: "قسمة ونصيب", year: "2026", gradient: "from-amber-600 via-rose-800 to-neutral-900", tag: "عائلي", rating: 8.8, quality: "4K", duration: "٢٤ حلقة", description: "دراما عائلية تعبر أجيالًا وحدود." },
  { title: "The Map of Longing", year: "2026", gradient: "from-violet-500 via-purple-800 to-indigo-950", tag: "رومانسي", rating: 8.1, quality: "HD", duration: "١٦ حلقة", description: "خارطة قديمة تقود عاشقين نحو مصيرهما." },
  { title: "The East Palace", year: "2026", gradient: "from-emerald-800 via-teal-900 to-black", tag: "تاريخي", rating: 9.0, quality: "4K", duration: "٣٢ حلقة", description: "مؤامرات القصر الشرقي في عصر الإمبراطورية." },
  { title: "Tomb Raider King", year: "2026", gradient: "from-yellow-500 via-orange-700 to-slate-900", tag: "أنمي", rating: 8.5, quality: "HD", duration: "١٢ حلقة", description: "صياد كنوز يواجه أرواح المقابر القديمة." },
  { title: "Silent Verdict", year: "2026", gradient: "from-cyan-700 via-blue-900 to-black", tag: "جريمة", rating: 8.3, quality: "4K", duration: "١٠ حلقات", description: "محاكمة صامتة تكشف أسرار مدينة كاملة." },
  { title: "قلوب متصلة", year: "2025", gradient: "from-rose-500 via-pink-800 to-neutral-900", tag: "درامي", rating: 7.9, quality: "HD", duration: "٢٠ حلقة", description: "قلوب تجمعها الصدفة وتفرقها الأقدار." },
  { title: "ظلال المدينة", year: "2025", gradient: "from-indigo-700 via-slate-900 to-black", tag: "غموض", rating: 8.4, quality: "4K", duration: "١٨ حلقة", description: "ظلال تتحرك في شوارع لا تنام." },
];

const trendingSearches = ["أسطورة الأسد", "The East Palace", "قسمة ونصيب", "Kill Trip", "Silent Verdict"];

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
        <Row id="row-movies" title="أفلام جديدة" items={newMovies} />
        <Row id="row-series" title="مسلسلات جديدة" items={newSeries} />
      </main>
      <BottomNav />
    </div>
  );
}

function IconBtn({
  label,
  children,
  onClick,
  active,
  badge,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  badge?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`relative grid h-11 w-11 place-items-center rounded-full transition duration-200 hover:bg-white/10 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-nav-active ${
        active ? "bg-white/10 text-foreground" : "text-foreground/85"
      }`}
    >
      {children}
      {badge && (
        <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />
        </span>
      )}
    </button>
  );
}

// Close on outside click / Escape
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function Header() {
  const { scrolled } = useScrollState();
  const [openMenu, setOpenMenu] = useState<null | "search" | "notif" | "profile">(null);
  const close = useCallback(() => setOpenMenu(null), []);
  const wrapRef = useDismiss(openMenu !== null, close);

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
        <div ref={wrapRef} className="relative flex items-center gap-1">
          <IconBtn
            label="بحث"
            active={openMenu === "search"}
            onClick={() => setOpenMenu(openMenu === "search" ? null : "search")}
          >
            <Search className="h-5 w-5" />
          </IconBtn>
          <IconBtn
            label="الإشعارات"
            badge
            active={openMenu === "notif"}
            onClick={() => setOpenMenu(openMenu === "notif" ? null : "notif")}
          >
            <Bell className="h-5 w-5" />
          </IconBtn>
          <IconBtn
            label="الحساب"
            active={openMenu === "profile"}
            onClick={() => setOpenMenu(openMenu === "profile" ? null : "profile")}
          >
            <UserRound className="h-5 w-5" />
          </IconBtn>

          {openMenu === "search" && <SearchPanel onClose={close} />}
          {openMenu === "notif" && <NotificationsPanel onClose={close} />}
          {openMenu === "profile" && <ProfilePanel onClose={close} />}
        </div>
      </div>
    </header>
  );
}

function GlassPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`absolute top-[calc(100%+8px)] left-0 z-40 origin-top rounded-2xl border border-white/10 bg-neutral-950/85 shadow-[0_25px_60px_-20px_rgba(0,0,0,0.85)] backdrop-blur-2xl animate-scale-in ${className}`}
      style={{ animation: "scale-in 180ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
      role="dialog"
    >
      {children}
    </div>
  );
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    try {
      const raw = localStorage.getItem("liontv:recent");
      if (raw) setRecent(JSON.parse(raw));
    } catch {}
  }, []);

  const all = useMemo(() => [...newMovies, ...newSeries], []);
  const suggestions = useMemo(() => {
    if (!q.trim()) return [];
    const s = q.trim().toLowerCase();
    return all.filter((p) => p.title.toLowerCase().includes(s)).slice(0, 6);
  }, [q, all]);

  const commit = (term: string) => {
    if (!term.trim()) return;
    const next = [term, ...recent.filter((r) => r !== term)].slice(0, 6);
    setRecent(next);
    try {
      localStorage.setItem("liontv:recent", JSON.stringify(next));
    } catch {}
    setQ(term);
  };

  return (
    <GlassPanel className="w-[min(92vw,420px)] right-0 left-auto p-3">
      <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10 focus-within:ring-nav-active/60 transition">
        <Search className="h-4 w-4 text-foreground/70" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commit(q)}
          placeholder="ابحث عن فيلم أو مسلسل…"
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button aria-label="بحث صوتي" className="grid h-8 w-8 place-items-center rounded-full text-foreground/80 hover:bg-white/10">
          <Mic className="h-4 w-4" />
        </button>
        <button aria-label="إغلاق" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-foreground/80 hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 max-h-[60vh] overflow-y-auto space-y-4">
        {suggestions.length > 0 && (
          <Section title="اقتراحات">
            <ul className="space-y-1">
              {suggestions.map((s) => (
                <li key={s.title}>
                  <button
                    onClick={() => commit(s.title)}
                    className="w-full flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm text-foreground hover:bg-white/5"
                  >
                    <span className="truncate">{s.title}</span>
                    <span className="text-[11px] text-muted-foreground">{s.year}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {recent.length > 0 && (
          <Section title="عمليات البحث الأخيرة">
            <ul className="flex flex-wrap gap-2">
              {recent.map((r) => (
                <li key={r}>
                  <button
                    onClick={() => setQ(r)}
                    className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-xs text-foreground/85 ring-1 ring-white/10 hover:bg-white/10"
                  >
                    <Clock className="h-3 w-3" />
                    {r}
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="الأكثر رواجًا">
          <ul className="space-y-1">
            {trendingSearches.map((t, i) => (
              <li key={t}>
                <button
                  onClick={() => commit(t)}
                  className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-foreground hover:bg-white/5"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-nav-active/15 text-nav-active">
                    <TrendingUp className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex-1 truncate text-right">{t}</span>
                  <span className="text-[11px] text-muted-foreground">#{i + 1}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </GlassPanel>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

type Notif = { id: number; title: string; body: string; unread: boolean; time: string };

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<Notif[]>([
    { id: 1, title: "حلقة جديدة", body: "الحلقة ١٢ من «قسمة ونصيب» متاحة الآن.", unread: true, time: "قبل ٥ د" },
    { id: 2, title: "توصية لك", body: "قد يعجبك «The East Palace».", unread: true, time: "قبل ساعة" },
    { id: 3, title: "قائمتي", body: "«Kill Trip» متاح للمشاهدة.", unread: false, time: "أمس" },
  ]);
  const unread = items.filter((i) => i.unread).length;

  return (
    <GlassPanel className="w-[min(92vw,360px)] right-0 left-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h3 className="text-sm font-extrabold">الإشعارات {unread > 0 && <span className="ms-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300">{unread}</span>}</h3>
        <button
          onClick={() => setItems((xs) => xs.map((x) => ({ ...x, unread: false })))}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-nav-active hover:text-nav-active/80"
        >
          <Check className="h-3.5 w-3.5" />
          تحديد الكل كمقروء
        </button>
      </div>
      <ul className="max-h-[60vh] overflow-y-auto py-1">
        {items.map((n) => (
          <li key={n.id}>
            <button className="w-full flex items-start gap-3 px-4 py-3 text-right hover:bg-white/5">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.unread ? "bg-nav-active" : "bg-transparent"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`truncate text-sm ${n.unread ? "font-bold text-foreground" : "text-foreground/80"}`}>{n.title}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{n.time}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
      <div className="border-t border-white/10 px-4 py-2 text-center">
        <button onClick={onClose} className="text-[11px] text-muted-foreground hover:text-foreground">إغلاق</button>
      </div>
    </GlassPanel>
  );
}

function ProfilePanel({ onClose }: { onClose: () => void }) {
  const items = [
    { icon: UserRound, label: "الحساب" },
    { icon: ListVideo, label: "المشاهدة لاحقًا" },
    { icon: Download, label: "التنزيلات" },
    { icon: Settings, label: "الإعدادات" },
    { icon: LogOut, label: "تسجيل الخروج", danger: true },
  ];
  return (
    <GlassPanel className="w-[min(88vw,260px)] right-0 left-auto p-2">
      <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand to-fuchsia-700 text-sm font-black">أ</div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">مرحبًا بك</p>
          <p className="truncate text-[11px] text-muted-foreground">حساب ليون تي في</p>
        </div>
      </div>
      <ul className="mt-1">
        {items.map(({ icon: Icon, label, danger }) => (
          <li key={label}>
            <button
              onClick={onClose}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition hover:bg-white/5 ${
                danger ? "text-red-300 hover:text-red-200" : "text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}

function Hero() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = heroes.length;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((v) => (v + 1) % total), 6000);
    return () => clearInterval(t);
  }, [paused, total]);

  return (
    <section
      aria-label="محتوى مميز"
      aria-roledescription="carousel"
      className="mt-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setTimeout(() => setPaused(false), 4000)}
    >
      <div className="relative overflow-hidden rounded-3xl ring-1 ring-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] aspect-[16/10] sm:aspect-[21/9] lg:aspect-[24/9] animate-fade-in">
        {heroes.map((h, idx) => (
          <div
            key={h.title}
            aria-hidden={idx !== i}
            className={`absolute inset-0 transition-opacity duration-[900ms] ease-out ${idx === i ? "opacity-100" : "opacity-0"}`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${h.gradient} ${idx === i ? "animate-kenburns" : ""}`} />
            <div className="absolute inset-0 opacity-40 mix-blend-screen bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklab,var(--color-brand)_60%,transparent),transparent_60%)]" />
          </div>
        ))}
        <img
          src={lionLogo}
          alt=""
          aria-hidden
          fetchPriority="high"
          className="absolute -left-6 bottom-0 h-full w-auto opacity-25 grayscale object-contain"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-black/40" />

        <div key={i} className="relative z-10 flex h-full flex-col justify-end p-5 sm:p-8 lg:p-12 animate-hero-in">
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-foreground/90 backdrop-blur ring-1 ring-white/15">
            {heroes[i].badge}
          </span>
          <h1 className="mt-2 text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight">{heroes[i].title}</h1>
          <p className="mt-1 max-w-md text-xs sm:text-sm lg:text-base text-foreground/80">{heroes[i].subtitle}</p>
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

        {/* Pagination */}
        <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 flex items-center gap-1.5">
          {heroes.map((h, idx) => (
            <button
              key={h.title}
              aria-label={`الشريحة ${idx + 1}`}
              aria-current={idx === i}
              onClick={() => setI(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === i ? "w-6 bg-nav-active" : "w-1.5 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Row({ id, title, items }: { id: string; title: string; items: Poster[] }) {
  const scrollerRef = useRowScrollMemory<HTMLUListElement>(id);
  const [edges, setEdges] = useState<{ start: boolean; end: boolean }>({ start: true, end: false });

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const distance = Math.abs(el.scrollLeft);
    setEdges({ start: distance < 4, end: distance >= max - 4 });
  }, [scrollerRef]);

  useEffect(() => {
    updateEdges();
  }, [updateEdges]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.85;
    el.scrollBy({ left: dir * -amount, behavior: "smooth" });
  };

  return (
    <section aria-labelledby={`row-${id}`} className="space-y-3 group/row">
      <div className="flex items-center justify-between">
        <h2 id={`row-${id}`} className="text-lg sm:text-xl lg:text-2xl font-extrabold">
          {title}
        </h2>
        <button className="inline-flex items-center gap-0.5 text-xs text-muted-foreground transition hover:text-foreground focus:outline-none focus-visible:text-foreground">
          عرض الكل
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
      <div className="relative">
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

        <div className="-mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 overflow-x-auto scrollbar-hide snap-row momentum">
          <ul
            ref={scrollerRef}
            onScroll={updateEdges}
            className="flex gap-3 sm:gap-4 lg:gap-5 min-w-max"
          >
            {items.map((p, i) => (
              <li key={p.title} className="w-32 sm:w-40 md:w-44 lg:w-48 shrink-0 snap-start">
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
  const [bookmarked, setBookmarked] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPress = () => {
    longPressTimer.current = setTimeout(() => {
      setBookmarked((b) => !b);
      if ("vibrate" in navigator) navigator.vibrate?.(20);
    }, 500);
  };
  const endPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const toggleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarked((b) => !b);
    if ("vibrate" in navigator) navigator.vibrate?.(10);
  };

  return (
    <button
      type="button"
      aria-label={`${poster.title} ${poster.year}`}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onTouchCancel={endPress}
      className="group block w-full text-right focus:outline-none"
    >
      <div
        ref={ref}
        className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)] transition duration-300 ease-out will-change-transform group-hover:-translate-y-1 group-hover:scale-[1.05] group-hover:brightness-110 group-hover:shadow-[0_25px_45px_-15px_rgba(0,0,0,0.9)] group-focus-visible:ring-2 group-focus-visible:ring-nav-active"
      >
        {!visible && <div className="absolute inset-0 skeleton rounded-2xl" />}
        {visible && (
          <div className={`absolute inset-0 bg-gradient-to-br ${poster.gradient} animate-fade-in`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_60%)]" />

            {/* Top row: tag + bookmark */}
            <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
              {poster.tag && (
                <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-foreground backdrop-blur">
                  {poster.tag}
                </span>
              )}
              <button
                type="button"
                onClick={toggleBookmark}
                aria-label={bookmarked ? "إزالة من قائمتي" : "أضف إلى قائمتي"}
                aria-pressed={bookmarked}
                className={`grid h-7 w-7 place-items-center rounded-full backdrop-blur transition ${
                  bookmarked ? "bg-nav-active text-neutral-900" : "bg-black/50 text-foreground hover:bg-black/70"
                }`}
              >
                <Bookmark className={`h-3.5 w-3.5 ${bookmarked ? "fill-current" : ""}`} />
              </button>
            </div>

            {/* Quality chip */}
            {poster.quality && (
              <span className="absolute bottom-16 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-nav-active ring-1 ring-nav-active/40 backdrop-blur">
                {poster.quality}
              </span>
            )}

            {/* Bottom metadata */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-2.5 pt-10">
              <p className="text-[13px] font-extrabold leading-tight text-foreground drop-shadow line-clamp-2">
                {poster.title}
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-foreground/80">
                <span>{poster.year}</span>
                {poster.rating !== undefined && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-0.5">
                      <Star className="h-2.5 w-2.5 fill-nav-active text-nav-active" />
                      {poster.rating.toFixed(1)}
                    </span>
                  </>
                )}
                {poster.duration && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="truncate">{poster.duration}</span>
                  </>
                )}
              </div>
            </div>

            {/* Hover: play overlay + description (desktop only) */}
            <div className="absolute inset-0 hidden md:grid place-items-center opacity-0 transition duration-200 group-hover:opacity-100 bg-black/40">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-pill text-pill-foreground shadow-[0_10px_30px_-6px_color-mix(in_oklab,var(--color-nav-active)_60%,transparent)] scale-90 transition duration-300 group-hover:scale-100">
                <Play className="h-5 w-5 fill-current" />
              </span>
            </div>
            {poster.description && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden md:block translate-y-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                <div className="mx-2 mb-2 rounded-lg bg-black/75 p-2 text-[11px] leading-snug text-foreground/90 ring-1 ring-white/10 backdrop-blur">
                  <p className="line-clamp-3">{poster.description}</p>
                </div>
              </div>
            )}
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
  const [active, setActive] = useState("الرئيسية");
  const items = [
    { label: "المزيد", icon: MoreHorizontal },
    { label: "قائمتي", icon: Bookmark },
    { label: "البحث", icon: Search },
    { label: "الرئيسية", icon: Home },
  ];
  const tap = (label: string) => {
    setActive(label);
    if ("vibrate" in navigator) navigator.vibrate?.(8);
  };
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
          const isActive = active === it.label;
          return (
            <li key={it.label}>
              <button
                type="button"
                onClick={() => tap(it.label)}
                aria-current={isActive ? "page" : undefined}
                aria-label={it.label}
                className={`relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-full px-3 py-1.5 transition-all duration-300 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-nav-active ${
                  isActive
                    ? "bg-nav-active/20 text-nav-active shadow-[0_0_20px_-4px_color-mix(in_oklab,var(--color-nav-active)_70%,transparent)] scale-105"
                    : "text-foreground/70 hover:text-foreground hover:bg-white/5"
                }`}
                style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} />
                <span className="text-[10px] font-bold">{it.label}</span>
                {isActive && (
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
