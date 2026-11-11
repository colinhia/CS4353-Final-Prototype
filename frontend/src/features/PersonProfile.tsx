import { ItemImage } from '../components/ui/ItemImage';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useApp, uid } from '../app/context';
import { areFriends } from '../app/domain';
import { Avatar, Modal } from '../components/ui/shared';
import { AvatarCarousel } from '../components/ui/AvatarCarousel';
import { LoanPills, loansBetween } from './LoanPills';
import { ComplimentTally, ReviewSummary } from '../components/ui/ReviewCard';

type OpenProfile = (personId: string) => void;
const ProfileContext = createContext<OpenProfile | null>(null);

/** Opens a person's profile modal from anywhere inside PersonProfileProvider. */
export function useOpenProfile() { return useContext(ProfileContext); }

/** 
 * Hosts the single profile modal for the whole app (formerly only on the
 * Friends page). Any UserChip or avatar can open it with useOpenProfile().
 */
export function PersonProfileProvider({ onChat, onItem, onLoan, children }: { onChat: (personId: string) => void; onItem: (itemId: string) => void; onLoan?: (loanId: string) => void; children: ReactNode }) {
  const [personId, setPersonId] = useState<string | null>(null);
  return <ProfileContext.Provider value={setPersonId}>
    {children}
    {personId && <PersonProfileModal personId={personId} onClose={() => setPersonId(null)}
      onChat={id => { setPersonId(null); onChat(id); }} onItem={id => { setPersonId(null); onItem(id); }}
      onLoan={onLoan ? id => { setPersonId(null); onLoan(id); } : undefined} />}
  </ProfileContext.Provider>;
}

function PersonProfileModal({ personId, onClose, onChat, onItem, onLoan }: { personId: string; onClose: () => void; onChat: (id: string) => void; onItem: (id: string) => void; onLoan?: (id: string) => void }) {
  const { store, perform, toast, busy: saving } = useApp();
  const profile = store.people.find(p => p.id === personId);
  if (!profile) return null;
  const me = store.activeUserId;
  const isMe = profile.id === me;
  const shared = store.items.filter(i => i.ownerId === profile.id && i.listed);
  const reviews = (store.receivedReviews ?? store.loans.filter(l => !!l.review).map(l => ({ id: l.id, ownerId: l.ownerId, review: l.review! }))).filter(l => l.ownerId === profile.id);
  const { live, completed } = isMe ? { live: [], completed: 0 } : loansBetween(store, me, profile.id);
  const link = store.friends.find(f => (f.from === me && f.to === profile.id) || (f.from === profile.id && f.to === me));
  const act = async (command: Parameters<typeof perform>[0], message: string) => { const result = await perform(command); toast(result.ok ? message : result.error); };
  const friendAction = isMe || link?.status === 'accepted' ? null
    : !link ? <button disabled={saving} className="button primary" type="button" onClick={() => act({ type: 'request-friend', id: uid(), to: profile.id }, 'Friend request sent.')}>Add friend</button>
      : link.to === me ? <button disabled={saving} className="button primary" type="button" onClick={() => act({ type: 'accept-friend', id: link.id }, 'Friend request accepted.')}>Accept friend request</button>
        : <button className="button" type="button" disabled>Request sent</button>;

  const theirCompleted = store.loans.filter(l => l.status === 'complete' && (l.ownerId === profile.id || l.borrowerId === profile.id)).length;
  const theirFriends = store.friends.filter(f => f.status === 'accepted' && (f.from === profile.id || f.to === profile.id)).length;
  const relation = isMe ? 'You' : areFriends(store, me, profile.id) ? 'Friend' : null;


  return <Modal title={profile.name} className="profile-modal" onClose={onClose}>
    <div className="public-profile">
      <AvatarCarousel className="avatar-carousel--small" label={`${profile.name}'s profile photo and avatar`} slideLabels={['Show profile photo', 'Show avatar']} slides={[
        ...(profile.avatar ? [<Avatar key="photo" person={profile} size={84} />] : []),
        <Avatar key="sprite" person={profile} size={84} prefer="sprite" />,
      ]} />
      <div className="public-profile__name">
        <strong>{profile.name}</strong>
        {relation && <span className="chip">{relation}</span>}
      </div>
      <p className="public-profile__meta">@{profile.username} · {profile.location}</p>
      {profile.bio && <p className="public-profile__bio">{profile.bio}</p>}
    </div>
    <div className="profile-stats profile-stats--panel" aria-label={`${profile.name}'s stats`}>
      <span><strong>{shared.length}</strong>Shared items</span>
      <span><strong>{theirCompleted}</strong>Completed loans{!isMe && completed > 0 && <small>{completed} with you</small>}</span>
      <span><strong>{theirFriends}</strong>Friends</span>
    </div>
    {!isMe && <div className="public-profile__actions">
      {friendAction}
      <button className="button" type="button" onClick={() => onChat(profile.id)}>Message</button>
    </div>}
    {live.length > 0 && <>
      <h3>Between you</h3>
      <LoanPills store={store} me={me} other={profile.id} onLoan={onLoan} />
    </>}
    <h3>Shared items</h3>
    {/* Shared items and reviews each scroll inside their own box*/}
    {shared.length
      ? <div className="mini-item-list profile-scroll">{shared.map(item => {
        const content = <><ItemImage src={item.image} alt="" width={44} height={44} /><span>{item.name}</span></>;
        return isMe
          ? <div key={item.id} className="mini-item-list__static">{content}</div>
          : <button key={item.id} type="button" onClick={() => onItem(item.id)}>{content}</button>;
      })}
      </div>
      : <p className="muted">No shared items yet.</p>}
    <h3>Reviews</h3>
    <ComplimentTally reviews={reviews.map(r => r.review)} />
    {reviews.length
      ? <div className="profile-scroll profile-scroll--reviews">{reviews.map(loan => <article className="review-card" key={loan.id}>
        <ReviewSummary review={loan.review} />
      </article>)}</div>
      : <p className="muted">No reviews yet.</p>}
  </Modal>;
}
