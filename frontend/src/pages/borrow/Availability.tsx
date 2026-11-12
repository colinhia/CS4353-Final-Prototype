import { useState } from 'react';
import { Glyph } from '../../components/ui/shared';
import { addDays, dateLabel, todayLocal, type Loan } from '../../app/domain';
import { calendarDays } from "../../app/calendar";
import { bookingLookup, shiftMonth, PENDING_STATUSES, type DayState } from "../../app/bookings";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const LOOKAHEAD_MONTHS = 12

// Same rule as booking conflicts: finished, declined and cancelled loans don't hold dates.
const FREE_STATUSES = ['complete', 'declined', 'cancelled'];
// const PENDING_STATUSES = ['requested', 'arranging'];
// const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
// const PAGE_DAYS = 14;
// const LOOKAHEAD_DAYS = 61; // about two months

// type DayState = 'free' | 'past' | 'taken' | 'mine' | 'mine-pending';

/** Monday of the week containing `day` (dates are YYYY-MM-DD, compared as UTC). */
function mondayOf(day: string) {
  const weekday = (new Date(day + 'T00:00:00Z').getUTCDay() + 6) % 7; // Mon = 0
  return addDays(day, -weekday);
}
const short = (day: string) => new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(day + 'T00:00:00Z'));
const range = (a: string, b: string) => a === b ? short(a) : `${short(a)} – ${short(b)}`;

/**
 * Two-week Monday–Sunday calendar for one item, with arrows to look ahead
 * about two months. Reads live loans, so it updates as bookings change.
 * `me` is the viewer: their own bookings are highlighted rather than greyed out.
 */
export function Availability({ itemId, loans = [], me, today = todayLocal() }: { itemId: string; loans?: Loan[]; me?: string; today?: string }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const minMonth = today.slice(0, 7);
  const maxMonth = shiftMonth(minMonth, LOOKAHEAD_MONTHS);
  const { active, stateOf } = bookingLookup({ itemId, loans, me, today });
  const days = calendarDays(month);

  // const bookings = loans
  //   .filter(l => l.itemId === itemId && !FREE_STATUSES.includes(l.status) && l.end >= today)
  //   .sort((a, b) => a.start.localeCompare(b.start));

  // function stateOf(day: string): DayState {
  //   if (day < today) return 'past';
  //   const own = mine.find(l => covers(l, day));
  //   if (own) return PENDING_STATUSES.includes(own.status) ? 'mine-pending' : 'mine';
  //   return others.some(l => covers(l, day)) ? 'taken' : 'free';
  // }

  // rOne-line summary, most relevant first
  const mine = active.filter((l) => l.borrowerId === me).sort((a, b) => a.start.localeCompare(b.start));
  const others = active.filter((l) => l.borrowerId !== me).sort((a, b) => a.start.localeCompare(b.start));
  const covers = (l: Loan, day: string) => l.start <= day && day <= l.end;
  const myNow = mine.find(l => covers(l, today));
  const myNext = mine.find(l => l.start > today);
  const takenNow = others.find(l => covers(l, today));
  const takenNext = others.find(l => l.start > today);
  let summary: { text: string; tone: 'free' | 'mine' | 'taken' };
  if (myNow) summary = { text: `You're borrowing this until ${short(myNow.end)}`, tone: 'mine' };
  else if (takenNow) summary = { text: `Unavailable until ${short(takenNow.end)}`, tone: 'taken' };
  else if (myNext) summary = { text: `${PENDING_STATUSES.includes(myNext.status) ? 'You requested' : "You're booked for"} ${range(myNext.start, myNext.end)}`, tone: 'mine' };
  else if (takenNext) summary = { text: `Available now · taken ${range(takenNext.start, takenNext.end)}`, tone: 'free' };
  else summary = { text: 'Available now', tone: 'free' };

  const inMonth = days.filter((d) => d.slice(0, 7) === month);
  const has = (s: DayState, isMine: boolean) =>
    inMonth.some((d) => {
      const r = stateOf(d);
      return r.state === s && r.mine === isMine;
    });  
  const labels: Record<DayState, string> = {
    free: "available", past: "past", borrowed: "borrowed", requested: "requested, awaiting approval",
  };

  return (
    <section className="availability" aria-label="Availability">
      <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", background: "#fff8", padding: 8 }}>
  {JSON.stringify(
    {
      me,
      totalLoans: loans.length,
      forThisItem: loans
        .filter((l) => l.itemId === itemId)
        .map((l) => ({ id: l.id, borrower: l.borrowerId, status: l.status, start: l.start, end: l.end })),
    },
    null,
    2,
  )}
</pre>
      <div className="availability__head">
        <h2>Availability</h2>
        <span className={`availability__status availability__status--${summary.tone}`}>{summary.text}</span>
      </div>

      <div className="availability__nav">
        <button type="button" className="availability__arrow availability__arrow--back" aria-label="Previous month"
          disabled={month <= minMonth} onClick={() => setMonth((m) => shiftMonth(m, -1))}>
          <Glyph name="chevron" size={18} />
        </button>
        <span aria-live="polite">
          {new Intl.DateTimeFormat("en-SG", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(month + "-01T12:00:00Z"))}
        </span>
        <button type="button" className="availability__arrow" aria-label="Next month"
          disabled={month >= maxMonth} onClick={() => setMonth((m) => shiftMonth(m, 1))}>
          <Glyph name="chevron" size={18} />
        </button>
      </div>

      <div className="availability__weekdays" aria-hidden="true">
        {WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <ol className="availability__grid" aria-label={`Availability for ${month}`}>
        {days.map((day) => {
          const { state, mine } = stateOf(day);
          const outside = day.slice(0, 7) !== month;
          return (
            <li key={day}
              className={`availability__day is-${state}${mine ? " is-mine" : ""}${outside ? " is-outside" : ""}${day === today ? " is-today" : ""}`}
              aria-label={`${dateLabel(day)}: ${labels[state]}${mine ? " (yours)" : ""}`}>
              {Number(day.slice(-2))}
            </li>
          );
        })}
      </ol>

        <ul className="availability__legend">
          <li><i className="is-free" />Available</li>
          {has("borrowed", true) && <li><i className="is-borrowed is-mine" />Your booking</li>}
          {has("requested", true) && <li><i className="is-requested is-mine" />Your request</li>}
          {has("borrowed", false) && <li><i className="is-borrowed" />Borrowed by others</li>}
          {has("requested", false) && <li><i className="is-requested" />Requested by others</li>}
        </ul>
    </section>
  );
}