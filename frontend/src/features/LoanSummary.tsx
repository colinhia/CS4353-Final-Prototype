import { ItemImage } from '../components/ui/ItemImage';
import { useApp } from "../app/context";
import { dateLabel, LOCKERS, type Loan } from "../app/domain";
import { Icon } from "../components/Icon";
import { Glyph } from "../components/ui/shared";
import { UserChip } from "../components/ui/UserChip";

export function LoanSummary({ loan }: { loan: Loan }) {
  const { store } = useApp();
  const item = store.items.find((i) => i.id === loan.itemId)!;
  const peer = store.people.find(
    (p) =>
      p.id ===
      (loan.borrowerId === store.activeUserId ? loan.ownerId : loan.borrowerId),
  )!;
  return (
    // Summarize the item, the other participant, the loan dates, and the exchange location.
    <div className="loan-summary">
      <ItemImage src={item.image} alt="" width={160} height={160} />
      <div>
        <h2>{item.title ?? item.name}</h2>
        <p>
          <Glyph name="calendar" size={18} />
          <span>
            {dateLabel(loan.start)} –
            <br />
            {dateLabel(loan.end)}
          </span>
        </p>
        <p>
          <Icon name="map-pin" width={18} />
          {LOCKERS.find((l) => l.id === loan.lockerId)?.name}
        </p>
        <p>
          <UserChip person={peer} size={24} />
        </p>
      </div>
    </div>
  );
}
