import { validDate, AppError } from "./validation.ts";
import {
  applyHelp,
  type HelpCommand,
  type HelpRequest,
  type Offer,
} from "./help.ts";
import type { BorrowItem } from "../pages/borrow/items.ts";
export type Person = {
  revision?: number;
  id: string;
  name: string;
  username: string;
  location: string;
  bio: string;
  avatar?: string;
  colour: string;
};
export type Item = BorrowItem & {
  revision?: number;
  ownerId: string;
  listed: boolean;
  images: string[];
};
export type ProofStep =
  "ownerDropoff" | "borrowerPickup" | "borrowerDropoff" | "ownerPickup";
export type LoanStatus =
  | "requested"
  | "arranging"
  | "ready"
  | "active"
  | "returning"
  | "verifying"
  | "complete"
  | "declined"
  | "cancelled";
export type Proof = {
  at: string;
  photo: string;
  actor: string;
  lockerNumber: string;
  // Optional issue note captured at this handover; shown under the handover photo.
  issueNote?: string;
};
export type Review = {
  rating: number;
  text: string;
  compliments: string[];
  photo?: string;
  at: string;
};
export type Loan = {
  revision?: number;
  id: string;
  itemId: string;
  ownerId: string;
  borrowerId: string;
  start: string;
  end: string;
  lockerId: string;
  status: LoanStatus;
  approvals: string[];
  proofs: Partial<Record<ProofStep, Proof>>;
  code: string;
  createdAt: string;
  previousPlan?: PlanInput;
  condition?: {
    result: "good" | "issue";
    note: string;
    at: string;
    resolution?: string;
  };
  review?: Review;
};
export type Message = {
  id: string;
  from: string;
  to: string;
  text: string;
  at: string;
  read: boolean;
  loanId?: string;
};
export type Friendship = {
  id: string;
  from: string;
  to: string;
  status: "pending" | "accepted";
};
export type Notice = {
  id: string;
  to: string;
  text: string;
  at: string;
  read: boolean;
  loanId?: string;
  peerId?: string;
};
export type Store = {
  version: 1;
  helpRequests?: HelpRequest[];
  offers?: Offer[];
  receivedReviews?: { id: string; ownerId: string; review: Review }[];
  activeUserId: string;
  people: Person[];
  items: Item[];
  loans: Loan[];
  messages: Message[];
  friends: Friendship[];
  notices: Notice[];
};
export const LOCKERS = [
  { id: "clementi", name: "Clementi", label: "Clementi Locker", number: "12" },
  {
    id: "toa-payoh",
    name: "Toa Payoh",
    label: "Toa Payoh Locker",
    number: "08",
  },
  {
    id: "kent-ridge",
    name: "Kent Ridge",
    label: "Kent Ridge Locker",
    number: "21",
  },
] as const;
export const COMPLIMENTS = [
  "Great communication",
  "Easy collection",
  "As described",
];
export const PROOF_STEPS: ProofStep[] = [
  "ownerDropoff",
  "borrowerPickup",
  "borrowerDropoff",
  "ownerPickup",
];
export const PROOF_LABELS: Record<ProofStep, string> = {
  ownerDropoff: "Drop off item",
  borrowerPickup: "Pick up item",
  borrowerDropoff: "Return item",
  ownerPickup: "Collect returned item",
};
// Calendar dates follow the demo's Singapore timezone, regardless of the browser location.
export function todayLocal() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((key) => parts.find((p) => p.type === key)!.value)
    .join("-");
}
export function addDays(value: string, days: number) {
  const date = new Date(value + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value + "T00:00:00Z"));
}
export { validDate, AppError } from "./validation.ts";
export function duration(start: string, end: string) {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
}
export function nextProof(loan: Loan) {
  return PROOF_STEPS.find((step) => !loan.proofs[step]);
}
export function proofActor(loan: Loan, step: ProofStep) {
  return step === "ownerDropoff" || step === "ownerPickup"
    ? loan.ownerId
    : loan.borrowerId;
}
export function handoverCode(loan: Loan, step: ProofStep) {
  return `CS4353:${loan.id}:${step}:${loan.code}`;
}
export function loanGroup(loan: Loan): "Pending" | "Active" | "Complete" {
  return ["requested", "arranging"].includes(loan.status)
    ? "Pending"
    : ["complete", "declined", "cancelled"].includes(loan.status)
      ? "Complete"
      : "Active";
}
export function areFriends(s: Store, a: string, b: string) {
  return s.friends.some(
    (f) =>
      f.status === "accepted" &&
      ((f.from === a && f.to === b) || (f.to === a && f.from === b)),
  );
}
export const SPRITE_LIMITS = { strokes: 40, points: 400, min: -0.5, max: 1.5 };
/**  Sprite colours are one of these names (same list as public.sprite_colour in the database). The hex for each is in components/sprites/palette.ts. */
export const SPRITE_COLOURS = [
  "pink",
  "green",
  "blue",
  "yellow",
  "peach",
  "purple",
  "turquoise",
  "grey",
] as const;
export type SpriteColour = (typeof SPRITE_COLOURS)[number];
export function spriteColourValid(colour: unknown): colour is SpriteColour {
  return (
    typeof colour === "string" &&
    (SPRITE_COLOURS as readonly string[]).includes(colour)
  );
}
//  Colour for someone who hasn't picked one: chosen from their id, so it's always the same for the same person.
export function defaultSpriteColour(id: string): SpriteColour {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SPRITE_COLOURS[h % SPRITE_COLOURS.length];
}
export function strokesValid(
  strokes: unknown,
): strokes is [number, number][][] {
  return (
    Array.isArray(strokes) &&
    strokes.length <= SPRITE_LIMITS.strokes &&
    strokes.every(
      (stroke) =>
        Array.isArray(stroke) &&
        stroke.length > 0 &&
        stroke.length <= SPRITE_LIMITS.points &&
        stroke.every(
          (pt) =>
            Array.isArray(pt) &&
            pt.length === 2 &&
            pt.every(
              (v) =>
                typeof v === "number" &&
                Number.isFinite(v) &&
                v >= SPRITE_LIMITS.min &&
                v <= SPRITE_LIMITS.max,
            ),
        ),
    )
  );
}
/**
 * Saved avatar
 * headAssetId: 'face-default' | 'face-drawn'
 */
