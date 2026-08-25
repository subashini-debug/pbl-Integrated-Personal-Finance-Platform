import { useEffect, useState } from "react";

/**
 * Mirrors the app-wide `prefers-reduced-motion` handling already applied in
 * index.css for CSS transitions, but for the imperative rAF-driven animation
 * inside react-three-fiber scenes, which CSS media queries can't reach.
 */
export default function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  return reduced;
}
