import { todayLocal, type Item, type Loan } from '../app/domain';
import { ItemImage } from '../components/ui/ItemImage';

export type ShelfState = 'available' | 'booked' | 'on-loan' | 'hidden';

const OUT_STATUSES = ['active', 'returning', 'verifying'];
const PLANNED_STATUSES = ['arranging', 'ready'];

/** The loan the item is currently out on (or due out today), if any. */
export function currentLoan(item: Item, loans: Loan[], today = todayLocal()) {
  return loans.find(l => l.itemId === item.id && (OUT_STATUSES.includes(l.status) || (PLANNED_STATUSES.includes(l.status) && l.start <= today && today <= l.end)));
}

/** Where an item stands today:
 * hidden (unlisted) > on loan (handed over, or due to start) > booked (a plan for later) > available.
 */
export function shelfState(item: Item, loans: Loan[], today = todayLocal()): ShelfState {
  if (!item.listed) return 'hidden';
  if (currentLoan(item, loans, today)) return 'on-loan';
  if (loans.some(l => l.itemId === item.id && PLANNED_STATUSES.includes(l.status) && l.start > today)) return 'booked';
  return 'available';
}

const LABELS: Record<ShelfState, string> = { available: 'Available', booked: 'Available, loan planned', 'on-loan': 'On loan', hidden: 'Hidden' };

export function ShelfStrip({ items, loans, onOpen }: { items: Item[]; loans: Loan[]; onOpen?: (id: string) => void }) {
  if (!items.length) return <p className="muted shelf-strip__empty">Nothing on your shelf yet.</p>;
  const today = todayLocal();
  const states = items.map(item => shelfState(item, loans, today));
  return <>
    <ul className="shelf-strip">
      {items.map((item, i) => {
        const photo = item.images[0] ?? item.image;
        const state = states[i];
        return <li key={item.id}>
          <button type="button" className={`shelf-thumb is-${state}`} onClick={() => onOpen?.(item.id)} aria-label={`${item.name}: ${LABELS[state]}`}>
            <span className="shelf-thumb__ring">
              <ItemImage src={photo} alt="" />
            </span>
            {state === 'booked' && <span className="shelf-thumb__badge" aria-hidden="true" />}
            <span className="shelf-thumb__name">{item.name}</span>
          </button>
        </li>;
      })}
    </ul>
    <ul className="shelf-legend" aria-label="Key">
      <li><i className="is-available" />Available</li>
      <li><i className="is-on-loan" />On loan</li>
      <li><i className="is-hidden" />Hidden</li>
      {states.includes('booked') && <li><i className="is-booked" />Loan planned</li>}
    </ul>
  </>;
}