export type PersonSprite = {
  colour: SpriteColour;
  headAssetId: string;
  torsoAssetId: string;
  level: number;
  faceStrokes?: [number, number][][];
};
/**
 * A person with their optional saved avatar. Kept beside Person rather than inside it
 * (upstream also edits the Person line) so the two branches merge without conflicts. mergescript
 * The connected demo stores it in demo_profiles.data, so it arrives on each person.
 */
export type SpritedPerson = Person & { sprite?: PersonSprite };
// Reads a person's saved avatar, if they have one.
export function spriteOf(person: Person | undefined): PersonSprite | undefined {
  return (person as SpritedPerson | undefined)?.sprite;
}
export function photoValid(photo: string) {
  return (
    photo.length <= 2_000_000 &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)
  );
}
function requireValue(ok: unknown, message: string): asserts ok {
  // Reject a command as soon as a required domain invariant fails.
  if (!ok) throw new AppError(message);
}
export type PlanInput = { start: string; end: string; lockerId: string };
export type Command =
  | HelpCommand
  | { type: "switch-account"; id: string }
  | ({ type: "request-loan"; id: string; itemId: string } & PlanInput)
  | ({ type: "edit-plan"; loanId: string } & PlanInput)
  | { type: "approve-plan" | "cancel-loan" | "decline-loan"; loanId: string }
  | {
      type: "record-proof";
      loanId: string;
      step: ProofStep;
      photo: string;
      code: string;
      lockerNumber: string;
      assignmentVerified?: boolean;
      // Optional note reporting an item issue observed during this handover.
      issueNote?: string;
    }
  | {
      type: "verify-condition";
      loanId: string;
      condition: "good" | "issue";
      note: string;
    }
  | { type: "resolve-condition"; loanId: string; note: string }
  | {
      type: "submit-review" | "edit-review";
      loanId: string;
      rating: number;
      text: string;
      compliments: string[];
      photo?: string;
    }
  | { type: "send-message"; to: string; text: string; loanId?: string }
  | { type: "read-thread"; peerId: string }
  | { type: "read-notices"; id?: string }
  | {
      type: "create-item";
      id: string;
      name: string;
      description: string;
      category: string;
      location: string;
      images: string[];
    }
  | {
      type: "edit-item";
      id: string;
      name: string;
      description: string;
      category: string;
      location: string;
      images: string[];
    }
  | { type: "toggle-item"; id: string }
  | { type: "request-friend"; id: string; to: string }
  | { type: "accept-friend" | "decline-friend" | "remove-friend"; id: string }
  | {
      type: "update-profile";
      name: string;
      username: string;
      location: string;
      bio: string;
      avatar?: string;
    }
  // Added update-sprite
  | {
      type: "update-sprite";
      colour: SpriteColour;
      face: "default" | "drawn";
      strokes?: [number, number][][];
    };
