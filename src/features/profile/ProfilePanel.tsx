import { Link } from "@tanstack/react-router";
import { Download, ListVideo, LogOut, Settings, UserRound } from "lucide-react";
import { GlassPanel } from "@/components/primitives/GlassPanel";

type Item = {
  icon: typeof UserRound;
  label: string;
  to?: "/settings";
  danger?: boolean;
};

const ITEMS: readonly Item[] = [
  { icon: UserRound, label: "الحساب", to: "/settings" },
  { icon: ListVideo, label: "المشاهدة لاحقًا" },
  { icon: Download, label: "التنزيلات" },
  { icon: Settings, label: "الإعدادات", to: "/settings" },
  { icon: LogOut, label: "تسجيل الخروج", to: "/settings", danger: true },
];

export function ProfilePanel({ onClose }: { onClose: () => void }) {
  return (
    <GlassPanel className="w-[min(88vw,260px)] right-0 left-auto p-2">
      <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand to-fuchsia-700 text-sm font-black">
          أ
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">مرحبًا بك</p>
          <p className="truncate text-[11px] text-muted-foreground">حساب Nova TV</p>
        </div>
      </div>
      <ul className="mt-1">
        {ITEMS.map(({ icon: Icon, label, danger, to }) => {
          const cls = `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition hover:bg-white/5 ${
            danger ? "text-red-300 hover:text-red-200" : "text-foreground"
          }`;
          return (
            <li key={label}>
              {to ? (
                <Link to={to} onClick={onClose} className={cls}>
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              ) : (
                <button onClick={onClose} className={cls}>
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </GlassPanel>
  );
}
