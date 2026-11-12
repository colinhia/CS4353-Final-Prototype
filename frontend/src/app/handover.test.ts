import assert from "node:assert/strict";
import { test } from "node:test";
import { validateImageFile } from "./images.ts";
import { applyCommand, handoverCode } from "./domain.ts";
import { createSeed } from "./seed.ts";
const env = {
  id: "handover",
  now: "2026-10-31T05:00:00Z",
  today: "2026-10-31",
};
test("photos reject unsupported file formats, empty files and oversized uploads", () => {
  // Verify that SVG files are rejected as photo uploads.
  assert.throws(
    () => validateImageFile({ type: "image/svg+xml", size: 100 }),
    /JPEG|PNG|WebP/,
  );
  // Verify that an empty image file is rejected.
  assert.throws(
    () => validateImageFile({ type: "image/png", size: 0 }),
    /empty/i,
  );
  // Verify that images larger than five megabytes are rejected.
  assert.throws(
    () => validateImageFile({ type: "image/png", size: 6 * 1024 * 1024 }),
    /5 MB/,
  );
  // Verify that a small JPEG passes file validation.
  assert.doesNotThrow(() =>
    validateImageFile({ type: "image/jpeg", size: 2000 }),
  );
});
test("a handover requires the completed locker scan assignment", () => {
  const s = createSeed(env.today),
    loan = s.loans.find((l) => l.id === "demo-active")!;
  // Verify that handover evidence is rejected until the locker scan is confirmed.
  assert.throws(
    () =>
      applyCommand(
        s,
        {
          type: "record-proof",
          loanId: loan.id,
          step: "borrowerPickup",
          code: handoverCode(loan, "borrowerPickup"),
          lockerNumber: "12",
          photo: "data:image/jpeg;base64,dGVzdA==",
        },
        env,
      ),
    /locker scan/i,
  );
  // Verify that even a confirmed scan must provide a valid assigned locker number.
  assert.throws(
    () =>
      applyCommand(
        s,
        {
          type: "record-proof",
          loanId: loan.id,
          step: "borrowerPickup",
          code: handoverCode(loan, "borrowerPickup"),
          lockerNumber: "0",
          assignmentVerified: true,
          photo: "data:image/jpeg;base64,dGVzdA==",
        },
        env,
      ),
    /valid locker/i,
  );
});
test("borrowers cannot review an unfinished loan or claim an owner handover", () => {
  const s = createSeed(env.today);
  // Verify that borrowers cannot review a loan before it is complete.
  assert.throws(
    () =>
      applyCommand(
        s,
        {
          type: "submit-review",
          loanId: "demo-active",
          rating: 5,
          text: "Hello",
          compliments: [],
        },
        env,
      ),
    /completed/i,
  );
  const l = s.loans.find((l) => l.id === "demo-incoming")!;
  // Verify that a handover cannot proceed before the loan is ready.
  assert.throws(
    () =>
      applyCommand(
        s,
        {
          type: "record-proof",
          loanId: l.id,
          step: "ownerDropoff",
          code: handoverCode(l, "ownerDropoff"),
          photo: "data:image/jpeg;base64,dGVzdA==",
          lockerNumber: "12",
          assignmentVerified: true,
        },
        env,
      ),
    /ready/i,
  );
});
test("an issue note is saved with the handover photo when one is reported", () => {
  const s = createSeed(env.today),
    loan = s.loans.find((l) => l.id === "demo-active")!;
  // Verify that a handover recorded without an issue stays note-free.
  assert.equal(
    applyCommand(
      s,
      {
        type: "record-proof",
        loanId: loan.id,
        step: "borrowerPickup",
        code: handoverCode(loan, "borrowerPickup"),
        lockerNumber: "12",
        assignmentVerified: true,
        photo: "data:image/jpeg;base64,dGVzdA==",
      },
      env,
    ).loans.find((l) => l.id === loan.id)!.proofs.borrowerPickup.issueNote,
    undefined,
    "no issue reported stores no issueNote key",
  );
  const withNote = createSeed(env.today),
    target = withNote.loans.find((l) => l.id === loan.id)!;
  // Verify that a reported issue is trimmed and stored with the proof photo.
  const updated = applyCommand(
    withNote,
    {
      type: "record-proof",
      loanId: loan.id,
      step: "borrowerPickup",
      code: handoverCode(loan, "borrowerPickup"),
      lockerNumber: "12",
      assignmentVerified: true,
      photo: "data:image/jpeg;base64,dGVzdA==",
      issueNote: "  Lid hinge is broken.  ",
    },
    env,
  );
  const proof = updated.loans
    .find((l) => l.id === loan.id)!
    .proofs.borrowerPickup;
  assert.equal(proof.issueNote, "Lid hinge is broken.");
  assert.equal(proof.photo, "data:image/jpeg;base64,dGVzdA==");
  // Verify that the handover peer is told an item issue was reported.
  assert.match(
    updated.notices.find(
      (n) => n.to === target.ownerId && n.loanId === loan.id,
    )!.text,
    /issue/i,
  );
});
test("a reported handover issue must describe the problem", () => {
  const s = createSeed(env.today),
    loan = s.loans.find((l) => l.id === "demo-active")!;
  const attempt = (issueNote: string) =>
    applyCommand(
      s,
      {
        type: "record-proof",
        loanId: loan.id,
        step: "borrowerPickup",
        code: handoverCode(loan, "borrowerPickup"),
        lockerNumber: "12",
        assignmentVerified: true,
        photo: "data:image/jpeg;base64,dGVzdA==",
        issueNote,
      },
      env,
    );
  // Verify that a too-short issue description is rejected without recording a proof.
  assert.throws(() => attempt("Dent"), /at least 5 characters/i);
  assert.throws(() => attempt("   "), /at least 5 characters/i);
  assert.equal(
    s.loans.find((l) => l.id === loan.id)!.proofs.borrowerPickup,
    undefined,
    "a rejected issue note records no proof",
  );
  // Verify that an issue note longer than 2000 trimmed characters is rejected.
  assert.throws(() => attempt("x".repeat(2001)), /at least 5 characters/i);
  // Verify that a 1998-character note padded with spaces is accepted and stored trimmed.
  assert.equal(
    attempt(`  ${"x".repeat(1998)}  `).loans
      .find((l) => l.id === loan.id)!
      .proofs.borrowerPickup.issueNote,
    "x".repeat(1998),
  );
});
