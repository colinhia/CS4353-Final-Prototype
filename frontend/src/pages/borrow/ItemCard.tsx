import { ItemImage } from '../../components/ui/ItemImage';
import { faCircleCheck, faClock } from '../../components/ui/icons';
import { Icon } from '../../components/Icon';
import { FaIcon } from '../../components/ui/CategoryIcon';
import { Avatar } from '../../components/ui/shared';
import { useOptionalApp } from '../../app/context';
import type { BorrowItem } from './items';

const shortDate = (value: string) => new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z'));

/** Availability - "Available" or "Back <date>" (on loan). */
export function availabilityLabel(item: BorrowItem) {
  if (item.availability === 'on-loan') return { tone: 'on-loan', icon: faClock, text: item.backOn ? `Back ${shortDate(item.backOn)}` : 'On loan', full: item.backOn ? `On loan until ${shortDate(item.backOn)}` : 'On loan' };
  return { tone: 'available', icon: faCircleCheck, text: 'Available', full: 'Available now' };
}

export function ItemCard({ item, onOpen }: { item: BorrowItem & { ownerId?: string }; onOpen: () => void }) {
  const app = useOptionalApp();
  const owner = app?.store.people.find(p => p.id === item.ownerId);
  const ownerName = owner?.name ?? item.owner;
  const status = availabilityLabel(item);

  return <button className="item-card" id={`item-${item.id}`} type="button" onClick={onOpen}
    aria-label={`View ${item.name}. ${status.full}. ${item.location}.${ownerName ? ` Listed by ${ownerName}${item.isFriend ? ', your friend' : ''}.` : ''}`}>
    {ownerName && <span className="item-byline" aria-hidden="true">
      {owner && <Avatar person={owner} size={18} />}
      <span className="item-byline__name">{ownerName}</span>
      {item.isFriend && <span className="item-byline__friend">Friend</span>}
    </span>}
    <span className="item-visual" aria-hidden="true">
      <ItemImage className="item-photo" src={item.image} alt="" width={166} height={166} />
      <span className={`item-status item-status--${status.tone}`} title={status.full}><FaIcon icon={status.icon} size={status.tone === 'available' ? 13 : 11} />{status.tone === 'available' ? null : status.text}</span>
    </span>
    <span className="item-info" aria-hidden="true">
      <span className="item-name">{item.name}</span>
      <span className="item-meta"><Icon name="map-pin" width={13} />{item.location}</span>
    </span>
  </button>;
}
