// apps/web/components/embed/AutoResizeReporter.tsx
"use client";

import { useEffect } from "react";

export default function AutoResizeReporter() {
  useEffect(() => {
    const post = () => {
      const height = document.documentElement.scrollHeight;
      window.parent?.postMessage({ type: "KP_EMBED_HEIGHT", height }, "*");
    };

    post();

    const ro = new ResizeObserver(() => post());
    ro.observe(document.documentElement);

    window.addEventListener("load", post);
    window.addEventListener("resize", post);

    return () => {
      ro.disconnect();
      window.removeEventListener("load", post);
      window.removeEventListener("resize", post);
    };
  }, []);

  return null;
}
