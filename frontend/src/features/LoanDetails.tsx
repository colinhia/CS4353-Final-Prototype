import { ReviewSummary } from "../components/ui/ReviewCard";
import { useState } from "react";
import { useApp } from "../app/context";
import {
  dateLabel,
  duration,
  LOCKERS,
  nextProof,
  proofActor,
  PROOF_LABELS,
  type Loan,
} from "../app/domain";
import { Icon } from "../components/Icon";
import { Confirm, EmptyState, ErrorText, Glyph } from "../components/ui/shared";
import { LoanForm } from "./LoanForm";
import { LoanSummary } from "./LoanSummary";

function ConditionForm({ loan }: { loan: Loan }) {
  const { store, perform, toast, busy: saving } = useApp();
  const [condition, setCondition] = useState<"good" | "issue">("good");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const isOwner = store.activeUserId === loan.ownerId;

  // Show borrowers a read-only condition update; only the owner receives the verification form.
  if (!isOwner)
    return (
      // Show the borrower the owner's condition note or pending-verification explanation.
      <div className="plan-details">
        <p>
          {loan.condition?.result === "issue"
            ? loan.condition.note
            : "The owner is checking the returned item."}
        </p>
      </div>
    );

  return (
    // Let the owner report the returned item's condition or resolve an existing issue.
    <form
      className="plan-details"
      onSubmit={async (e) => {
        e.preventDefault();
        const result = await perform(
          loan.condition?.result === "issue"
            ? { type: "resolve-condition", loanId: loan.id, note }
            : { type: "verify-condition", loanId: loan.id, condition, note },
        );
        // Display a condition-save error instead of the success toast.
        if (!result.ok) setError(result.error);
        else toast("Item condition updated.");
      }}
    >
      <h3>
        {loan.condition?.result === "issue"
          ? "Resolve condition issue"
          : "Check item condition"}
      </h3>
      {loan.condition?.result === "issue" ? (
        <p>{loan.condition.note}</p>
      ) : (
        <>
          <label className="radio-label">
            <input
              type="radio"
              checked={condition === "good"}
              onChange={() => setCondition("good")}
            />
            Returned in good condition
          </label>
          <label className="radio-label">
            <input
              type="radio"
              checked={condition === "issue"}
              onChange={() => setCondition("issue")}
            />
            There is an issue to discuss
          </label>
        </>
      )}
      <label>
        {loan.condition?.result === "issue" ? "Resolution note" : "Notes"}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          required={condition === "issue" || loan.condition?.result === "issue"}
        />
      </label>
      <ErrorText text={error} />
      <button disabled={saving} className="button primary" type="submit">
        {loan.condition?.result === "issue" ? "Mark resolved" : "Verify return"}
      </button>
    </form>
  );
}

