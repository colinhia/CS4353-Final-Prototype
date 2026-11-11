import { useState, type CSSProperties } from 'react';
import type { IconDefinition } from './icons';
import { faBoxOpen, faComment, faHeart, faThumbsUp } from './icons';
import { ComplimentBadge } from './ComplimentBadge';
import type { Person } from '../../app/domain';
import { UserChip } from './UserChip';
import { FaIcon } from './CategoryIcon';
import { Modal } from './shared';
import './review-card.css';

/**
 * Compliment stickers: an icon on a coloured badge for each compliment
 * (matches COMPLIMENTS in app/domain.ts). Shared by the cards, the expanded view and the review form.
 */
export const COMPLIMENT_STICKERS: Record<string, { icon: IconDefinition; colour: string }> = {
  'Great communication': { icon: faComment, colour: '#BFE3FF' },
  'Easy collection': { icon: faBoxOpen, colour: '#FFE6A3' },
  'As described': { icon: faThumbsUp, colour: '#C6F3A2' },
};
const FALLBACK_STICKER = { icon: faHeart, colour: '#F7C8FF' };

export type ReviewCardData = {
  id: string;
  rating: number;
  text: string;
  compliments: string[];
  photo?: string;
  author?: Person;
};

// Where each leaf sticker sits in its little cluster (x, y in px) and its tilt.
const LEAF_SPOTS: [number, number, number][] = [[0, 15, -12], [12, 3, 8], [24, 13, -4], [36, 1, 14], [45, 16, -9]];
// FontAwesome 6 "leaf" icon (512x512 viewBox).
const LEAF_PATH = 'M471.3 6.7C477.7 .6 487-1.6 495.6 1.2 505.4 4.5 512 13.7 512 24l0 186.9c0 131.2-108.1 237.1-238.8 237.1-77 0-143.4-49.5-167.5-118.7-35.4 30.8-57.7 76.1-57.7 126.7 0 13.3-10.7 24-24 24S0 469.3 0 456C0 381.1 38.2 315.1 96.1 276.3 131.4 252.7 173.5 240 216 240l80 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-80 0c-39.7 0-77.3 8.8-111 24.5 23.3-70 89.2-120.5 167-120.5 66.4 0 115.8-22.1 148.7-44 19.2-12.8 35.5-28.1 50.7-45.3z';
const TILTS = [-1.2, 0.9, -0.5, 1.3, -0.8, 0.4];


export function ReviewCard({ review, index = 0, showAuthor = false }: { review: ReviewCardData; index?: number; showAuthor?: boolean }) {
  const [open, setOpen] = useState(false);
  const stars = Math.max(0, Math.min(5, Math.round(review.rating)));
  const compliments = review.compliments.slice(0, 3);
  const author = showAuthor && review.author ? review.author : null;
  const label = `${author ? `Review by ${author.name}` : 'Review'}, ${stars} out of 5 leaves${compliments.length ? `, compliments: ${compliments.join(', ')}` : ''}`;

  return <article className={`polaroid${review.photo ? ' polaroid--photo' : ''}`} aria-label={label}
    style={{ '--tilt': `${TILTS[index % TILTS.length]}deg` } as CSSProperties}>
    <span className="polaroid__peg" aria-hidden="true" />
    <button type="button" className="polaroid__open" aria-label={`Open review: ${label}`} onClick={() => setOpen(true)} />
    {review.photo && <div className="polaroid__photo"><img src={review.photo} alt="Reviewer's photo" loading="lazy" /></div>}
    <p className="polaroid__text">{review.text}</p>
    {author && <div className="polaroid__author">
      <span className="author-sticker"><UserChip person={author} size={22} /></span>
    </div>}
    <div className="polaroid__stickers">
      <span className="star-stickers" aria-hidden="true" style={{ width: stars ? LEAF_SPOTS[stars - 1][0] + 22 : 0 }}>
        {LEAF_SPOTS.slice(0, stars).map(([x, y, r], i) => <svg key={i} className="star-sticker" viewBox="0 0 512 512" style={{ left: x, top: y, rotate: `${r}deg` }}>
          <path d={LEAF_PATH} />
        </svg>)}
      </span>
      <span className="compliment-stickers" aria-hidden="true">
        {compliments.map((c, i) => <ComplimentSticker key={c} name={c} index={i} />)}
      </span>
    </div>
    {open && <ReviewDetails review={review} author={author} onClose={() => setOpen(false)} />}
  </article>;
}

