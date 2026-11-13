import { ItemImage } from '../../components/ui/ItemImage';
import { Icon } from "../../components/Icon";
import { UserChip } from "../../components/ui/UserChip";
import { JourneyStrip } from "../../components/ui/JourneyStrip";
import { ReviewCard } from "../../components/ui/ReviewCard";
import { TvSprite } from "../../components/sprites";
import { useOptionalApp } from "../../app/context";
import { spriteFor } from "../../app/sprite";
import { Availability } from "./Availability";
import type { BorrowItem } from "./items";
import { itemReviews } from "../../app/item-reviews";
import { todayLocal } from "../../app/domain";
import { mergeLoans, useItemBookings } from '../../app/bookings';

export function ItemDetails({
  item,
  onBack,
  onBorrow,
  onChat,
  onViewLoan,
}: {
  item: BorrowItem & { ownerId?: string };
  onBack: () => void;
  onBorrow?: () => void;
  onChat?: (ownerId: string) => void;
  onViewLoan?: (loanId: string) => void;
}) {
  const app = useOptionalApp();
  const owner = app?.store.people.find((p) => p.id === item.ownerId);
  const ownerName = owner?.name ?? item.owner ?? "owner";
  const loans = (app?.store.loans ?? []).filter((l) => l.itemId === item.id)
  const bookings = useItemBookings(item.id, loans.length);
  const calendarLoans = mergeLoans(loans, bookings);
  const me = app?.store.activeUserId
  
  const tvColour =
    app && owner ? spriteFor(app.store, owner.id).bodyColor : undefined;
  const title = item.title ?? item.name;
  const viewerOwnsItem = !!app && item.ownerId === app.store.activeUserId;
  const journey = (app ? itemReviews(app.store, item.id, viewerOwnsItem) : [])
    .map((l, i) => ({
      id: l.id,
      content: (
        <ReviewCard
          index={i}
          showAuthor={viewerOwnsItem}
          review={{
            id: l.id,
            rating: l.review!.rating,
            text: l.review!.text,
            compliments: l.review!.compliments,
            photo: l.review!.photo,
            author: app?.store.people.find((p) => p.id === l.authorId),
          }}
        />
      ),
    }));

  const today = todayLocal();
  const myLoan = app?.store.loans.find(
    (l) =>
      l.itemId === item.id &&
      l.borrowerId === app.store.activeUserId &&
      !["complete", "declined", "cancelled"].includes(l.status) &&
      l.start <= today &&
      today <= l.end,
  );

  return (
    // Present an item's photos, owner, description, and borrowing action.
    <main
      className="details-scroll"
      id="item-details"
      tabIndex={-1}
      aria-label="Item details"
    >
      <div className="details-hero">
        <ItemImage className="details-photo" src={item.image} alt={title} />
        <button
          type="button"
          className="details-back"
          aria-label="Back to results"
          onClick={onBack}
        >
          <Icon name="back" width={24} />
        </button>
      </div>

      <div className="details-body">
        <div className="details-row">
          <div className="details-info">
            <h1>{title}</h1>
            <UserChip
              person={owner}
              name={item.owner}
              isFriend={item.isFriend}
            />
            <p className="details-location">
              <Icon name="map-pin" width={18} />
              <span>{item.location}</span>
            </p>
          </div>
          <div className="details-sprite">
            <TvSprite
              image={item.image}
              imageAlt={title}
              animation="squish"
              bodyColor={tvColour}
            />
          </div>
        </div>

        {item.description && (
          <p className="details-description">{item.description}</p>
        )}

        <Availability itemId={item.id} loans={calendarLoans} me={me} />

        <JourneyStrip entries={journey} />
      </div>

      <div className="details-actions">
        <button
            type="button"
            className="button primary"
            disabled={!onBorrow}
            onClick={onBorrow}
          >
            Borrow
        </button>
  
        <button
          type="button"
          className="button"
          disabled={!onChat || !item.ownerId}
          onClick={() => item.ownerId && onChat?.(item.ownerId)}
        >
          Chat with {ownerName}
        </button>
      </div>
    </main>
  );
}
