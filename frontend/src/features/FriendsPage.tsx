import { ItemImage } from '../components/ui/ItemImage';
import { useState } from "react";
import { useApp, uid } from "../app/context";
import { areFriends } from "../app/domain";
import {
  Avatar,
  Confirm,
  EmptyState,
  ErrorText,
  Modal,
} from "../components/ui/shared";
import { StarRow } from "../components/ui/ReviewCard";

export function FriendsPage({
  onChat,
  onItem,
  active = true,
}: {
  onChat: (id: string) => void;
  onItem: (id: string) => void;
  active?: boolean;
}) {
  const { store, perform, toast, busy: saving } = useApp();
  const [query, setQuery] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const me = store.activeUserId;
  const friendRecords = store.friends.filter(
    (f) => f.status === "accepted" && (f.from === me || f.to === me),
  );
  const incoming = store.friends.filter(
    (f) => f.to === me && f.status === "pending",
  );
  const outgoing = store.friends.filter(
    (f) => f.from === me && f.status === "pending",
  );

  const act = async (
    command: Parameters<typeof perform>[0],
    message: string,
  ) => {
    const result = await perform(command);
    // Show the success toast and clear the error only after the friend action succeeds.
    if (result.ok) {
      setError("");
      toast(message);
    } else setError(result.error);
    return result.ok;
  };

  const personRow = (id: string, action?: React.ReactNode) => {
    const p = store.people.find((p) => p.id === id)!;
    return (
      // Represent one friend with profile access and conversation or removal actions.
      <div className="friend-card" key={id}>
        <button
          disabled={saving}
          type="button"
          className="friend-person"
          onClick={() => setProfileId(id)}
        >
          <Avatar person={p} />
          <span>
            <strong>{p.name}</strong>
            <small>
              @{p.username} · {p.location}
            </small>
          </span>
        </button>
        {action}
      </div>
    );
  };

  const prefix = query.trim().toLowerCase();
  const suggestions = store.people.filter(
    (p) =>
      p.id !== me &&
      !store.friends.some(
        (f) =>
          (f.from === me && f.to === p.id) || (f.to === me && f.from === p.id),
      ) &&
      (p.name.toLowerCase().startsWith(prefix) ||
        p.username.toLowerCase().startsWith(prefix)),
  );
  const profile = store.people.find((p) => p.id === profileId);
  const shared = store.items.filter((i) => i.ownerId === profileId && i.listed);
  const reviews = (
    store.receivedReviews ??
    store.loans
      .filter((l) => !!l.review)
      .map((l) => ({ id: l.id, ownerId: l.ownerId, review: l.review! }))
  ).filter((l) => l.ownerId === profileId);

  return (
    // Group incoming requests, accepted friends, profile details, and community discovery.
    <main className="app-scroll">
      <ErrorText text={error} />
      {incoming.length > 0 && (
        <section>
          <h2>Friend requests</h2>
          {incoming.map((f) =>
            personRow(
              f.from,
              <div className="button-row">
                <button
                  disabled={saving}
                  className="button"
                  type="button"
                  onClick={() =>
                    act(
                      { type: "decline-friend", id: f.id },
                      "Friend request declined.",
                    )
                  }
                >
                  Decline
                </button>
                <button
                  disabled={saving}
                  className="button primary"
                  type="button"
                  onClick={() =>
                    act(
                      { type: "accept-friend", id: f.id },
                      "Friend request accepted.",
                    )
                  }
                >
                  Accept
                </button>
              </div>,
            ),
          )}
        </section>
      )}
      <section>
        <h2>Your friends</h2>
        {friendRecords.length ? (
          friendRecords.map((f) =>
            personRow(
              f.from === me ? f.to : f.from,
              <div className="button-row">
                <button
                  disabled={saving}
                  className="button"
                  type="button"
                  onClick={() => onChat(f.from === me ? f.to : f.from)}
                >
                  Message
                </button>
                <button
                  disabled={saving}
                  className="button subtle"
                  type="button"
                  onClick={() => setRemoving(f.id)}
                >
                  Remove
                </button>
              </div>,
            ),
          )
        ) : (
          <EmptyState
            title="Meet your neighbours"
            text="Add a friend to find the things they share more easily."
          />
        )}
      </section>
      {outgoing.length > 0 && (
        <section>
          <h2>Sent requests</h2>
          {outgoing.map((f) =>
            personRow(
              f.to,
              <button
                disabled={saving}
                className="button"
                type="button"
                onClick={() =>
                  act(
                    { type: "decline-friend", id: f.id },
                    "Friend request cancelled.",
                  )
                }
              >
                Cancel request
              </button>,
            ),
          )}
        </section>
      )}
      <section>
        <h2>Find people</h2>
        <label className="people-search">
          Name or username
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Start typing a name…"
          />
        </label>
        {suggestions.map((p) =>
          personRow(
            p.id,
            <button
              disabled={saving}
              className="button"
              type="button"
              onClick={() =>
                act(
                  { type: "request-friend", id: uid(), to: p.id },
                  "Friend request sent.",
                )
              }
            >
              Add friend
            </button>,
          ),
        )}
        {!suggestions.length && (
          <p className="muted">
            No other matching people. Existing friends and pending requests are
            shown above.
          </p>
        )}
      </section>

      {active && removing && (
        <Confirm
          title="Remove this friend?"
          text="You can add them again later. Your existing loans and conversations will stay available."
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            // Close the removal dialog only after the friendship is successfully removed.
            if (
              await act(
                { type: "remove-friend", id: removing },
                "Friend removed.",
              )
            )
              setRemoving(null);
          }}
        />
      )}

      {active && profile && (
        <Modal title={profile.name} onClose={() => setProfileId(null)}>
          <div className="public-profile">
            <Avatar person={profile} size={72} />
            <p>
              @{profile.username} · {profile.location}
            </p>
            {areFriends(store, me, profile.id) && (
              <span className="chip">Friend</span>
            )}
            <p>{profile.bio}</p>
            <button
              disabled={saving}
              className="button"
              type="button"
              onClick={() => {
                setProfileId(null);
                onChat(profile.id);
              }}
            >
              Message {profile.name}
            </button>
          </div>
          <h3>Shared items</h3>
          {shared.length ? (
            <div className="mini-item-list">
              {shared.map((item) => (
                // Open a listing shared by the person whose profile is being viewed.
                <button
                  disabled={saving}
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setProfileId(null);
                    onItem(item.id);
                  }}
                >
                  <ItemImage src={item.image} alt="" width={44} height={44} />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">No shared items yet.</p>
          )}
          <h3>Reviews</h3>
          {reviews.length ? (
            reviews.map((loan) => (
              // Display one completed-loan review received by the selected person.
              <article className="review-card" key={loan.id}>
                <strong className="review-card__leaves"><StarRow value={loan.review!.rating} label={`${loan.review!.rating} out of 5 leaves`} /></strong>
                <p>{loan.review!.text}</p>
              </article>
            ))
          ) : (
            <p className="muted">No reviews yet.</p>
          )}
        </Modal>
      )}
    </main>
  );
}
