import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clock, Film, LayoutGrid, Mic, Search, TrendingUp, Tv, Users, X } from "lucide-react";
import { api } from "@/services/api";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { Section } from "@/components/primitives/Section";
import { HighlightMatch } from "@/components/primitives/HighlightMatch";
import { readJSON, writeJSON } from "@/lib/storage";
import { track } from "@/lib/analytics";
import { detailPath } from "@/lib/user-data";
import type { Poster } from "@/services/api/types";

const CATEGORIES = [
  { id: "movies", label: "أفلام", icon: Film },
  { id: "series", label: "مسلسلات", icon: Tv },
  { id: "actors", label: "ممثلون", icon: Users },
  { id: "genres", label: "تصنيفات", icon: LayoutGrid },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

export function SearchPanel({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<CategoryId>("movies");
  const [recent, setRecent] = useState<string[]>([]);
  const [trending, setTrending] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Poster[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    setRecent(readJSON<string[]>("recent", []));
    void api.search.trending().then(setTrending);
  }, []);

  const scope = useMemo<"movies" | "series" | "all">(
    () => (category === "series" ? "series" : category === "movies" ? "movies" : "all"),
    [category],
  );

  useEffect(() => {
    let alive = true;
    void api.search.suggest(q, scope).then((r) => {
      if (alive) setSuggestions(r);
    });
    if (q.trim()) track({ name: "search_used", query: q, scope });
    return () => {
      alive = false;
    };
  }, [q, scope]);

  const commit = (term: string) => {
    if (!term.trim()) return;
    const next = [term, ...recent.filter((r) => r !== term)].slice(0, 6);
    setRecent(next);
    writeJSON("recent", next);
    setQ(term);
    track({ name: "search_committed", term });
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
          placeholder="ابحث في أفلام، مسلسلات، ممثلين…"
          aria-label="حقل البحث"
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          aria-label="بحث صوتي"
          className="grid h-8 w-8 place-items-center rounded-full text-foreground/80 hover:bg-white/10"
        >
          <Mic className="h-4 w-4" />
        </button>
        <button
          aria-label="إغلاق"
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-full text-foreground/80 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div role="tablist" aria-label="فئات البحث" className="mt-2 flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = category === c.id;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={active}
              onClick={() => setCategory(c.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold whitespace-nowrap transition ${
                active
                  ? "bg-nav-active/20 text-nav-active ring-1 ring-nav-active/40"
                  : "text-foreground/70 hover:bg-white/5"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 max-h-[60vh] overflow-y-auto space-y-4">
        {suggestions.length > 0 && (
          <Section title="اقتراحات">
            <ul className="space-y-1">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <Link
                    to={detailPath(s.id) as "/"}
                    onClick={() => { commit(s.title); onClose(); }}
                    className="w-full flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm text-foreground hover:bg-white/5"
                  >
                    <span className="truncate">
                      <HighlightMatch text={s.title} query={q} />
                    </span>
                    <span className="text-[11px] text-muted-foreground">{s.year}</span>
                  </Link>
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
            {trending.map((t, i) => (
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
