import { useEffect, useState } from "react";
import f1 from "@/assets/splash-frames/frame-01.png.asset.json";
import f2 from "@/assets/splash-frames/frame-02.png.asset.json";
import f3 from "@/assets/splash-frames/frame-03.png.asset.json";
import f4 from "@/assets/splash-frames/frame-04.png.asset.json";
import f5 from "@/assets/splash-frames/frame-05.png.asset.json";
import f6 from "@/assets/splash-frames/frame-06.png.asset.json";
import f7 from "@/assets/splash-frames/frame-07.png.asset.json";
import f8 from "@/assets/splash-frames/frame-08.png.asset.json";
import f9 from "@/assets/splash-frames/frame-09.png.asset.json";
import f10 from "@/assets/splash-frames/frame-10.png.asset.json";
import f11 from "@/assets/splash-frames/frame-11.png.asset.json";
import f12 from "@/assets/splash-frames/frame-12.png.asset.json";

const FRAMES = [f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12].map((f) => f.url);
const SESSION_KEY = "nova_splash_shown_v3";
const FRAME_MS = 320; // 12 * 320 ≈ 3.85s
const HOLD_MS = 700; // linger on final frame
const FADE_MS = 500;

export function Splash() {
  const [mount, setMount] = useState(false);
  const [idx, setIdx] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch { /* ignore */ }

    // Preload all frames
    FRAMES.forEach((src) => { const im = new Image(); im.src = src; });

    setMount(true);
    const timers: number[] = [];
    for (let i = 1; i < FRAMES.length; i++) {
      timers.push(window.setTimeout(() => setIdx(i), i * FRAME_MS));
    }
    const total = FRAMES.length * FRAME_MS + HOLD_MS;
    timers.push(window.setTimeout(() => setLeaving(true), total));
    timers.push(window.setTimeout(() => setMount(false), total + FADE_MS));
    return () => timers.forEach(window.clearTimeout);
  }, []);

  if (!mount) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[9999] grid place-items-center overflow-hidden bg-[#050505] transition-opacity duration-500 ${
        leaving ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {FRAMES.map((src, i) => (
        <img
          key={i}
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-contain transition-opacity duration-150"
          style={{ opacity: i === idx ? 1 : 0 }}
        />
      ))}
    </div>
  );
}
