import { ItemImage } from '../components/ui/ItemImage';
import { useState } from "react";
import { useApp } from "../app/context";
import { type Item } from "../app/domain";
import { EmptyState, Glyph } from "../components/ui/shared";
import { ListingForm } from "./ListingForm";
import { CategoryIcon } from "../components/ui/CategoryIcon";
import { Icon } from "../components/Icon";

export function SharePage({ onLoan }: { onLoan: (id: string) => void }) {
  const { store, perform, toast, busy: saving } = useApp();
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const mine = store.items.filter((i) => i.ownerId === store.activeUserId);

  return (
    // Present the active user's listings with create, edit, and visibility controls.
    <main className="app-scroll">
      <div className="section-heading">
        <h2>Your items</h2>
        <button
          disabled={saving}
          className="button primary"
          type="button"
          onClick={() => setEditing("new")}
        >
          <Glyph name="plus" />
          Share
        </button>
      </div>
      <p className="muted">Give your things a little more life.</p>

      {mine.length ? (
        <div className="shelf-list">
          {mine.map((item) => {
            const loans = store.loans.filter(
              (l) =>
                l.itemId === item.id &&
                !["complete", "cancelled", "declined"].includes(l.status),
            );
            return (
              // Represent one owned item and whether it is currently listed to borrowers.
              <article className="shelf-card" key={item.id}>
                <ItemImage src={item.image} alt={item.name} width={84} height={84} />
                <div>
                  <h3>{item.name}</h3>
                  <p className="shelf-card__meta">
                    <span>
                      <CategoryIcon category={item.category} size={14} />
                      {item.category}
                    </span>
                    <span>
                      <Icon name="map-pin" width={14} />
                      {item.location}
                    </span>
                  </p>
                  <span className="status-label">
                    {!item.listed
                      ? "Hidden"
                      : loans.length
                        ? "Reserved"
                        : "Available"}
                  </span>
                  <div className="button-row">
                    <button
                      disabled={saving}
                      className="button"
                      type="button"
                      onClick={() => setEditing(item)}
                    >
                      Edit
                    </button>
                    <button
                      disabled={saving}
                      className="button"
                      type="button"
                      onClick={async () => {
                        const result = await perform({
                          type: "toggle-item",
                          id: item.id,
                        });
                        // Clear listing errors and show a toast only after changing visibility succeeds.
                        if (result.ok)
                          toast(
                            item.listed
                              ? "Listing hidden from new borrowers."
                              : "Listing is visible again.",
                          );
                        else toast(result.error);
                      }}
                    >
                      {item.listed ? "Hide" : "List again"}
                    </button>
                    {loans[0] && (
                      <button
                        disabled={saving}
                        className="button"
                        type="button"
                        onClick={() => onLoan(loans[0].id)}
                      >
                        View loan
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Your shelf is empty"
          text="Share something you rarely use and help a neighbour out."
        >
          <button
            disabled={saving}
            className="button"
            type="button"
            onClick={() => setEditing("new")}
          >
            Share your first item
          </button>
        </EmptyState>
      )}

      {editing && (
        <ListingForm
          key={editing === "new" ? "new" : editing.id}
          item={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  );
}
