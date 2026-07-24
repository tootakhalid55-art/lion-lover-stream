import { useEffect, useRef, useState } from "react";
import intro from "@/assets/nova-intro.mp4.asset.json";

const SESSION_KEY = "nova_splash_shown_v4";
const FADE_MS = 600;
const MAX_MS = 7000; // hard cap in case video stalls

export function Splash() {
  const [mount, setMount] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch { /* ignore */ }

    setMount(true);
    const timers: number[] = [];
    const finish = () => {
      setLeaving(true);
      timers.push(window.setTimeout(() => setMount(false), FADE_MS));
    };
    timers.push(window.setTimeout(finish, MAX_MS));

    const v = videoRef.current;
    if (v) {
      v.play().catch(() => finish());
    }
    return () => timers.forEach(window.clearTimeout);
  }, []);

  if (!mount) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[9999] grid place-items-center overflow-hidden bg-[#050505] transition-opacity duration-[600ms] ${
        leaving ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <video
        ref={videoRef}
        src={intro.url}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={() => {
          setLeaving(true);
          window.setTimeout(() => setMount(false), FADE_MS);
        }}
        className="h-full w-full object-contain"
      />
    </div>
  );
}
