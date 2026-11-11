import { ItemImage } from '../../components/ui/ItemImage';
import { Icon } from "../../components/Icon";
import { CategoryIcon } from "../../components/ui/CategoryIcon";
import type { BorrowItem } from "./items";

type Props = {
  items: BorrowItem[];
  selected: BorrowItem | null;
  onSelect: (item: BorrowItem) => void;
  onOpenItem: (item: BorrowItem) => void;
};

// A schematic neighborhood matching Figma; this is not a geographic map.
export function NeighborhoodMap({
  items,
  selected,
  onSelect,
  onOpenItem,
}: Props) {
  return (
    // Present the prototype neighborhood map with selectable item markers and a detail preview.
    <section
      className="neighborhood-map"
      aria-label="Browse items in the neighborhood"
    >
      <div className="map-blocks" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          // Draw one decorative street block in the prototype map.
          <span key={i} />
        ))}
      </div>
      <div className="map-road map-road--horizontal-one" aria-hidden="true" />
      <div className="map-road map-road--horizontal-two" aria-hidden="true" />
      <div className="map-road map-road--vertical-one" aria-hidden="true" />
      <div className="map-road map-road--vertical-two" aria-hidden="true" />
      <span className="user-location" role="img" aria-label="Your location">
        <span />
      </span>
      {items.slice(0, 3).map((item, index) => (
        // Select one of the first three filtered items for the schematic map preview.
        <button
          key={item.id}
          type="button"
          className={`map-pin map-pin--${index + 1}`}
          aria-label={`Show ${item.name} (${item.category}) in ${item.location}`}
          aria-pressed={selected?.id === item.id}
          onClick={() => onSelect(item)}
        >
          <CategoryIcon category={item.category} size={20} />
        </button>
      ))}
      {selected && (
        <button
          type="button"
          className="map-item"
          aria-label={`View ${selected.name}, ${selected.location}`}
          onClick={() => onOpenItem(selected)}
        >
          <ItemImage
            className="map-item-photo"
            src={selected.image}
            alt={selected.name}
            width={140}
            height={72}
          />
          <div className="map-item-info">
            <h2>{selected.name}</h2>
            <p>
              <Icon name="map-pin" width={18} />
              <span>{selected.location}</span>
            </p>
          </div>
          <Icon
            name="card-tail"
            width={14}
            height={8}
            className="map-item-tail"
          />
        </button>
      )}
    </section>
  );
}
