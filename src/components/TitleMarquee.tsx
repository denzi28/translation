"use client";

import { useEffect } from "react";

const STEP_MS = 260;

/**
 * Scrolls the browser tab's title. Paused while the tab is in the background,
 * where the name shows in full instead: browsers throttle timers there, which
 * would make it crawl, and a static title is far easier to pick out of a
 * crowded tab strip or a tab search. Held still entirely under
 * prefers-reduced-motion.
 */
export default function TitleMarquee({ text }: { text: string }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.title = text;
      return;
    }

    // Browsers trim and collapse whitespace in a title, so an ordinary space
    // rotated to either end disappears and the text jumps a character. Every
    // space in the moving strip is non-breaking, which keeps the slide even.
    const strip = `${text}  •  `.replace(/ /g, "\u00A0");
    let offset = 0;
    let timer: number | undefined;

    const step = () => {
      document.title = strip.slice(offset) + strip.slice(0, offset);
      offset = (offset + 1) % strip.length;
    };

    const start = () => {
      stop();
      step();
      timer = window.setInterval(step, STEP_MS);
    };
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
        document.title = text;
      } else {
        start();
      }
    };

    if (document.hidden) document.title = text;
    else start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      document.title = text;
    };
  }, [text]);

  return null;
}