export function LoanDetails({
  id,
  onBack,
  onChat,
  onHandover,
  onReview,
}: {
  id: string;
  onBack: () => void;
  onChat: (peer: string) => void;
  onHandover?: (id: string) => void;
  onReview?: (id: string) => void;
}) {
  const { store, perform, toast, busy: saving } = useApp();
  const [editing, setEditing] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [error, setError] = useState("");
  const loan = store.loans.find(
    (l) =>
      l.id === id &&
      (l.ownerId === store.activeUserId || l.borrowerId === store.activeUserId),
  );

  // Show a missing-loan state when the ID is absent or belongs to another account.
  if (!loan)
    return (
      // Explain that this account cannot access the requested loan.
      <main className="app-scroll">
        <EmptyState
          title="Loan not found"
          text="This loan is not available for this account."
        >
          <button
            disabled={saving}
            className="button"
            type="button"
            onClick={onBack}
          >
            Your loans
          </button>
        </EmptyState>
      </main>
    );

  const item = store.items.find((i) => i.id === loan.itemId)!;
  const peer =
    loan.ownerId === store.activeUserId ? loan.borrowerId : loan.ownerId;
  const isOwner = loan.ownerId === store.activeUserId;
  const step = nextProof(loan);
  const act = async (type: "approve-plan" | "decline-loan" | "cancel-loan") => {
    const result = await perform({ type, loanId: id });
    // Show failed loan actions without closing the confirmation dialog.
    if (!result.ok) setError(result.error);
    else {
      setError("");
      toast(
        type === "approve-plan"
          ? "Exchange plan approved."
          : type === "decline-loan"
            ? "Request declined."
            : "Loan cancelled.",
      );
      setCancel(false);
    }
  };

  const current = ["requested", "arranging"].includes(loan.status)
    ? 1
    : loan.status === "ready"
      ? 2
      : ["active", "returning"].includes(loan.status)
        ? 3
        : loan.status === "verifying"
          ? 4
          : 5;
  const plan = (
    <div className="plan-details">
      <h3>Plan Details</h3>

      {loan.previousPlan && !loan.approvals.includes(store.activeUserId) && (
        <section aria-label="Proposed changes">
          <strong>Plan changed — your approval is required</strong>
          {(["start", "end", "lockerId"] as const).map((field) => {
            const before = loan.previousPlan![field],
              after = loan[field];
            const label =
              field === "start"
                ? "Receive"
                : field === "end"
                  ? "Return"
                  : "Locker";
            const format = (v: string) =>
              field === "lockerId"
                ? (LOCKERS.find((l) => l.id === v)?.label ?? v)
                : dateLabel(v);
            return (
              // Compare a proposed plan field with its immediately preceding value.
              <p key={field}>
                {label}
                {before !== after ? " (changed)" : ""}: {format(before)} →{" "}
                {format(after)}
              </p>
            );
          })}
        </section>
      )}

      <p>
        <Glyph name="calendar" size={18} />
        <span>
          Receive: {dateLabel(loan.start)}
          <br />
          Return: {dateLabel(loan.end)}
          <br />
          Duration: {duration(loan.start, loan.end)} days
        </span>
      </p>
      <p>
        <Icon name="map-pin" width={18} />
        {LOCKERS.find((l) => l.id === loan.lockerId)?.name}
      </p>
      {!loan.proofs.ownerDropoff &&
        ["requested", "arranging", "ready"].includes(loan.status) && (
          <div className="button-row">
            <button
              disabled={saving}
              className="button"
              type="button"
              onClick={() => setCancel(true)}
            >
              × Cancel
            </button>
            <button
              disabled={saving}
              className="button accent"
              type="button"
              onClick={() => setEditing(true)}
            >
              <Glyph name="edit" />
              Edit
            </button>
          </div>
        )}

      <p className="approval-note">
        {loan.approvals.length === 2
          ? "Approved by you & the other participant"
          : loan.approvals.includes(store.activeUserId)
            ? "Waiting for the other participant to approve"
            : "Please review and approve the plan"}
      </p>
    </div>
  );

  return (
    // Present the loan summary, lifecycle progress, current actions, and evidence history.
    <main className="app-scroll loan-details">
      <LoanSummary loan={loan} />
      <ErrorText text={error} />
      {["cancelled", "declined"].includes(loan.status) ? (
        <EmptyState
          title={`Loan ${loan.status}`}
          text="You can choose another item or send a new request."
        />
      ) : (
        <ol className="loan-timeline">
          {[
            "Request Made",
            "Arranging Exchange Plan",
            "Loan Start",
            "Loan End",
            "Item Condition Verification",
            "Loan Review",
          ].map((label, index) => (
            // Represent a lifecycle stage as completed, current, or still upcoming.
            <li
              key={label}
              className={`${index < current ? "done" : index === current ? "current" : "upcoming"}`}
            >
              <h2>{label}</h2>
              {index === current && (
                <div className="timeline-content">
                  {index === 1 && (
                    <>
                      {plan}
                      {loan.status === "requested" && isOwner ? (
                        <div className="button-row">
                          <button
                            disabled={saving}
                            className="button"
                            type="button"
                            onClick={() => act("decline-loan")}
                          >
                            Decline
                          </button>
                          <button
                            disabled={saving}
                            className="button primary"
                            type="button"
                            onClick={() => act("approve-plan")}
                          >
                            Accept request
                          </button>
                        </div>
                      ) : !loan.approvals.includes(store.activeUserId) ? (
                        <button
                          disabled={saving}
                          className="button primary"
                          type="button"
                          onClick={() => act("approve-plan")}
                        >
                          Approve plan
                        </button>
                      ) : (
                        <p className="muted">
                          Your request is with{" "}
                          {store.people.find((p) => p.id === peer)?.name}.
                        </p>
                      )}
                    </>
                  )}

                  {(index === 2 || index === 3) && (
                    <>
                      <details>
                        <summary>Exchange plan</summary>
                        {plan}
                      </details>
                      {step && (
                        <>
                          <p>
                            {proofActor(loan, step) === store.activeUserId
                              ? PROOF_LABELS[step]
                              : `Waiting for ${store.people.find((p) => p.id === proofActor(loan, step))?.name} to ${PROOF_LABELS[step].toLowerCase()}.`}
                          </p>
                          {proofActor(loan, step) === store.activeUserId &&
                            onHandover && (
                              <button
                                disabled={saving}
                                className="button primary"
                                type="button"
                                onClick={() => onHandover(id)}
                              >
                                <Glyph name="qr" />
                                Show QR
                              </button>
                            )}
                        </>
                      )}
                    </>
                  )}

                  {index === 4 && <ConditionForm loan={loan} />}

                  {index === 5 &&
                    (loan.review ? (
                      <div className="review-card">
                        <ReviewSummary review={loan.review} />

                        <p className="muted">Review submitted</p>

                        {!isOwner && onReview && (
                          <button
                            disabled={saving}
                            className="button"
                            type="button"
                            onClick={() => onReview(id)}
                          >
                            Edit review
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <p>Thank you for returning the item.</p>
                        {!isOwner && onReview ? (
                          <button
                            disabled={saving}
                            className="button primary"
                            type="button"
                            onClick={() => onReview(id)}
                          >
                            Leave a review
                          </button>
                        ) : (
                          <p className="muted">
                            Waiting for the borrower's review.
                          </p>
                        )}
                      </>
                    ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="detail-footer">
        <button
          disabled={saving}
          className="button"
          type="button"
          onClick={() => onChat(peer)}
        >
          <Icon name="chat" width={35} />
          Chat with {store.people.find((p) => p.id === peer)?.name}
        </button>
      </div>

      {Object.keys(loan.proofs).length > 0 && (
        <details className="proof-history">
          <summary>Handover photos</summary>
          {Object.entries(loan.proofs).map(([key, proof]) => (
            // Display the evidence photo, its handover-stage label, and any issue note.
            <figure key={key}>
              <img
                src={proof.photo}
                alt={PROOF_LABELS[key as keyof typeof PROOF_LABELS]}
              />
              <figcaption>
                {PROOF_LABELS[key as keyof typeof PROOF_LABELS]} · Locker{" "}
                {proof.lockerNumber}
              </figcaption>
              {proof.issueNote && (
                <p className="issue-note" role="note">
                  <strong>Issue reported:</strong> {proof.issueNote}
                </p>
              )}
            </figure>
          ))}
        </details>
      )}

      {editing && (
        <LoanForm
          item={item}
          loan={loan}
          onClose={() => setEditing(false)}
          onDone={() => setEditing(false)}
        />
      )}
      {cancel && (
        <Confirm
          title="Cancel this loan?"
          text="The other participant will be notified. You can make another request later."
          onClose={() => setCancel(false)}
          onConfirm={() => act("cancel-loan")}
        />
      )}
    </main>
  );
}