// Expanded view of review
function ReviewDetails({ review, author, onClose }: { review: ReviewCardData; author: Person | null; onClose: () => void }) {
  const stars = Math.max(0, Math.min(5, Math.round(review.rating)));
  return <Modal title="Review" onClose={onClose} className="review-details">
    <div className="polaroid polaroid--large">
      {review.photo && <div className="polaroid__photo"><img src={review.photo} alt="Reviewer's photo" /></div>}
      <p className="polaroid__text">{review.text}</p>
      {author && <div className="polaroid__author">
        <span className="author-sticker"><UserChip person={author} size={22} /></span>
      </div>}
      <StarRow value={stars} size={26} label={`${stars} out of 5 leaves`} />
    </div>
    {review.compliments.length > 0 && <ul className="compliment-tiles" aria-label="Compliments">
      {review.compliments.map(c => <li key={c}><ComplimentTile name={c} selected /></li>)}
    </ul>}
  </Modal>;
}

export function StarRow({ value, size = 22, label }: { value: number; size?: number; label?: string }) {
  return <span className="star-row" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    {[1, 2, 3, 4, 5].map(n => <StarSticker key={n} on={n <= value} size={size} />)}
  </span>;
}
export function StarSticker({ on, size = 22 }: { on: boolean; size?: number }) {
  return <svg className={`star-sticker star-sticker--inline${on ? '' : ' star-sticker--off'}`} viewBox="0 0 512 512" width={size} height={size} style={{ width: size, height: size }} aria-hidden="true">
    <path d={LEAF_PATH} />
  </svg>;
}

// Compliments
export function ComplimentTile({ name, selected }: { name: string; selected: boolean }) {
  const sticker = COMPLIMENT_STICKERS[name] ?? FALLBACK_STICKER;
  return <span className={`compliment-tile${selected ? ' compliment-tile--on' : ''}`}>
    <ComplimentBadge name={name} colour={sticker.colour} />
    <span className="sr-only">{name}</span>
  </span>;
}

function ComplimentSticker({ name, index }: { name: string; index: number }) {
  const sticker = COMPLIMENT_STICKERS[name] ?? FALLBACK_STICKER;
  return <span className="compliment-sticker" title={name}
    style={{ background: sticker.colour, rotate: `${[8, -10, 5][index % 3]}deg` }}>
    <FaIcon icon={sticker.icon} size={13} />
  </span>;
}

export function ReviewSummary({ review }: { review: { rating: number; text: string; compliments: string[]; photo?: string } }) {
  const stars = Math.max(0, Math.min(5, Math.round(review.rating)));
  return <div className="review-summary">
    <StarRow value={stars} size={24} label={`${stars} out of 5 leaves`} />
    <p className="review-summary__text">{review.text}</p>
    {review.compliments.length > 0 && <ul className="compliment-tiles compliment-tiles--small" aria-label="Compliments">
      {review.compliments.map(c => <li key={c}><ComplimentTile name={c} selected /></li>)}
    </ul>}
    {review.photo && <img className="review-photo" src={review.photo} alt="Review attachment" />}
  </div>;
}

export function ComplimentTally({ reviews }: { reviews: { compliments: string[] }[] }) {
  const counts = new Map<string, number>();
  for (const review of reviews) for (const c of new Set(review.compliments)) counts.set(c, (counts.get(c) ?? 0) + 1);
  if (!counts.size) return null;
  return <ul className="compliment-tiles compliment-tiles--small compliment-tally" aria-label="Compliments received">
    {[...counts].map(([name, count]) => <li key={name} aria-label={`${name}: ${count}`}>
      <ComplimentTile name={name} selected />
      <span className="compliment-tally__count" aria-hidden="true">×{count}</span>
    </li>)}
  </ul>;
}

