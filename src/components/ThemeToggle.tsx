"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "classroom-theme";

function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/**
 * Floating light/dark switch. The sun's rays retract into a crescent as it
 * turns, and a pair of vines unfurls around the dial on every change, drawn by
 * animating stroke-dashoffset, so the line really does grow from its stem.
 *
 * Where the browser supports it, the new palette arrives as a circular wipe
 * spreading from the button. Both effects are skipped under reduced motion.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  // Bumped on every change to restart the vine animation from the beginning.
  const [growth, setGrowth] = useState(0);

  useEffect(() => setTheme(currentTheme()), []);

  function apply(next: Theme) {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing: the choice simply will not outlive the tab.
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", next === "dark" ? "#10141b" : "#ffffff");
    setTheme(next);
    setGrowth((n) => n + 1);
  }

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    type WithViewTransition = Document & {
      startViewTransition?: (callback: () => void) => { ready: Promise<void> };
    };
    const doc = document as WithViewTransition;

    if (calm || typeof doc.startViewTransition !== "function") {
      apply(next);
      return;
    }

    // Spread the new palette from the button itself.
    const box = event.currentTarget.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const reach = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    document.documentElement.style.setProperty("--wipe-x", `${x}px`);
    document.documentElement.style.setProperty("--wipe-y", `${y}px`);
    document.documentElement.style.setProperty("--wipe-r", `${reach}px`);

    doc.startViewTransition(() => apply(next))!.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${reach}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 520,
          easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    });
  }

  const dark = theme === "dark";

  return (
    <button
      type="button"
      className={`theme-toggle${dark ? " is-dark" : ""}`}
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="theme-dial" key={growth}>
        <svg viewBox="0 0 44 44" aria-hidden="true">
          <defs>
            {/* Bites a crescent out of the disc as the theme turns dark. */}
            <mask id="crescent">
              <rect width="44" height="44" fill="#fff" />
              <circle className="crescent-bite" cx="30" cy="14" r="8" fill="#000" />
            </mask>
          </defs>

          <g className="vines">
            <path className="vine vine-a" d="M22 36 C 12 34, 7 27, 7 20" />
            <circle className="leaf leaf-a1" cx="11" cy="30" r="2" />
            <circle className="leaf leaf-a2" cx="7.6" cy="23" r="1.6" />
            <path className="vine vine-b" d="M22 8 C 32 10, 37 17, 37 24" />
            <circle className="leaf leaf-b1" cx="33" cy="14" r="2" />
            <circle className="leaf leaf-b2" cx="36.4" cy="21" r="1.6" />
          </g>

          <g className="rays">
            {Array.from({ length: 8 }, (_, i) => (
              <line
                key={i}
                x1="22"
                y1="6.5"
                x2="22"
                y2="10"
                transform={`rotate(${i * 45} 22 22)`}
              />
            ))}
          </g>

          <circle className="disc" cx="22" cy="22" r="8" mask="url(#crescent)" />
        </svg>
      </span>

      {/* The classical theme's switch: a bronze lantern (rendered from the same
          model as the columns' lanterns) that lights as night falls and goes
          out with a wisp of smoke at dawn. Hidden in the current design. */}
      <span className={`theme-lamp${growth > 0 ? " has-changed" : ""}`} key={`lamp-${growth}`}>
        <span className="lamp-glow" />
        <span className="lamp-art lamp-unlit" />
        <span className="lamp-art lamp-lit" />
        <span className="lamp-flare" />
        <span className="lamp-smoke" />
      </span>
    </button>
  );
}
