import { useEffect, useState } from "react";
import novaLogo from "@/assets/nova-tv-logo.png.asset.json";

/**
 * Nova TV premium animated splash screen.
 * Shows on every app launch: logo fade + scale, sweeping glow, star flare,
 * ambient particles, then fades out after ~2s.
 */
export function Splash() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setLeaving(true), 1900);
    const t2 = window.setTimeout(() => setVisible(false), 2500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[9999] grid place-items-center overflow-hidden bg-[#050505] transition-opacity duration-500 ${
        leaving ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Ambient particles / rays */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#8A2EFF33_0%,transparent_60%)] blur-2xl animate-nova-glow" />
        <div className="absolute left-1/2 top-1/2 h-[50vmin] w-[50vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#3EA6FF33_0%,transparent_65%)] blur-2xl animate-nova-glow" />
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="absolute block h-1 w-1 rounded-full bg-white/70 animate-nova-particle"
            style={{
              left: `${(i * 53) % 100}%`,
              top: `${(i * 37) % 100}%`,
              animationDelay: `${(i % 6) * 0.18}s`,
              opacity: 0.4 + ((i % 5) * 0.1),
            }}
          />
        ))}
      </div>

      {/* Logo */}
      <div className="relative animate-nova-in">
        {/* Star flare above */}
        <span className="pointer-events-none absolute left-1/2 -top-6 h-6 w-6 -translate-x-1/2 animate-nova-flare">
          <span className="absolute inset-0 rounded-full bg-white blur-[6px]" />
          <span className="absolute left-1/2 top-1/2 h-[2px] w-16 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-white to-transparent" />
          <span className="absolute left-1/2 top-1/2 h-16 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-transparent via-white to-transparent" />
        </span>

        <div className="relative">
          <img
            src={novaLogo.url}
            alt="Nova TV"
            width={220}
            height={220}
            className="relative z-10 h-40 w-40 sm:h-52 sm:w-52 object-contain drop-shadow-[0_0_40px_rgba(138,46,255,0.55)]"
          />
          {/* Sweeping light */}
          <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <span className="absolute -inset-y-4 -left-1/2 w-1/2 rotate-12 bg-gradient-to-r from-transparent via-white/40 to-transparent blur-md animate-nova-sweep" />
          </span>
        </div>

        <p className="mt-4 text-center text-xl font-black tracking-[0.35em] text-white/95">
          <span className="bg-gradient-to-r from-[#3EA6FF] via-white to-[#8A2EFF] bg-clip-text text-transparent">
            NOVA TV
          </span>
        </p>
      </div>

      <style>{`
        @keyframes nova-in {
          0% { opacity: 0; transform: scale(0.95); filter: blur(6px); }
          100% { opacity: 1; transform: scale(1); filter: blur(0); }
        }
        @keyframes nova-sweep {
          0% { transform: translateX(-40%) rotate(12deg); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translateX(340%) rotate(12deg); opacity: 0; }
        }
        @keyframes nova-flare {
          0%, 100% { opacity: 0; transform: translateX(-50%) scale(0.6); }
          40% { opacity: 1; transform: translateX(-50%) scale(1.1); }
          70% { opacity: 0.6; transform: translateX(-50%) scale(0.9); }
        }
        @keyframes nova-glow {
          0%, 100% { opacity: 0.55; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.9; transform: translate(-50%, -50%) scale(1.08); }
        }
        @keyframes nova-particle {
          0% { opacity: 0; transform: translateY(0) scale(0.6); }
          40% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-40px) scale(1); }
        }
        .animate-nova-in { animation: nova-in 900ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        .animate-nova-sweep { animation: nova-sweep 1600ms 400ms cubic-bezier(0.4, 0, 0.2, 1) both; }
        .animate-nova-flare { animation: nova-flare 1400ms 600ms ease-out both; }
        .animate-nova-glow { animation: nova-glow 2400ms ease-in-out infinite; }
        .animate-nova-particle { animation: nova-particle 2200ms ease-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .animate-nova-in, .animate-nova-sweep, .animate-nova-flare,
          .animate-nova-glow, .animate-nova-particle {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
