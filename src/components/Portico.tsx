import { SITE_NAME } from "@/lib/site";

/**
 * A temple front: four Ionic columns under a pediment, rendered from the same
 * 3D model as the columns in the desktop margins (scripts/colonnade). It
 * gives a phone, which has no margins, the classical entrance instead.
 *
 * The site's name is cut into the frieze and the logo sits in the medallion
 * of the pediment; both are real text and image laid over the render, so
 * they stay sharp at any size. At night the doorway glows and the lanterns
 * between the columns are lit. Positions come from the map the render
 * prints (scripts/colonnade/process.mjs).
 *
 * Decoration only: the page has its own heading.
 */
export default function Portico({ className = "" }: { className?: string }) {
  return (
    <div className={`portico ${className}`} aria-hidden="true">
      <div className="portico-art">
        <img
          className="portico-day"
          src="/colonnade/portico-day.webp"
          width={1280}
          height={986}
          alt=""
          loading="lazy"
          decoding="async"
        />
        <img
          className="portico-night"
          src="/colonnade/portico-night.webp"
          width={1280}
          height={986}
          alt=""
          loading="lazy"
          decoding="async"
        />
        <span className="portico-glow portico-glow-door" />
        <span className="portico-glow portico-glow-left" />
        <span className="portico-glow portico-glow-right" />
        <img className="portico-logo" src="/logo.png" width={600} height={391} alt="" />
        <span className="portico-name">{SITE_NAME}</span>
      </div>
    </div>
  );
}
