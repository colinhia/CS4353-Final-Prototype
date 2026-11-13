import { useState } from "react";
import { bookingLookup, shiftMonth } from "../app/bookings";
import { dateLabel, todayLocal, type Loan } from "../app/domain";
import { useApp } from "../app/context";
import { calendarDays } from "../app/calendar";
import { Modal } from "../components/ui/shared";

export function DatePicker({ start, end, itemId, loans, me, ignoreLoanId, onDone, onClose }: {
  start: string; end: string;
  itemId: string; loans: Loan[] | undefined; me?: string; ignoreLoanId?: string;
  onDone: (start: string, end: string) => void; onClose: () => void;
}) {
  const { busy: saving } = useApp();
  loans = loans? loans : []
  const today = todayLocal();
  const [month, setMonth] = useState((start || today).slice(0, 7));
  const [range, setRange] = useState({ start, end });
  const { stateOf, rangeBlocked } = bookingLookup({ itemId, loans, me, today, ignoreLoanId });
  const changeMonth = (offset: number) => setMonth((m) => shiftMonth(m, offset));

  return (
    // Let the user choose an inclusive receive-to-return date range.
    <Modal title="Choose loan dates" onClose={onClose}>
      <p className="muted">Choose a receive date, then a return date.</p>
      <div className="calendar-title">
        <button
          disabled={saving}
          type="button"
          className="button"
          aria-label="Previous month"
          onClick={() => changeMonth(-1)}
        >
          ‹
        </button>
        <strong>
          {new Intl.DateTimeFormat("en-SG", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(new Date(month + "-01"))}
        </strong>
        <button
          disabled={saving}
          type="button"
          className="button"
          aria-label="Next month"
          onClick={() => changeMonth(1)}
        >
          ›
        </button>
      </div>

      <div className="calendar-grid">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
          // Label one weekday column in the Monday-first calendar.
          <span key={day}>{day}</span>
        ))}
        
        {calendarDays(month).map((day) => {
          const { state, mine } = stateOf(day);
          const blocked = state !== "free";
          const cls = [
            day.slice(0, 7) !== month && "outside",
            blocked && state !== "past" && `is-${state}`,
            mine && "is-mine",
            (day === range.start || day === range.end) && "selected",
            range.start && range.end && day > range.start && day < range.end && "in-range",
          ].filter(Boolean).join(" ");
          return (
            <button type="button" key={day} className={cls}
              disabled={saving || blocked}
              aria-label={`${dateLabel(day)}${blocked && state !== "past" ? `, ${state}` : ""}`}
              aria-pressed={day === range.start || day === range.end}
              onClick={() => {
                if (!range.start || range.end) return setRange({ start: day, end: "" });
                const [a, b] = day < range.start ? [day, range.start] : [range.start, day];
                // a range can't swallow someone else's booking: restart from this day
                setRange(rangeBlocked(a, b) ? { start: day, end: "" } : { start: a, end: b });
              }}>
              {Number(day.slice(-2))}
            </button>
          );
        })}

        <ul className="availability__legend">
          <li><i className="is-borrowed" />Borrowed</li>
          <li><i className="is-requested" />Requested</li>
        </ul>

      </div>
      <p className="muted">
        {range.start ? dateLabel(range.start) : "Receive date"} →
        {range.end ? dateLabel(range.end) : "Return date"}
      </p>
      <button
        className="button primary wide"
        type="button"
        disabled={saving || !range.start || !range.end}
        onClick={() => onDone(range.start, range.end)}
      >
        Use these dates
      </button>
    </Modal>
  );
}
