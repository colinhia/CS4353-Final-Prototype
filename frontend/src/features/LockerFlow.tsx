import { useState } from "react";
import { useApp } from "../app/context";
import {
  handoverCode,
  LOCKERS,
  nextProof,
  proofActor,
  PROOF_LABELS,
} from "../app/domain";
import { ErrorText, Glyph, Modal } from "../components/ui/shared";
import { CameraCapture } from "../components/ui/CameraCapture";
import { LockerPosition } from "../components/ui/LockerPosition";
import { QrCode } from "../components/ui/QrCode";

export function LockerFlow({
  loanId,
  onClose,
  onDone,
}: {
  loanId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { store, perform, busy: saving } = useApp();
  const loan = store.loans.find((l) => l.id === loanId);
  const [step] = useState(() => (loan ? nextProof(loan) : undefined));
  const [phase, setPhase] = useState<"code" | "locker" | "photo" | "success">(
    "code",
  );
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  const pickup = step === "borrowerPickup" || step === "ownerPickup";
  const previous =
    loan &&
    (step === "borrowerPickup"
      ? loan.proofs.ownerDropoff
      : step === "ownerPickup"
        ? loan.proofs.borrowerDropoff
        : undefined);
  const lockerNumber =
    previous?.lockerNumber ??
    LOCKERS.find((l) => l.id === loan?.lockerId)?.number ??
    "12";

  // Block unavailable handovers, invalid stages, and the wrong actor; retain the success screen after completion.
  if (
    !loan ||
    !step ||
    (!["ready", "active", "returning"].includes(loan.status) &&
      phase !== "success") ||
    (proofActor(loan, step) !== store.activeUserId && phase !== "success")
  ) {
    return (
      // Explain why this account cannot perform the requested handover stage.
      <Modal title="Handover unavailable" onClose={onClose}>
        <p>
          Only the next participant can complete this handover. Open loan
          details for the current status.
        </p>
      </Modal>
    );
  }

  const expected = handoverCode(loan, step),
    item = store.items.find((i) => i.id === loan.itemId)!;
  return (
    // Guide the assigned participant through QR presentation, locker confirmation, photo, and success.
    <Modal
      title={phase === "success" ? "Verified successfully" : PROOF_LABELS[step]}
      onClose={onClose}
      className="locker-modal"
    >
      <p className="preview-note">
        Locker preview: no physical locker is connected.
      </p>

      {phase === "code" && (
        <>
          <p className="form-item-name">{item.title ?? item.name}</p>
          <QrCode value={expected} />
          <p className="handover-token">{expected}</p>
          <p>Show this QR code to the locker scanner to open your locker.</p>
          <p className="muted">
            For this preview, simulate the external locker scanning your code.
          </p>
          <button
            disabled={saving}
            className="button primary wide"
            type="button"
            onClick={() => {
              setError("");
              setPhase("locker");
            }}
          >
            Simulate locker scan
          </button>
        </>
      )}

      {phase === "locker" && (
        <>
          <p>The locker scan assigned you an available locker.</p>
          <p className="locker-location">
            {LOCKERS.find((l) => l.id === loan.lockerId)?.label}
          </p>
          <LockerPosition number={lockerNumber} />
          <p>
            {pickup
              ? "Collect the item from the locker shown above."
              : "Place the item in the locker shown above, then record its condition."}
          </p>
          <ErrorText text={error} />
          <button
            disabled={saving}
            className="button primary wide"
            type="button"
            onClick={() => setPhase("photo")}
          >
            Continue to item photo
          </button>
        </>
      )}

      {phase === "photo" && (
        <>
          <p>
            Record the item condition{" "}
            {pickup ? "when collecting it" : "before closing the locker"}.
          </p>
          <CameraCapture
            onChange={(file) => {
              if (!file) {
                setPhoto("");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setPhoto(String(reader.result));
              reader.readAsDataURL(file);
            }}
          />
          <ErrorText text={error} />
          <div className="form-actions">
            <button
              disabled={saving}
              className="button"
              type="button"
              onClick={() => setPhase("locker")}
            >
              Back
            </button>
            <button
              className="button primary"
              type="button"
              disabled={saving || !photo}
              onClick={async () => {
                const result = await perform({
                  type: "record-proof",
                  loanId,
                  step,
                  photo,
                  code: expected,
                  lockerNumber,
                  assignmentVerified: true,
                });
                // Keep the handover form open when recording the proof fails.
                if (!result.ok) setError(result.error);
                else setPhase("success");
              }}
            >
              Confirm {pickup ? "pickup" : "drop-off"}
            </button>
          </div>
        </>
      )}

      {phase === "success" && (
        <div className="verification-success">
          <span className="success-icon">
            <Glyph name="check" size={56} />
          </span>
          <h3>{pickup ? "Pickup verified" : "Drop-off verified"}</h3>
          <p>
            {item.title ?? item.name} · Locker {lockerNumber.padStart(2, "0")}
          </p>
          <p className="muted">
            The loan has been updated and the other participant notified.
          </p>
          <button
            disabled={saving}
            className="button primary wide"
            type="button"
            onClick={onDone}
          >
            Back to loan
          </button>
        </div>
      )}
    </Modal>
  );
}
