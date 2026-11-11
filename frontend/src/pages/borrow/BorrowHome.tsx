import { useEffect, useReducer, useRef } from "react";
import { BottomNavigation } from "../../components/BottomNavigation";
import { Icon } from "../../components/Icon";
import { NeighborhoodMap } from "./NeighborhoodMap";
import { SearchOverlay } from "./SearchOverlay";
import { ItemDetails } from "./ItemDetails";
import { ItemCard } from "./ItemCard";
import { CategorySelect } from "./CategorySelect";
import { CATEGORIES } from "../../app/categories";
import {
  allItems,
  categories,
  locations,
  filterItems,
  getBrowseItems,
  type BorrowItem,
} from "./items";
import { borrowReducer, initialBorrowState } from "./flow";
import "./borrow.css";

function itemFromHash(source: BorrowItem[] = allItems) {
  // Skip hash lookup when rendering without a browser window.
  if (typeof window === "undefined") return undefined;
  return source.find(
    (item) => window.location.hash === `#borrow/item/${item.id}`,
  );
}

export default function BorrowHome({
  catalog = allItems,
  embedded = false,
  onRequest,
  onChat,
  onChatOwner,
  onViewLoan,
  onNotifications,
}: {
  catalog?: BorrowItem[];
  embedded?: boolean;
  onRequest?: (id: string) => void;
  onChat?: () => void;
  onChatOwner?: (ownerId: string) => void;
  onViewLoan?: (loanId: string) => void;
  onNotifications?: () => void;
}) {
  const present = new Set(catalog.map((item) => item.category));
  const categories = [
    ...CATEGORIES.filter((c) => present.has(c)),
    ...[...present].filter((c) => !(CATEGORIES as string[]).includes(c)),
  ];
  const locations = [...new Set(catalog.map((item) => item.location))];
  const [state, dispatch] = useReducer(
    borrowReducer,
    initialBorrowState,
    (initial) => {
      const item = itemFromHash(catalog);
      return item
        ? { ...initial, view: "details" as const, itemId: item.id }
        : initial;
    },
  );
  const scrollArea = useRef<HTMLElement>(null);
  const savedScroll = useRef(0);
  const lastOpenedItem = useRef<string | null>(null);
  const { filters } = state;
  const visibleItems = getBrowseItems(filters, catalog);
  const mapItems = filterItems(catalog, filters);
  const selected =
    mapItems.find((item) => item.id === state.selectedMapId) ??
    mapItems.find((item) => item.id === "cake-stand") ??
    mapItems[0] ??
    null;
  const detailsItem = catalog.find((item) => item.id === state.itemId);

  useEffect(() => {
    function handleBack() {
      const item = itemFromHash(catalog);
      // Remember the item reached through browser history so focus can be restored later.
      if (item) lastOpenedItem.current = item.id;
      dispatch(
        item
          ? {
              type: "open-item",
              id: item.id,
              knownItemIds: catalog.map((i) => i.id),
            }
          : { type: "back-to-results" },
      );
    }
    window.addEventListener("popstate", handleBack);
    return () => window.removeEventListener("popstate", handleBack);
  }, [catalog]);
  useEffect(() => {
    // Move keyboard focus to the item-detail container when its view opens.
    if (state.view === "details")
      document.getElementById("item-details")?.focus({ preventScroll: true });
    // Restore scrolling only after the browse scroll container exists.
    if (state.view === "browse" && scrollArea.current) {
      scrollArea.current.scrollTop = savedScroll.current;
      // Restore keyboard focus to the most recently opened item card.
      if (lastOpenedItem.current) {
        document
          .getElementById(`item-${lastOpenedItem.current}`)
          ?.focus({ preventScroll: true });
        lastOpenedItem.current = null;
      }
    }
  }, [state.view]);
  useEffect(() => {
    savedScroll.current = 0;
    // Reset catalog scrolling when the browse filters change.
    if (scrollArea.current) scrollArea.current.scrollTop = 0;
  }, [filters]);

  function openItem(id: string) {
    savedScroll.current = scrollArea.current?.scrollTop ?? 0;
    lastOpenedItem.current = id;
    window.history.pushState(null, "", `#borrow/item/${id}`);
    dispatch({ type: "open-item", id, knownItemIds: catalog.map((i) => i.id) });
  }
  function backToResults() {
    // Return to the originating friend page when details were opened from that profile.
    if (window.history.state?.fromFriend) {
      window.history.back();
      return;
    }
    // Check whether the current browser entry is an item-detail route.
    if (window.location.hash.startsWith("#borrow/item/")) {
      // A card click has a known results entry; direct links return locally.
      // Use browser back only when a prior card click established a results entry.
      if (lastOpenedItem.current) {
        window.history.back();
        return;
      }
    }
    window.history.replaceState(null, "", "#borrow");
    dispatch({ type: "back-to-results" });
  }
  function resetFilters() {
    savedScroll.current = 0;
    window.history.replaceState(null, "", "#borrow");
    dispatch({ type: "reset" });
  }

  return (
    // Coordinate the borrow catalog, filters, map, search overlay, and item-detail view.
    <div className={embedded ? "borrow-feature" : "borrow-app"} id="borrow">
      <a
        className="skip-link"
        href={state.view === "details" ? "#item-details" : "#borrow-content"}
      >
        Skip to content
      </a>
      {state.view !== "details" && (
        <header className="top-banner">
          <button
            className="search-field search-trigger"
            type="button"
            aria-label="Search for an item"
            aria-haspopup="dialog"
            onClick={() => {
              savedScroll.current = scrollArea.current?.scrollTop ?? 0;
              dispatch({ type: "open-search" });
            }}
          >
            <span className={filters.query ? "" : "search-placeholder"}>
              {filters.query || "Search for an item..."}
            </span>
            <Icon name="search" width={18} />
          </button>
          <div className="header-actions">
            <button
              type="button"
              className="header-action"
              aria-label="Notifications"
              disabled={!onNotifications}
              onClick={onNotifications}
            >
              <Icon name="notifications" width={35} />
            </button>
            <button
              type="button"
              className="header-action"
              aria-label="Chats"
              disabled={!onChat}
              onClick={onChat}
            >
              <Icon name="chat" width={35} />
            </button>
          </div>
        </header>
      )}

      <main
        className="borrow-scroll"
        id="borrow-content"
        ref={scrollArea}
        tabIndex={-1}
        hidden={state.view === "details"}
      >
        <h1 className="sr-only">
          {filters.query
            ? `Results for ${filters.query}`
            : "Borrow from your community"}
        </h1>
        <div className="filter-bar" role="group" aria-label="Filter items">
          <CategorySelect
            value={filters.category}
            categories={categories}
            onChange={(value) => dispatch({ type: "set-category", value })}
          />
          <label className="select-field select-field--location">
            <span className="sr-only">Location</span>
            <Icon name="map-pin" width={18} />
            <select
              value={filters.location}
              onChange={(event) =>
                dispatch({ type: "set-location", value: event.target.value })
              }
            >
              <option value="all">Nearby</option>
              {locations.map((value) => (
                // Represent one community location present in the current catalog.
                <option key={value}>{value}</option>
              ))}
            </select>
            <Icon name="chevron-down" width={16} />
          </label>
          <button
            className="friends-filter"
            type="button"
            aria-pressed={filters.friendsOnly}
            onClick={() => dispatch({ type: "toggle-friends" })}
          >
            {filters.friendsOnly && <Icon name="check" width={16} />}Friends
            only
          </button>
          <button
            className="friends-filter available-filter"
            type="button"
            aria-pressed={!!filters.availableNow}
            onClick={() => dispatch({ type: "toggle-available" })}
          >
            {filters.availableNow ? (
              <Icon name="check" width={16} />
            ) : (
              <span className="available-filter__dot" aria-hidden="true" />
            )}
            Available now
          </button>
        </div>

        <NeighborhoodMap
          area={"clementi"}
          items={mapItems}
          selected={selected}
          onSelect={(item) =>
            dispatch({ type: "select-map-item", id: item.id })
          }
          onOpenItem={(item) => openItem(item.id)}
        />

        <section
          className="items-section"
          aria-label="Items available to borrow"
        >
          <p className="sr-only" role="status" aria-live="polite">
            {visibleItems.length} items found
          </p>
          {visibleItems.length > 0 ? (
            <div className="item-grid">
              {visibleItems.map((item) => (
                // Represent a borrowable item card and open its detail view when selected.
                <ItemCard
                  key={item.id}
                  item={item}
                  onOpen={() => openItem(item.id)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>No items found</h2>
              <p>Try another search or adjust your filters.</p>
              <button type="button" onClick={resetFilters}>
                Clear filters
              </button>
            </div>
          )}
        </section>
      </main>
      {state.view === "details" && detailsItem && (
        <ItemDetails
          item={detailsItem}
          onBack={backToResults}
          onBorrow={onRequest ? () => onRequest(detailsItem.id) : undefined}
          onChat={onChatOwner}
          onViewLoan={onViewLoan}
        />
      )}
      {!embedded && <BottomNavigation onBorrow={resetFilters} />}
      {state.view === "search" && (
        <SearchOverlay
          catalog={catalog}
          value={state.draftQuery}
          recentSearches={state.recentSearches}
          onChange={(value) => dispatch({ type: "edit-search", value })}
          onClose={() => dispatch({ type: "close-search" })}
          onSubmit={(query) => dispatch({ type: "submit-search", query })}
        />
      )}
    </div>
  );
}
