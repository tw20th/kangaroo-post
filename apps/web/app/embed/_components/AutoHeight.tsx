// apps/web/app/embed/_components/AutoHeight.tsx
"use client";

import { useEffect } from "react";

type Msg = { type: "KANGAROO_POST_HEIGHT"; height: number };

export default function AutoHeight() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const post = () => {
      const height = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      );
      const msg: Msg = { type: "KANGAROO_POST_HEIGHT", height };
      window.parent?.postMessage(msg, "*");
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
