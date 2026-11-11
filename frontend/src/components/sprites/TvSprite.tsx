import { useId, useState, type CSSProperties } from "react";
import type { SpriteAnimation } from "./types";
import { deriveTvPalette } from "./palette";
import "./sprites.css";
import { isLegacyPlaceholder, ITEM_PLACEHOLDER } from "../ui/ItemImage";
import { ItemImage } from '../../components/ui/ItemImage';


export type TvSpriteProps = {
  // URL of the image shown on the screen, cropped to fill
  image?: string;
  // Alt text for the screen image.
  imageAlt?: string;
  size?: number;
  animation?: SpriteAnimation;
  className?: string;
  // Body colour (e.g. the owner's sprite colour)
  bodyColor?: string;
};

const W = 706;
const H = 606;
const STROKE = 6;
//The screen opening inside the TV body
const SCREEN = { x: 28, y: 28, w: 650, h: 300, r: 75 };

export function TvSprite({
  image,
  imageAlt = "",
  size,
  animation = "none",
  className,
  bodyColor,
}: TvSpriteProps) {
  const id = useId();
  const clipId = `${id}-screen`;
  const gradId = `${id}-body`;
  const glassId = `${id}-glass`;
  const glareId = `${id}-glare`;
  
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = image?.trim() || ITEM_PLACEHOLDER;
  const fallback = source === ITEM_PLACEHOLDER || isLegacyPlaceholder(source) || source === failedSource;
  const src = fallback ? ITEM_PLACEHOLDER : source;


  const style = (size ? { width: size, height: (size * H) / W } : { width: "100%", aspectRatio: `${W} / ${H}` }) as CSSProperties;
  if (bodyColor) {
    const tv = deriveTvPalette(bodyColor);
    Object.assign(style, { "--tv-body-top": tv.top, "--tv-body-bottom": tv.bottom, "--tv-outline": tv.outline });
  }

  return (
    <span
      className={["sprite", "sprite--tv", `sprite--${animation}`, className].filter(Boolean).join(" ")}
      style={style}
    >

      <span className="sprite__shadow" aria-hidden="true" />
      <span className="sprite__figure">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img" aria-label={imageAlt || "TV character"}>
        <defs>
          <clipPath id={clipId}>
            <rect x={SCREEN.x} y={SCREEN.y} width={SCREEN.w} height={SCREEN.h} rx={SCREEN.r} />
          </clipPath>
          <linearGradient id={gradId} x1="353" y1="3" x2="353" y2="503" gradientUnits="userSpaceOnUse">
            <stop offset="0.639423" stopColor="var(--tv-body-top)" />
            <stop offset="0.942308" stopColor="var(--tv-body-bottom)" />
          </linearGradient>
          {/* lightens the image toward the bottom so the eyes stay readable */}
          <linearGradient id={glassId} x1="0" y1={SCREEN.y} x2="0" y2={SCREEN.y + SCREEN.h} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.16" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id={glareId} x1={SCREEN.x} y1={SCREEN.y} x2={SCREEN.x + SCREEN.w * 0.6} y2={SCREEN.y + SCREEN.h} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect x={SCREEN.x} y={SCREEN.y} width={SCREEN.w} height={SCREEN.h} rx={SCREEN.r} fill="var(--tv-screen)" />
        <image
          href={src}
          x={SCREEN.x}
          y={SCREEN.y}
          width={SCREEN.w}
          height={SCREEN.h}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
          onError={() => {
            if (src !== ITEM_PLACEHOLDER) setFailedSource(source);
          }}
        />
        <g clipPath={`url(#${clipId})`} pointerEvents="none">
          <rect x={SCREEN.x} y={SCREEN.y} width={SCREEN.w} height={SCREEN.h} fill={`url(#${glassId})`} />
          <rect x={SCREEN.x} y={SCREEN.y} width={SCREEN.w} height={SCREEN.h} fill={`url(#${glareId})`} />
        </g>
        

        <g stroke="var(--tv-outline)" strokeWidth={STROKE}>
          {/*  Feet */}
          <path
            d="M225.85 492C274.44 492 302.5 499.46 302.5 515C302.5 530.54 304.755 603 290.35 603H131.25C113.405 603 99 589.125 99 571.92C99 527.781 155.792 492 225.85 492Z"
            fill="var(--tv-outline)"
            strokeLinecap="round"
          />
          <path
            d="M481.778 492C433.188 492 405.128 499.46 405.128 515C405.128 530.54 402.873 603 417.278 603H576.378C594.223 603 608.628 589.125 608.628 571.92C608.628 527.781 551.836 492 481.778 492Z"
            fill="var(--tv-outline)"
            strokeLinecap="round"
          />
          {/*  Body with the screen cut out */}
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M103 3H603C658.228 3 703 47.7715 703 103V403C703 458.228 658.228 503 603 503H103C47.7715 503 3 458.228 3 403V103C3 47.7715 47.7715 3 103 3ZM603 28H103C61.5786 28 28 61.5786 28 103V253C28 294.421 61.5787 328 103 328H603C644.421 328 678 294.421 678 253V103C678 61.5786 644.421 28 603 28Z"
            fill={`url(#${gradId})`}
          />
          {/*  Eyes */}
          <path
            d="M250 346.261V372.739C250 384.065 248.733 390.824 246.186 394.747C244.145 397.889 240.995 399.597 235.5 399.936C230.005 399.597 226.855 397.889 224.814 394.747C222.267 390.824 221 384.065 221 372.739V346.261C221 334.935 222.267 328.176 224.814 324.253C226.855 321.111 230.005 319.402 235.5 319.063C240.995 319.402 244.145 321.111 246.186 324.253C248.733 328.176 250 334.935 250 346.261Z"
            fill="var(--tv-outline)"
          />
          <path
            d="M485 346.261V372.739C485 384.065 483.733 390.824 481.186 394.747C479.145 397.889 475.995 399.597 470.5 399.936C465.005 399.597 461.855 397.889 459.814 394.747C457.267 390.824 456 384.065 456 372.739V346.261C456 334.935 457.267 328.176 459.814 324.253C461.855 321.111 465.005 319.402 470.5 319.063C475.995 319.402 479.145 321.111 481.186 324.253C483.733 328.176 485 334.935 485 346.261Z"
            fill="var(--tv-outline)"
          />
          {/*  Nose and smile */}
          <circle cx="353" cy="403" r="25" fill="none" />
          <path d="M300 436C325 472 382 468 405 436" fill="none" strokeLinecap="round" />
        </g>
      </svg>
      </span>
    </span>
  );
}
