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

/** Sticky glass header with the LionTV mark and three action popovers. */
export function Header() {
  const { scrolled } = useScrollState();
  const [openMenu, setOpenMenu] = useState<Menu>(null);
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
          <IconBtn label="بحث" active={openMenu === "search"} onClick={() => setOpenMenu(openMenu === "search" ? null : "search")}>
            <Search className="h-5 w-5" />
          </IconBtn>
          <IconBtn label="الإشعارات" badge active={openMenu === "notif"} onClick={() => setOpenMenu(openMenu === "notif" ? null : "notif")}>
            <Bell className="h-5 w-5" />
          </IconBtn>
          <IconBtn label="الحساب" active={openMenu === "profile"} onClick={() => setOpenMenu(openMenu === "profile" ? null : "profile")}>
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
