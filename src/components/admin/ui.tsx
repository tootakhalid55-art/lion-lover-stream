/**
 * Small shared UI primitives for admin tables.
 */
import { type ReactNode } from "react";

export function AdminHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/90">Nova TV Admin</p>
        <h1 className="text-3xl font-black">{title}</h1>
        {subtitle && <p className="text-sm text-foreground/60 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: "green" | "red" | "yellow" | "slate" | "blue" | "purple" }) {
  const map: Record<string, string> = {
    green: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    red: "bg-red-500/15 text-red-300 border-red-500/30",
    yellow: "bg-yellow-500/15 text-yellow-200 border-yellow-500/30",
    slate: "bg-white/5 text-foreground/70 border-white/10",
    blue: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    purple: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${map[tone]}`}>{children}</span>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="glass rounded-2xl p-10 text-center text-foreground/50">{children}</div>;
}

export function fmt(dt: string | null | undefined) {
  if (!dt) return "—";
  try { return new Date(dt).toLocaleString("ar-EG-u-nu-latn", { dateStyle: "short", timeStyle: "short" }); } catch { return dt; }
}

export function relTime(dt: string | null | undefined) {
  if (!dt) return "—";
  const diff = Date.now() - new Date(dt).getTime();
  if (diff < 60_000) return "الآن";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} د`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} س`;
  return `${Math.floor(diff / 86400_000)} ي`;
}

export function exportUrl(dataset: string, format: "csv" | "xlsx", token: string | null): string {
  if (!token) return "#";
  return `/api/admin/export/${dataset}.${format}?token=${encodeURIComponent(token)}`;
}