export type CommandEnv = { id: string; now: string; today: string };
// Validate and apply commands to a copy so failed operations leave the original store intact.
export function applyCommand(
  original: Store,
  command: Command,
  env: CommandEnv,
): Store {
  // Route community-help commands through their dedicated validation and state transitions.
  if (
    [
      "post-help",
      "close-help",
      "offer-help",
      "withdraw-offer",
      "select-offer",
    ].includes(command.type)
  )
    return applyHelp(original, command as HelpCommand, env, applyCommand);
  const s = structuredClone(original),
    me = s.activeUserId;
  const person = (id: string) => s.people.find((p) => p.id === id);
  const notify = (
    to: string,
    text: string,
    loanId?: string,
    peerId?: string,
  ) => {
    s.notices.unshift({
      id: `${env.id}-${s.notices.length}`,
      to,
      text,
      ...(loanId ? { loanId } : {}),
      ...(peerId ? { peerId } : {}),
      at: env.now,
      read: false,
    });
  };
  const name = person(me)?.name ?? "A member";
  const loanFor = (id: string) => {
    const l = s.loans.find((l) => l.id === id);
    // Require the target loan to exist before reading its fields.
    requireValue(l, "This loan could not be found.");
    // Restrict loan actions to that loan's owner or borrower.
    requireValue(
      l.ownerId === me || l.borrowerId === me,
      "Only a loan participant can do this.",
    );
    return l;
  };
  // Ignore the loan being edited while checking inclusive date overlap with other loans.
  const validatePlan = (itemId: string, p: PlanInput, ignore?: string) => {
    // Require both plan endpoints to be real calendar dates.
    requireValue(
      validDate(p.start) && validDate(p.end),
      "Choose valid receive and return dates.",
    );
    // Reject a receive date earlier than today's demo date.
    requireValue(
      p.start >= env.today,
      "The receive date cannot be in the past.",
    );
    // Require the return date to be on or after the receive date.
    requireValue(
      p.end >= p.start,
      "The return date must be on or after the receive date.",
    );
    // Require the selected locker ID to exist in the supported locker list.
    requireValue(
      LOCKERS.some((l) => l.id === p.lockerId),
      "Choose a locker location.",
    );
    // Reject inclusive date overlap with other unfinished loans for this item.
    requireValue(
      !s.loans.some(
        (l) =>
          l.id !== ignore &&
          l.itemId === itemId &&
          !["cancelled", "declined", "complete"].includes(l.status) &&
          p.start <= l.end &&
          p.end >= l.start,
      ),
      "These dates overlap another loan. Choose different dates.",
    );
  };
  switch (command.type) {
    case "switch-account":
      // Require a real person before switching the local active account.
      requireValue(person(command.id), "This account could not be found.");
      s.activeUserId = command.id;
      break;
    case "request-loan": {
      const item = s.items.find((i) => i.id === command.itemId);
      // Require an existing, publicly listed item before requesting a loan.
      requireValue(item?.listed, "This item is not available to borrow.");
      // Prevent owners from requesting their own items.
      requireValue(item.ownerId !== me, "You cannot borrow your own item.");
      // Reject a loan request ID already present in the store.
      requireValue(
        !s.loans.some((l) => l.id === command.id),
        "This request already exists.",
      );
      validatePlan(item.id, command);
      s.loans.unshift({
        id: command.id,
        itemId: item.id,
        ownerId: item.ownerId,
        borrowerId: me,
        start: command.start,
        end: command.end,
        lockerId: command.lockerId,
        status: "requested",
        approvals: [me],
        proofs: {},
        code: env.id
          .replace(/[^a-z0-9]/gi, "")
          .slice(-8)
          .toUpperCase(),
        createdAt: env.now,
      });
      notify(item.ownerId, `${name} requested ${item.name}.`, command.id);
      break;
    }
    case "approve-plan": {
      const l = loanFor(command.loanId);
      // Allow approval only before drop-off and while the loan is still being arranged.
      requireValue(
        ["requested", "arranging", "ready"].includes(l.status) &&
          !l.proofs.ownerDropoff,
        "This plan can no longer be approved.",
      );
      // Require the owner to accept the initial request before other approvals.
      if (l.status === "requested")
        // Restrict the initial acceptance to the item's owner.
        requireValue(me === l.ownerId, "The owner must accept this request.");
      // Record each participant's approval at most once.
      if (!l.approvals.includes(me)) l.approvals.push(me);
      l.status =
        l.approvals.includes(l.ownerId) && l.approvals.includes(l.borrowerId)
          ? "ready"
          : "arranging";
      notify(
        me === l.ownerId ? l.borrowerId : l.ownerId,
        `${name} approved the exchange plan.`,
        l.id,
      );
      break;
    }
    case "edit-plan": {
      const l = loanFor(command.loanId);
      // Allow plan editing only before drop-off and while the loan is still being arranged.
      requireValue(
        ["requested", "arranging", "ready"].includes(l.status) &&
          !l.proofs.ownerDropoff,
        "The exchange plan can no longer be edited.",
      );
      validatePlan(l.itemId, command, l.id);
      // Leave an unchanged exchange plan and its approvals intact.
      if (
        l.start === command.start &&
        l.end === command.end &&
        l.lockerId === command.lockerId
      )
        return original;
      l.previousPlan = { start: l.start, end: l.end, lockerId: l.lockerId };
      Object.assign(l, {
        start: command.start,
        end: command.end,
        lockerId: command.lockerId,
        approvals: [me],
        status: "arranging",
      });
      notify(
        me === l.ownerId ? l.borrowerId : l.ownerId,
        `${name} proposed a new exchange plan.`,
        l.id,
      );
      break;
    }
    case "cancel-loan":
    case "decline-loan": {
      const l = loanFor(command.loanId);
      // Allow cancellation only before drop-off and while the loan is still being arranged.
      requireValue(
        ["requested", "arranging", "ready"].includes(l.status) &&
          !l.proofs.ownerDropoff,
        "This loan cannot be cancelled after handover has started.",
      );
      // Apply the stricter owner-and-pending checks only to a decline action.
      if (command.type === "decline-loan")
        // Restrict declining to the owner of a still-pending request.
        requireValue(
          me === l.ownerId && l.status === "requested",
          "Only the owner can decline a pending request.",
        );
      l.status = command.type === "cancel-loan" ? "cancelled" : "declined";
      notify(
        me === l.ownerId ? l.borrowerId : l.ownerId,
        `${name} ${l.status} the loan.`,
        l.id,
      );
      break;
    }
    case "record-proof": {
      const l = loanFor(command.loanId);
      // Require a handover-capable loan status before recording evidence.
      requireValue(
        ["ready", "active", "returning"].includes(l.status),
        "This loan is not ready for a handover.",
      );
      // Require the submitted proof to be the next missing handover stage.
      requireValue(
        nextProof(l) === command.step,
        "Complete the next handover step in order.",
      );
      // Require the active user to be the actor assigned to this handover stage.
      requireValue(
        proofActor(l, command.step) === me,
        "Only the designated participant can complete this step.",
      );
      // Match the submitted code to this exact loan and handover stage.
      requireValue(
        command.code.trim() === handoverCode(l, command.step),
        "That code does not match this loan and handover step.",
      );
      // Require a supported base64 image within the evidence size limit.
      requireValue(
        photoValid(command.photo),
        "Add a valid item photo before continuing.",
      );
      // Require confirmation that the locker scan assigned the handover locker.
      requireValue(
        command.assignmentVerified,
        "The locker scan must be completed before recording a handover.",
      );
      // Require the assigned locker number to be positive and contain one or two digits.
      requireValue(
        /^\d{1,2}$/.test(command.lockerNumber) &&
          Number(command.lockerNumber) > 0,
        "The locker scan did not assign a valid locker.",
      );
      // Accept an optional issue note; when reporting an issue, describe it in
      // at least five trimmed characters and no more than 2000.
      requireValue(
        !command.issueNote ||
          (command.issueNote.trim().length >= 5 &&
            command.issueNote.trim().length <= 2000),
        "Describe the issue in at least 5 characters.",
      );
      l.proofs[command.step] = {
        at: env.now,
        photo: command.photo,
        actor: me,
        lockerNumber: command.lockerNumber,
        ...(command.issueNote?.trim()
          ? { issueNote: command.issueNote.trim() }
          : {}),
      };
      l.status =
        command.step === "ownerDropoff"
          ? "ready"
          : command.step === "borrowerPickup"
            ? "active"
            : command.step === "borrowerDropoff"
              ? "returning"
              : "verifying";
      notify(
        me === l.ownerId ? l.borrowerId : l.ownerId,
        command.issueNote?.trim()
          ? `${name} completed a handover and reported an item issue.`
          : `${name} completed a handover.`,
        l.id,
      );
      break;
    }
    case "verify-condition": {
      const l = loanFor(command.loanId);
      // Restrict return verification to the owner while the loan is awaiting verification.
      requireValue(
        me === l.ownerId && l.status === "verifying",
        "Only the owner can verify a returned item.",
      );
      // Accept only the two supported condition results: good or issue.
      requireValue(
        command.condition === "good" || command.condition === "issue",
        "Choose the item condition.",
      );
      // Require at least five trimmed note characters when reporting a condition issue.
      requireValue(
        command.condition === "good" || command.note.trim().length >= 5,
        "Describe the condition issue.",
      );
      l.condition = {
        result: command.condition,
        note: command.note.trim().slice(0, 2000),
        at: env.now,
      };
      // Complete the loan immediately only when the owner reports good condition.
      if (command.condition === "good") l.status = "complete";
      notify(
        l.borrowerId,
        command.condition === "good"
          ? "Your return was verified. You can now leave a review."
          : `${name} reported an item condition issue. Please discuss it in chat.`,
        l.id,
      );
      break;
    }
    case "resolve-condition": {
      const l = loanFor(command.loanId);
      // Require an unresolved issue on a verifying loan and the item's owner.
      requireValue(
        me === l.ownerId &&
          l.status === "verifying" &&
          l.condition?.result === "issue",
        "Only the owner can resolve this condition issue.",
      );
      // Require at least five trimmed characters explaining how the issue was resolved.
      requireValue(
        command.note.trim().length >= 5,
        "Add a short resolution note.",
      );
      l.condition.resolution = command.note.trim().slice(0, 2000);
      l.status = "complete";
      notify(
        l.borrowerId,
        "The condition issue has been resolved. You can now leave a review.",
        l.id,
      );
      break;
    }
    case "submit-review":
    case "edit-review": {
      const l = loanFor(command.loanId);
      // Restrict reviews to the borrower after the loan is complete.
      requireValue(
        me === l.borrowerId && l.status === "complete",
        "Only the borrower can review a completed loan.",
      );
      // Require an existing review for edits and no existing review for first submissions.
      requireValue(
        command.type === "edit-review" ? !!l.review : !l.review,
        command.type === "edit-review"
          ? "No review exists to edit."
          : "You have already reviewed this loan.",
      );
      // Require a whole-number rating from one through five.
      requireValue(
        Number.isInteger(command.rating) &&
          command.rating >= 1 &&
          command.rating <= 5,
        "Choose a rating from 1 to 5.",
      );
      // Require nonblank review text no longer than 2000 characters.
      requireValue(
        command.text.trim().length > 0 && command.text.length <= 2000,
        "Write a review of up to 2000 characters.",
      );
      // Accept only compliments from the predefined choices.
      requireValue(
        command.compliments.every((c) => COMPLIMENTS.includes(c)),
        "Choose one of the available compliments.",
      );
      // Validate a review photo when the optional photo is present.
      requireValue(
        !command.photo || photoValid(command.photo),
        "Choose a valid review photo.",
      );
      l.review = {
        rating: command.rating,
        text: command.text.trim(),
        compliments: [...new Set(command.compliments)],
        ...(command.photo ? { photo: command.photo } : {}),
        at: env.now,
      };
      notify(l.ownerId, `${name} left a review.`, l.id);
      break;
    }
    case "create-item":
    case "edit-item": {
      const existing = s.items.find((i) => i.id === command.id);
      // Require ownership when editing; the alternative branch requires a new listing ID.
      if (command.type === "edit-item")
        // Require the active user to own an existing listing before editing it.
        requireValue(
          existing?.ownerId === me,
          "Only the owner can edit this listing.",
        );
      else /* Require a fresh listing ID when creating an item. */ requireValue(!existing, "This listing already exists.");
      // Require a trimmed item name between one and 100 characters.
      requireValue(
        command.name.trim().length > 0 && command.name.trim().length <= 100,
        "Choose an item name of up to 100 characters.",
      );
      // Require nonblank listing details no longer than 2000 characters.
      requireValue(
        command.description.trim().length > 0 &&
          command.description.length <= 2000,
        "Write a description of up to 2000 characters.",
      );
      // Restrict listing categories to the supported catalog categories.
      requireValue(
        [
          "Home",
          "Electronics",
          "Party Supplies",
          "Outdoors",
          "Clothing",
          "Tools",
          "Sports",
        ].includes(command.category),
        "Choose an item category.",
      );
      // Require a location matching one of the supported locker communities.
      requireValue(
        LOCKERS.some((l) => l.name === command.location),
        "Choose a community location.",
      );
      // Allow at most four images, each a valid photo or an approved bundled asset.
      requireValue(
        command.images.length <= 4 &&
          command.images.every(
            (image) =>
              photoValid(image) ||
              [
                "/assets/item-placeholder.png",
                "/assets/denim-jacket.png",
              ].includes(image),
          ),
        "Choose valid listing photos.",
      );
      const images = command.images.length
        ? command.images
        : ["/assets/item-placeholder.png"];
      const value = {
        name: command.name.trim(),
        title: command.name.trim(),
        description: command.description.trim(),
        category: command.category,
        location: command.location,
        images,
        image: images[0],
      };
      // Replace an existing listing's fields; otherwise append a new listing.
      if (existing) Object.assign(existing, value);
      else
        s.items.unshift({
          id: command.id,
          ...value,
          ownerId: me,
          owner: name,
          isFriend: false,
          listed: true,
        });
      break;
    }
    case "toggle-item": {
      const item = s.items.find((i) => i.id === command.id);
      // Restrict listing visibility changes to the item's owner.
      requireValue(
        item?.ownerId === me,
        "Only the owner can change this listing.",
      );
      item.listed = !item.listed;
      break;
    }
    case "request-friend": {
      // Require a real recipient other than the active user for friend requests.
      requireValue(
        person(command.to) && command.to !== me,
        "Choose another person to add.",
      );
      // Prevent duplicate friendships or pending requests in either direction.
      requireValue(
        !s.friends.some(
          (f) =>
            (f.from === me && f.to === command.to) ||
            (f.from === command.to && f.to === me),
        ),
        "You are already friends or have a pending request.",
      );
      s.friends.push({
        id: command.id,
        from: me,
        to: command.to,
        status: "pending",
      });
      notify(command.to, `${name} sent you a friend request.`);
      break;
    }
    case "accept-friend":
    case "decline-friend":
    case "remove-friend": {
      const friend = s.friends.find((f) => f.id === command.id);
      // Require the friendship record to exist before acting on it.
      requireValue(friend, "This friend request is no longer available.");
      // Accept a pending friendship here; other actions remove it after permission checks.
      if (command.type === "accept-friend") {
        // Restrict acceptance to the recipient of a pending request.
        requireValue(
          friend.to === me && friend.status === "pending",
          "Only the recipient can accept a pending request.",
        );
        friend.status = "accepted";
        notify(friend.from, `${name} accepted your friend request.`);
      } else {
        // Restrict friendship changes to one of the two participants.
        requireValue(
          friend.from === me || friend.to === me,
          "Only a participant can change this friendship.",
        );
        // Allow declining only while the friendship request is still pending.
        requireValue(
          command.type !== "decline-friend" || friend.status === "pending",
          "This request has already been accepted.",
        );
        s.friends = s.friends.filter((f) => f.id !== friend.id);
      }
      break;
    }
    case "update-profile": {
      const profile = person(me)!;
      const username = command.username.trim().toLowerCase();
      // Require a nonblank display name of at most 80 characters.
      requireValue(
        command.name.trim().length > 0 && command.name.length <= 80,
        "Enter a display name of up to 80 characters.",
      );
      // Require a normalized username of 3–24 lowercase letters, digits, or underscores.
      requireValue(
        /^[a-z0-9_]{3,24}$/.test(username),
        "Use 3–24 letters, numbers or underscores for your username.",
      );
      // Require a username not used by any other profile, ignoring case.
      requireValue(
        !s.people.some(
          (p) => p.id !== me && p.username.toLowerCase() === username,
        ),
        "This username is already taken.",
      );
      // Limit profile biography text to 500 characters.
      requireValue(
        command.bio.length <= 500,
        "Keep your bio to 500 characters.",
      );
      // Restrict profile locations to supported locker communities.
      requireValue(
        LOCKERS.some((l) => l.name === command.location),
        "Choose a community location.",
      );
      // Validate the profile avatar when an optional image is supplied.
      requireValue(
        !command.avatar || photoValid(command.avatar),
        "Choose a valid profile photo.",
      );
      Object.assign(profile, {
        name: command.name.trim(),
        username,
        location: command.location,
        bio: command.bio.trim(),
      });
      // Replace the avatar only when the command supplies one.
      if (command.avatar) profile.avatar = command.avatar;
      else delete profile.avatar;
      break;
    }
    case "update-sprite": {
      const profile = person(me) as SpritedPerson;
      requireValue(spriteColourValid(command.colour), "Choose a valid colour.");
      const drawn = command.face === "drawn";
      requireValue(
        !drawn || (strokesValid(command.strokes) && command.strokes.length > 0),
        "Draw a face, or choose the default face.",
      );
      profile.sprite = {
        colour: command.colour,
        headAssetId: drawn ? "face-drawn" : "face-default",
        torsoAssetId: profile.sprite?.torsoAssetId ?? "plant",
        level: profile.sprite?.level ?? 0,
        ...(drawn ? { faceStrokes: command.strokes } : {}),
      };
      break;
    }
    case "send-message": {
      // Require nonblank message text no longer than 2000 characters.
      requireValue(
        command.text.trim().length > 0 && command.text.length <= 2000,
        "Write a message of up to 2000 characters.",
      );
      // Prevent the sender from addressing a message to themselves.
      requireValue(command.to !== me, "You cannot message yourself.");
      // Require the message recipient to exist.
      requireValue(person(command.to), "This person could not be found.");
      // Validate loan participation only for messages linked to a loan.
      if (command.loanId) {
        const loan = s.loans.find((l) => l.id === command.loanId);
        // Require both sender and recipient to participate in the referenced loan.
        requireValue(
          loan &&
            [loan.ownerId, loan.borrowerId].includes(me) &&
            [loan.ownerId, loan.borrowerId].includes(command.to),
          "Only the loan participants can discuss this loan.",
        );
      }
      s.messages.push({
        id: env.id,
        from: me,
        to: command.to,
        text: command.text.trim(),
        at: env.now,
        read: false,
        ...(command.loanId ? { loanId: command.loanId } : {}),
      });
      notify(command.to, `${name} sent you a message.`, undefined, me);
      break;
    }
    case "read-thread": {
      // Require an existing conversation peer before marking the thread read.
      requireValue(person(command.peerId), "This person could not be found.");
      s.messages.forEach((m) => {
        // Mark only messages sent by this peer to the active user as read.
        if (m.to === me && m.from === command.peerId) m.read = true;
      });
      s.notices.forEach((n) => {
        // Mark only this user's notices for the opened conversation as read.
        if (n.to === me && n.peerId === command.peerId) n.read = true;
      });
      break;
    }
    case "read-notices":
      s.notices.forEach((n) => {
        // Mark this user's notices, optionally restricted to the selected notice ID.
        if (n.to === me && (!command.id || command.id === n.id)) n.read = true;
      });
      break;
    default:
      throw new AppError("This action is not available.");
  }
  return s;
}
