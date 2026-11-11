import { useMemo } from "react";
import { Icon } from "../../components/Icon";
import { ItemImage } from "../../components/ui/ItemImage";
import { SpriteAvatar } from "../../components/sprites/SpriteAvatar";
import { AREAS, hashPosition } from "../../components/areas";
import type { BorrowItem } from "./items";
import { TvSprite } from "../../components/sprites";
import grassPatch from "../../assets/grass_patch.avif";
import type { CSSProperties } from "react";

type Props = {
  area: string; // fixed string, e.g. "clementi"
  items: BorrowItem[];
  selected: BorrowItem | null;
  onSelect: (item: BorrowItem) => void;
  onOpenItem: (item: BorrowItem) => void;
};



export function NeighborhoodMap({ area, items, selected, onSelect, onOpenItem }: Props) {
  const config = AREAS[area.toLowerCase()] ?? { label: area, spots: {} };

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

  if (!config) return null;

  return (
    <section className="neighborhood-map" aria-label={`People nearby in ${config.label}`}>

      <div
        className="map-canvas"
        style={{ "--map-grass": `url(${grassPatch})` } as CSSProperties}
      >

      <span className="user-location" role="img" aria-label="Your location"><span /></span>

        {placed.map(({ item, x, y }) => (
          <button
            key={item.id}
            type="button"
            className="map-pin"
            style={{ left: `${x}%`, top: `${y}%` }}
            aria-label={`Show ${item.name} (${item.category}) in ${item.location}`}
            aria-pressed={selected?.id === item.id}
            onClick={() => onSelect(item)}
          >
            <TvSprite
              size={selected?.id === item.id ? 52 : 40}
              image={item.image}
            />
          </button>
        ))}
        </div>

      {selected && (
        <button type="button" className="map-item" onClick={() => onOpenItem(selected)}
          aria-label={`View ${selected.name}, ${selected.location}`}>
          <ItemImage className="map-item-photo" src={selected.image} alt={selected.name} width={140} height={72} />
          <div className="map-item-info">
            <h2>{selected.name}</h2>
            <p><Icon name="map-pin" width={18} /><span>{selected.location}</span></p>
          </div>
          <Icon name="card-tail" width={14} height={8} className="map-item-tail" />
        </button>
      )}
    </section>
  );
}