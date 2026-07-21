import { useCallback, useState } from "react";
import { Bell, Search, UserRound } from "lucide-react";
import lionLogo from "@/assets/lion-logo.png";
import { IconBtn } from "@/components/primitives/IconBtn";
import { useScrollState } from "@/hooks/use-scroll-state";
import { useDismiss } from "@/hooks/use-dismiss";
import { SearchPanel } from "@/features/search/SearchPanel";
import { NotificationsPanel } from "@/features/notifications/NotificationsPanel";
import { ProfilePanel } from "@/features/profile/ProfilePanel";

type Menu = null | "search" | "notif" | "profile";

/** Premium floating glass header with dynamic transparency. */
export function Header() {
  const { scrolled } = useScrollState();
  const [openMenu, setOpenMenu] = useState<Menu>(null);
  const close = useCallback(() => setOpenMenu(null), []);
  const wrapRef = useDismiss(openMenu !== null, close);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-500 ${
        scrolled
          ? "backdrop-blur-2xl bg-background/70 border-b border-white/[0.08] shadow-[0_8px_32px_-16px_rgba(0,0,0,0.7)]"
          : "backdrop-blur-md bg-gradient-to-b from-background/60 via-background/20 to-transparent border-b border-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6 lg:px-10 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative">
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-brand/50 blur-xl motion-safe:animate-pulse-glow"
            />
            <img
              src={lionLogo}
              alt="LionTV"
              width={40}
              height={40}
              className="relative h-10 w-10 shrink-0 object-contain"
            />
          </div>
          <span className="text-base font-extrabold tracking-wide">
            <span className="text-gradient-brand">Lion</span>
            <span className="text-foreground/95">TV</span>
          </span>
        </div>
        <div />
        <div ref={wrapRef} className="relative flex items-center gap-1">
          <IconBtn label="بحث" active={openMenu === "search"} onClick={() => setOpenMenu(openMenu === "search" ? null : "search")}>
            <Search className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </IconBtn>
          <IconBtn label="الإشعارات" badge active={openMenu === "notif"} onClick={() => setOpenMenu(openMenu === "notif" ? null : "notif")}>
            <Bell className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </IconBtn>
          <IconBtn label="الحساب" active={openMenu === "profile"} onClick={() => setOpenMenu(openMenu === "profile" ? null : "profile")}>
            <UserRound className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </IconBtn>

          {openMenu === "search" && <SearchPanel onClose={close} />}
          {openMenu === "notif" && <NotificationsPanel onClose={close} />}
          {openMenu === "profile" && <ProfilePanel onClose={close} />}
        </div>
      </div>
    </header>
  );
}
