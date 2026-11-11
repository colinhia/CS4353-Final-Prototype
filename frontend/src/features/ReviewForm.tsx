import { ItemImage } from '../components/ui/ItemImage';
import { useState } from "react";
import { useApp } from "../app/context";
import { COMPLIMENTS } from "../app/domain";
import { ErrorText, Modal } from "../components/ui/shared";
import { PhotoField } from "../components/ui/PhotoField";
import { StarSticker } from "../components/ui/ReviewCard";

export function ReviewForm({
  loanId,
  onClose,
}: {
  loanId: string;
  onClose: () => void;
}) {
  const { store, perform, toast, busy: saving } = useApp();
  const existing = store.loans.find(
    (l) => l.id === loanId && l.borrowerId === store.activeUserId,
  )?.review;
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [text, setText] = useState(existing?.text ?? "");
  const [compliments, setCompliments] = useState<string[]>(
    existing?.compliments ?? [],
  );
  const [photo, setPhoto] = useState(existing?.photo ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const loan = store.loans.find(
    (l) => l.id === loanId && l.borrowerId === store.activeUserId,
  );

  // Show a missing-loan state before trying to render its review form.
  if (!loan)
    return (
      // Explain why the requested loan cannot be reviewed from this account.
      <Modal title="Review unavailable" onClose={onClose}>
        <p>Only the borrower can review this loan.</p>
      </Modal>
    );

  const item = store.items.find((i) => i.id === loan.itemId)!;
  return (
    // Collect the borrower's rating, review text, compliments, and optional photo.
    <Modal title="Review your loan" onClose={onClose}>
      <div className="review-item">
        <ItemImage src={item.image} alt="" width={64} height={64} />
        <strong>{item.title ?? item.name}</strong>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await perform({
            type: existing ? "edit-review" : "submit-review",
            loanId,
            rating,
            text,
            compliments,
            ...(photo ? { photo } : {}),
          });
          // Keep the review draft and display a rejected save.
          if (!result.ok) {
            setError(result.error);
            return;
          }
          toast("Thank you! Your review has been saved.");
          onClose();
        }}
      >
        <fieldset className="rating-group">
          <legend>How was your experience?</legend>
          <div>
            {[1, 2, 3, 4, 5].map((value) => (
              // Represent one leaf rating using an accessible radio input.
              <label className="star-choice" key={value}>
                <input
                  className="sr-only"
                  type="radio"
                  name="rating"
                  value={value}
                  checked={rating === value}
                  onChange={() => setRating(value)}
                />
                <span
                  aria-hidden="true"
                  className={value <= rating ? "filled" : ""}
                >
                  <StarSticker on={value <= rating} size={34} />
                </span>
                <span className="sr-only">
                  {value} {value === 1 ? "leaf" : "leaves"}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          Your review
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            required
            placeholder="What went well?"
          />
        </label>
        <p>Give a compliment</p>
        <div className="chip-row">
          {COMPLIMENTS.map((c) => (
            // Toggle one predefined compliment on the review draft.
            <button
              disabled={saving}
              className="chip"
              type="button"
              key={c}
              aria-pressed={compliments.includes(c)}
              onClick={() =>
                setCompliments((values) =>
                  values.includes(c)
                    ? values.filter((v) => v !== c)
                    : [...values, c],
                )
              }
            >
              {c}
            </button>
          ))}
        </div>

        <PhotoField
          label="Review photo (optional)"
          value={photo}
          onChange={setPhoto}
          onBusyChange={setBusy}
        />
        <ErrorText text={error} />
        <div className="form-actions">
          <button
            disabled={saving}
            className="button"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="button primary"
            type="submit"
            disabled={saving || busy || !rating || !text.trim()}
          >
            Submit review
          </button>
        </div>
      </form>
    </Modal>
  );
}
