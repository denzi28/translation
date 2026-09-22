/**
 * Two Ionic columns standing in the page margins, each with a bronze lantern
 * that lights in the dark theme. Pure decoration: hidden from assistive tech,
 * never clickable, and only drawn on screens wide enough to have margins.
 *
 * Each column is five stacked images rendered from a 3D model (see
 * scripts/colonnade): capital, shaft, lantern section, shaft, base. The shaft
 * is a tile that repeats vertically, so a column fits any window height
 * without stretching. A whole day column and a whole night column are stacked
 * and the night one fades in as a single layer, so the joins between pieces
 * never show halfway through the change.
 */
function Stack({ time }: { time: "day" | "night" }) {
  return (
    <div className={`col-layer col-${time}`}>
      <div className="col-part col-cap" />
      <div className="col-part col-shaft col-shaft-upper" />
      <div className="col-part col-lantern">
        {time === "night" && <span className="lantern-glow" />}
      </div>
      <div className="col-part col-shaft col-shaft-lower" />
      <div className="col-part col-base" />
    </div>
  );
}

export default function Colonnade() {
  return (
    <div className="colonnade" aria-hidden="true">
      {(["left", "right"] as const).map((side) => (
        <div key={side} className={`column column-${side}`}>
          <Stack time="day" />
          <Stack time="night" />
        </div>
      ))}
    </div>
  );
}
