import { useState } from "react";
import { useLeague } from "@/contexts/LeagueContext";

/**
 * Premium broadcast-quality rotating Ballers.IQ badge.
 * Front face: provided NBA / WNBA × Ballers.IQ artwork.
 * Back face: brushed-gold metallic plate built in CSS, with embossed
 * "Ballers.IQ" wordmark, league text, and a red square accent before "IQ".
 * Hover pauses the rotation. Built with CSS 3D transforms for performance.
 */
export default function RotatingBallersIQBadge({
  width = 480,
}: {
  width?: number;
}) {
  const { league } = useLeague();
  const [paused, setPaused] = useState(false);
  const front =
    league === "wnba"
      ? "/brand/ballers-iq-card-front-wnba.png"
      : league === "euroleague"
        ? "/brand/ballers-iq-card-front-euroleague.png"
        : "/brand/ballers-iq-card-front-nba.png";
  const leagueLabel =
    league === "wnba" ? "WNBA" : league === "euroleague" ? "EUROLEAGUE" : "NBA";

  // Aspect ratio of the supplied artwork (~2.4:1).
  const aspect = 2.4;
  const height = Math.round(width / aspect);
  // Visible card thickness (the metallic edge band).
  const depth = 14;

  return (
    <div
      className="biq-badge-stage"
      style={{
        width,
        height,
        perspective: 1600,
        perspectiveOrigin: "50% 50%",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Ballers.IQ"
    >
      {/* Soft cinematic shadow under the badge */}
      <div
        aria-hidden
        className="biq-badge-shadow"
        style={{
          width: width * 0.78,
          height: 22,
        }}
      />

      <div
        className={`biq-badge-rotor ${paused ? "is-paused" : ""}`}
        style={{
          width,
          height,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Edge band — gives the card visible thickness */}
        <div
          aria-hidden
          className="biq-badge-edge"
          style={{
            width,
            height,
            transform: `translateZ(${-depth / 2}px)`,
            borderRadius: 18,
          }}
        />
        <div
          aria-hidden
          className="biq-badge-edge"
          style={{
            width,
            height,
            transform: `translateZ(${depth / 2}px)`,
            borderRadius: 18,
          }}
        />

        {/* FRONT face */}
        <div
          className="biq-badge-face"
          style={{
            width,
            height,
            transform: `translateZ(${depth / 2}px)`,
            borderRadius: 18,
          }}
        >
          <img
            src={front}
            alt=""
            draggable={false}
            className="biq-badge-art"
          />
          {/* Bevel highlight */}
          <div aria-hidden className="biq-badge-bevel" />
          {/* Animated sheen sweep */}
          <div aria-hidden className="biq-badge-sheen" />
        </div>

        {/* BACK face — gold collectible */}
        <div
          className="biq-badge-face biq-badge-back"
          style={{
            width,
            height,
            transform: `translateZ(${-depth / 2}px) rotateY(180deg)`,
            borderRadius: 18,
          }}
        >
          <div className="biq-badge-back-inner">
            <span className="biq-badge-league">{leagueLabel}</span>
            <span className="biq-badge-wordmark">
              Ballers<span className="biq-badge-dot" />IQ
              <span className="biq-badge-redsquare" aria-hidden />
            </span>
          </div>
          <div aria-hidden className="biq-badge-bevel biq-badge-bevel-gold" />
          <div aria-hidden className="biq-badge-sheen biq-badge-sheen-gold" />
        </div>
      </div>
    </div>
  );
}