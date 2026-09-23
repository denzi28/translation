"use client";

import { Fragment, useEffect, useRef, useState } from "react";

/**
 * Two Ionic columns standing in the page margins, each with bronze lanterns
 * that light in the dark theme. Pure decoration: hidden from assistive tech,
 * never clickable, and only drawn on screens wide enough to have margins.
 *
 * Each column is stacked from images rendered from a 3D model (see
 * scripts/colonnade): capital, shaft, lantern sections, base. The shaft is a
 * tile that repeats vertically, so a column can be any height without
 * stretching. A whole day column and a whole night column are stacked and the
 * night one fades in as a single layer, so the joins between pieces never
 * show halfway through the change.
 *
 * The columns stand behind the page, so they rise at a fraction of the
 * scrolling speed: that difference is what reads as depth. Each column is
 * made exactly tall enough that its base reaches the bottom of the window as
 * the page reaches its end, with a lantern roughly every screenful.
 */

/** How fast the columns rise compared with the page. */
const RATE = 0.55;
/** Artwork proportions, width 500. */
const CAP_H = 310 / 500;
const LANTERN_H = 979 / 500;
const BASE_H = 257 / 500;

type Layout = {
  /** Column height in px. */
  height: number;
  /** Height of the shaft above each lantern, top to bottom. */
  gaps: number[];
};

function Stack({ time, layout }: { time: "day" | "night"; layout: Layout | null }) {
  const lantern = (
    <div className="col-part col-lantern">
      {time === "night" && <span className="lantern-glow" />}
    </div>
  );
  return (
    <div className={`col-layer col-${time}`}>
      <div className="col-part col-cap" />
      {layout ? (
        layout.gaps.map((gap, i) => (
          <Fragment key={i}>
            <div className="col-part col-shaft" style={{ flex: `0 0 ${gap}px` }} />
            {lantern}
          </Fragment>
        ))
      ) : (
        <>
          <div className="col-part col-shaft col-shaft-upper" />
          {lantern}
        </>
      )}
      <div className="col-part col-shaft col-shaft-lower" />
      <div className="col-part col-base" />
    </div>
  );
}

export default function Colonnade() {
  const root = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const track = el.querySelector<HTMLElement>(".colonnade-track");
    const column = el.querySelector<HTMLElement>(".column");
    if (!track || !column) return;

    const wide = window.matchMedia("(min-width: 1340px)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cssDriven = CSS.supports("animation-timeline: scroll()");
    let rise = 0;
    let scrollMax = 0;
    let frame = 0;

    const measure = () => {
      if (!wide.matches) return;
      const top = parseFloat(getComputedStyle(column).top) || 0;
      const width = column.offsetWidth;
      const visible = window.innerHeight - top;
      scrollMax = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      rise = still.matches ? 0 : scrollMax * RATE;
      const height = visible + rise;

      const cap = width * CAP_H;
      const lantern = width * LANTERN_H;
      const base = width * BASE_H;
      // The first lantern hangs where it did on a page that does not scroll;
      // the rest follow about a screen apart and stop short of the base.
      const gaps = [Math.max(0, ((visible - cap - lantern - base) * 0.62) / 1.62)];
      const spacing = Math.max(visible, lantern * 1.5);
      let bottom = cap + gaps[0] + lantern;
      while (bottom + spacing + base + visible * 0.2 <= height) {
        gaps.push(spacing - lantern);
        bottom += spacing;
      }

      el.style.setProperty("--rise", `${rise}px`);
      setLayout((prev) =>
        prev && Math.abs(prev.height - height) < 0.5 && prev.gaps.length === gaps.length
          && prev.gaps.every((g, i) => Math.abs(g - gaps[i]) < 0.5)
          ? prev
          : { height, gaps },
      );
      if (!cssDriven) follow();
    };

    // Browsers without scroll-driven animations move the columns from here.
    const follow = () => {
      const y = Math.min(Math.max(window.scrollY, 0), scrollMax);
      track.style.transform = rise ? `translate3d(0, ${-y * RATE}px, 0)` : "";
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        follow();
      });
    };

    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(document.body);
    window.addEventListener("resize", measure);
    wide.addEventListener("change", measure);
    still.addEventListener("change", measure);
    if (!cssDriven) window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      resize.disconnect();
      window.removeEventListener("resize", measure);
      wide.removeEventListener("change", measure);
      still.removeEventListener("change", measure);
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="colonnade" aria-hidden="true" ref={root}>
      <div className="colonnade-track">
        {(["left", "right"] as const).map((side) => (
          <div
            key={side}
            className={`column column-${side}`}
            style={layout ? { height: layout.height } : undefined}
          >
            <Stack time="day" layout={layout} />
            <Stack time="night" layout={layout} />
          </div>
        ))}
      </div>
    </div>
  );
}
