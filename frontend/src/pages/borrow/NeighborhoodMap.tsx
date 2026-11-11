import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Icon } from "../../components/Icon";
import { ITEM_PLACEHOLDER, ItemImage } from "../../components/ui/ItemImage";
import { SpriteAvatar } from "../../components/sprites/SpriteAvatar";
import { AREAS, hashPosition } from "../../components/areas";
import type { BorrowItem } from "./items";
import { TvSprite } from "../../components/sprites";
import grassPatch from "../../../public/assets/grass_patch.avif";

type Props = {
  area: string; // fixed string, e.g. "clementi"
  items: BorrowItem[];
  selected: BorrowItem | null;
  onSelect: (item: BorrowItem) => void;
  onOpenItem: (item: BorrowItem) => void;
};


export function NeighborhoodMap({ area, items, selected, onSelect, onOpenItem }: Props) {
  const config = AREAS[area.toLowerCase()] ?? { label: area, spots: {} };
  const canvasRef = useRef<HTMLDivElement>(null);
const [pos, setPos] = useState<{ left: number; top: number; below: boolean; tail: number; showTail: boolean } | null>(null);


  // Resolve each person's position from their `location`, nudging people who share a spot
  const placed = useMemo(() => {
    if (!config) return [];
    const seen = new Map<string, number>();
    return items.map((item) => {
      const key = item.location.toLowerCase();
      const base = config.spots[key] ?? hashPosition(item.id);
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      const angle = n * 2.4; // spiral out so avatars don't stack exactly
      return {
        item,
        x: base.x + Math.cos(angle) * n * 2.5,
        y: base.y + Math.sin(angle) * n * 2.5,
      };
    });
  }, [items, config]);

  const [open, setOpen] = useState(false);
  const popupRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element;
      if (popupRef.current?.contains(target) || target.closest(".map-pin")) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const anchor = open && selected ? placed.find((p) => p.item.id === selected.id) : undefined;
  useLayoutEffect(() => {
    if (!anchor) { setPos(null); return; }

    const place = () => {
      const canvas = canvasRef.current;
      const popup = popupRef.current;
      if (!canvas || !popup) return;

      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      const pw = popup.offsetWidth, ph = popup.offsetHeight;
      const ax = (anchor.x / 100) * cw;   // pin's feet, in px
      const ay = (anchor.y / 100) * ch;

      const SPRITE_H = 56, GAP = 12, M = 8;   // M = min margin from canvas edge
      const aboveTop = ay - SPRITE_H - GAP - ph;
      const belowTop = ay + GAP;
      const fitsAbove = aboveTop >= M;
      const fitsBelow = belowTop + ph <= ch - M;

      // prefer above, then below; if neither fits, use whichever side has more room
      const below = fitsAbove ? false : fitsBelow ? true : ay < ch / 2;
      const rawTop = below ? belowTop : aboveTop;

      // force inside the canvas, even if that means detaching from the sprite
      const top = Math.max(M, Math.min(rawTop, ch - ph - M));
      const left = Math.max(M, Math.min(ax - pw / 2, cw - pw - M));

      setPos({
        left,
        top,
        below,
        tail: Math.max(16, Math.min(ax - left, pw - 16)),
        showTail: Math.abs(top - rawTop) < 1,   // hide the tail if the card was shifted away
      });
    };

    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchor?.item.id, anchor?.x, anchor?.y]);

  return (
    <section className="neighborhood-map" aria-label={`People nearby in ${config.label}`}>

      <div
        className="map-canvas"
        style={{ "--map-grass": `url(${grassPatch})` } as CSSProperties}
      >

      <span className="user-location" role="img" aria-label="Your location"><span /></span>

        {placed.map(({ item, x, y }) => {
          const active = open && selected?.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className="map-pin"
              style={{ left: `${x}%`, top: `${y}%` }}
              aria-label={`Show ${item.name} (${item.category}) in ${item.location}`}
              aria-pressed={active}
              onClick={() => { onSelect(item); setOpen(true); }}
            >
              <TvSprite image={item.image} size={active ? 60 : 35} />
            </button>
          );
        })}

        {anchor && selected && (
          <button
            ref={popupRef}
            type="button"
            className={`map-item${anchor.y < 40 ? " map-item--below" : ""}`}
            style={{
              left: `clamp(104px, ${anchor.x}%, calc(100% - 104px))`,
              top: `${anchor.y}%`,
            }}
            aria-label={`View ${selected.name}, ${selected.location}`}
            onClick={() => onOpenItem(selected)}
          >
            <ItemImage className="map-item-photo" src={selected.image} alt={selected.name} width={140} height={72} />
            <div className="map-item-info">
              <h2>{selected.name}</h2>
              <p><Icon name="map-pin" width={18} /><span>{selected.location}</span></p>
            </div>
            <Icon name="card-tail" width={14} height={8} className="map-item-tail" />
          </button>
        )}
      </div>
    </section>
  );
}