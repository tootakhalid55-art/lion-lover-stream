import { useEffect, useState } from "react";
import novaLogo from "@/assets/nova-tv-logo.png.asset.json";

/**
 * Nova TV cinematic splash screen.
 * ~4.6s sequence: particles → beams → logo reveal → lens flare →
 * wordmark + tagline → gentle breathing → fade out. Shown only on
 * fresh app launch (per browser session), not on client navigation.
 */
const SESSION_KEY = "nova_splash_shown_v2";

export function Splash() {
  const [mount, setMount] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* private mode: still show once */
    }
    setMount(true);
    const t1 = window.setTimeout(() => setLeaving(true), 4200);
    const t2 = window.setTimeout(() => setMount(false), 4800);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (!mount) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[9999] grid place-items-center overflow-hidden bg-[#050505] transition-opacity duration-500 ${
        leaving ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Deep-space starfield */}
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 40 }).map((_, i) => (
          <span
            key={i}
            className="nv-star absolute block rounded-full bg-white"
            style={{
              left: `${(i * 83) % 100}%`,
              top: `${(i * 47) % 100}%`,
              width: `${1 + (i % 3) * 0.5}px`,
              height: `${1 + (i % 3) * 0.5}px`,
              animationDelay: `${(i % 10) * 0.12}s`,
              opacity: 0.3 + ((i % 5) * 0.12),
            }}
          />
        ))}
      </div>

      {/* Vertical neon beams (Scene 2) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-2/3 flex justify-center items-start gap-3 sm:gap-5">
        {Array.from({ length: 9 }).map((_, i) => (
          <span
            key={i}
            className="nv-beam block w-[2px] rounded-full bg-gradient-to-b from-[#B57BFF] via-[#8A2EFF] to-transparent"
            style={{
              height: `${45 + (i % 4) * 12}%`,
              animationDelay: `${0.45 + i * 0.06}s`,
              opacity: 0,
            }}
          />
        ))}
      </div>

      {/* Central glow (Scene 1 + breathing) */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="nv-core h-[70vmin] w-[70vmin] rounded-full bg-[radial-gradient(circle,#8A2EFF55_0%,#3EA6FF22_35%,transparent_65%)] blur-2xl" />
      </div>

      {/* Particle convergence (Scene 2) */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[50vmin] w-[50vmin] -translate-x-1/2 -translate-y-1/2">
        {Array.from({ length: 26 }).map((_, i) => {
          const angle = (i / 26) * Math.PI * 2;
          const r = 42; // vmin
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          return (
            <span
              key={i}
              className="nv-particle absolute left-1/2 top-1/2 block h-[3px] w-[3px] rounded-full bg-[#C79BFF] shadow-[0_0_8px_2px_#8A2EFFcc]"
              style={
                {
                  ["--x" as any]: `${x}vmin`,
                  ["--y" as any]: `${y}vmin`,
                  animationDelay: `${0.5 + (i % 8) * 0.04}s`,
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>

      {/* Rotating energy ring behind logo (Scene 3–6) */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 nv-ring-wrap">
        <svg
          viewBox="0 0 200 200"
          className="nv-ring h-[46vmin] w-[46vmin] max-h-[420px] max-w-[420px]"
        >
          <defs>
            <linearGradient id="nv-ring-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3EA6FF" stopOpacity="0" />
              <stop offset="30%" stopColor="#8A2EFF" stopOpacity="1" />
              <stop offset="70%" stopColor="#B57BFF" stopOpacity="1" />
              <stop offset="100%" stopColor="#3EA6FF" stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle
            cx="100"
            cy="100"
            r="92"
            fill="none"
            stroke="url(#nv-ring-grad)"
            strokeWidth="1.5"
            strokeDasharray="6 10"
            style={{ filter: "drop-shadow(0 0 6px #8A2EFF)" }}
          />
        </svg>
      </div>

      {/* Logo + wordmark (Scene 3–5) */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative nv-logo">
          <img
            src={novaLogo.url}
            alt="Nova TV"
            width={260}
            height={260}
            className="relative z-10 h-40 w-40 sm:h-52 sm:w-52 object-contain drop-shadow-[0_0_50px_rgba(138,46,255,0.65)]"
          />
          {/* Lens flare sweep (Scene 4) */}
          <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <span className="nv-sweep absolute -inset-y-8 -left-1/2 w-1/2 rotate-12 bg-gradient-to-r from-transparent via-white/70 to-transparent blur-md" />
          </span>
          {/* Bloom */}
          <span className="pointer-events-none absolute inset-0 -z-10 nv-bloom rounded-full bg-[radial-gradient(circle,#8A2EFF66_0%,transparent_60%)] blur-2xl" />
        </div>

        <div className="mt-5 flex flex-col items-center nv-word">
          <p className="text-2xl sm:text-3xl font-black tracking-[0.28em]">
            <span className="bg-gradient-to-r from-[#B57BFF] via-white to-[#3EA6FF] bg-clip-text text-transparent">
              NOVA TV
            </span>
          </p>
          <p className="mt-2 text-[10px] sm:text-xs font-medium tracking-[0.42em] text-white/60 nv-tag">
            MOVIES · SERIES · SPORTS
          </p>
        </div>
      </div>

      <style>{`
        @keyframes nv-star {
          0%, 100% { opacity: 0.15; transform: scale(0.8); }
          50% { opacity: 0.9; transform: scale(1); }
        }
        @keyframes nv-beam-in {
          0% { opacity: 0; transform: scaleY(0.2); }
          40% { opacity: 0.9; }
          100% { opacity: 0; transform: scaleY(1); }
        }
        @keyframes nv-core {
          0% { opacity: 0; transform: scale(0.4); }
          25% { opacity: 0.6; }
          55% { opacity: 1; transform: scale(1); }
          100% { opacity: 0.85; transform: scale(1.04); }
        }
        @keyframes nv-particle {
          0% { transform: translate(-50%, -50%) translate(var(--x), var(--y)) scale(0.4); opacity: 0; }
          30% { opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(0, 0) scale(0.6); opacity: 0; }
        }
        @keyframes nv-ring-spin {
          0% { opacity: 0; transform: rotate(0deg) scale(0.85); }
          30% { opacity: 1; }
          100% { opacity: 1; transform: rotate(360deg) scale(1); }
        }
        @keyframes nv-logo-in {
          0% { opacity: 0; transform: scale(0.95); filter: blur(8px); }
          100% { opacity: 1; transform: scale(1); filter: blur(0); }
        }
        @keyframes nv-breathe {
          0%, 100% { filter: drop-shadow(0 0 40px rgba(138,46,255,0.55)); }
          50% { filter: drop-shadow(0 0 70px rgba(138,46,255,0.9)); }
        }
        @keyframes nv-sweep {
          0% { transform: translateX(-40%) rotate(12deg); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translateX(360%) rotate(12deg); opacity: 0; }
        }
        @keyframes nv-bloom {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.15); }
        }
        @keyframes nv-word-in {
          0% { opacity: 0; transform: translateY(10px); letter-spacing: 0.15em; }
          100% { opacity: 1; transform: translateY(0); letter-spacing: 0.28em; }
        }
        @keyframes nv-tag-in {
          0% { opacity: 0; }
          100% { opacity: 0.7; }
        }

        .nv-star { animation: nv-star 3s ease-in-out infinite; }
        .nv-beam { transform-origin: top center; animation: nv-beam-in 1000ms cubic-bezier(0.22,1,0.36,1) both; }
        .nv-core { animation: nv-core 1400ms ease-out both, nv-bloom 3.2s 1.6s ease-in-out infinite; }
        .nv-particle { animation: nv-particle 900ms cubic-bezier(0.5,0,0.2,1) both; will-change: transform, opacity; }
        .nv-ring-wrap { opacity: 0; animation: nv-logo-in 700ms 1.2s ease-out both; }
        .nv-ring { animation: nv-ring-spin 6s 1.2s linear both; transform-origin: 50% 50%; }
        .nv-logo { opacity: 0; animation: nv-logo-in 800ms 1.5s cubic-bezier(0.16,1,0.3,1) both, nv-breathe 3s 2.6s ease-in-out infinite; will-change: transform, opacity, filter; }
        .nv-sweep { animation: nv-sweep 1400ms 2.0s cubic-bezier(0.4,0,0.2,1) both; }
        .nv-word { opacity: 0; animation: nv-word-in 700ms 2.8s cubic-bezier(0.16,1,0.3,1) both; will-change: transform, opacity; }
        .nv-tag { opacity: 0; animation: nv-tag-in 700ms 3.2s ease-out both; }

        @media (prefers-reduced-motion: reduce) {
          .nv-star, .nv-beam, .nv-core, .nv-particle, .nv-ring-wrap, .nv-ring,
          .nv-logo, .nv-sweep, .nv-word, .nv-tag {
            animation: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}
