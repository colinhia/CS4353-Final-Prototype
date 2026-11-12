import type { Loan } from "./domain";
import { useEffect, useState } from "react";

const FREE_STATUSES = ["complete", "declined", "cancelled"];
export const PENDING_STATUSES = ["requested", "arranging"];

export type DayState = "free" | "past" | "borrowed" | "requested";

export function bookingLookup(opts: {
  itemId: string;
  loans: Loan[];
  me?: string;
  today: string;
  ignoreLoanId?: string; // when editing a plan, don't block on your own loan
}) {
  const { itemId, loans, me, today, ignoreLoanId } = opts;
  const active = loans.filter(
    (l) => l.itemId === itemId && l.id !== ignoreLoanId &&
      !FREE_STATUSES.includes(l.status) && l.end >= today,
  );

  function stateOf(day: string): { state: DayState; mine: boolean } {
    if (day < today) return { state: "past", mine: false };
    const covering = active.filter((l) => l.start <= day && day <= l.end);
    if (covering.length === 0) return { state: "free", mine: false };
    // an approved booking wins over a pending request on the same day
    const approved = covering.find((l) => !PENDING_STATUSES.includes(l.status));
    const l = approved ?? covering[0];
    return {
      state: approved ? "borrowed" : "requested",
      mine: l.borrowerId === me,
    };
  }

  /** True if any day from a to b (inclusive) is past or already held. */
  function rangeBlocked(a: string, b: string) {
    const [from, to] = a <= b ? [a, b] : [b, a];
    return active.some((l) => l.start <= to && l.end >= from);
  }

  return { active, stateOf, rangeBlocked };
}

export function shiftMonth(month: string, offset: number) {
  const d = new Date(month + "-01T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 7);
}

export function useItemBookings(itemId: string, refreshKey?: unknown) {
  const [rows, setRows] = useState<Loan[]>([]);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("demo_item_bookings")
      .select("id, item_id, starts_on, ends_on, status")
      .eq("item_id", itemId)
      .then(({ data }) => {
        if (cancelled) return;
        setRows(
          (data ?? []).map((r) => ({
            id: r.id,
            itemId: r.item_id,
            start: r.starts_on,
            end: r.ends_on,
            status: r.status,
            borrowerId: undefined, // unknown, so the calendar treats it as someone else's
          })) as unknown as Loan[],
        );
      });
    return () => { cancelled = true; };
  }, [itemId, refreshKey]);
  return rows;
}

/** Your own loans win when ids match, so they keep their "yours" colours. */
export function mergeLoans(own: Loan[], bookings: Loan[]) {
  const ids = new Set(own.map((l) => l.id));
  return [...own, ...bookings.filter((b) => !ids.has(b.id))];
}