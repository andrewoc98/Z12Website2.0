import type { EventDoc } from "../types";
import { isErgEvent } from "./categories";

/**
 * When entries open and close.
 *
 * Three things can close registration, in this order of authority:
 *
 *   1. The event has been held. Nothing re-opens entries after the end date —
 *      not the host's switch, not a missing deadline.
 *   2. The host's manual switch (`registrationOpen`). `false` closes entries
 *      early; `true` keeps them open past any closing date, which is the whole
 *      point of flipping it back on. Absent means the switch was never touched,
 *      so the dates decide — that is every event created before the switch
 *      existed, and every new event that has a real closing date.
 *   3. The closing date. Water events normally have one. Erg events and water
 *      events created with "no closing date" do not: they store closeAt = endAt
 *      so date-driven consumers (bow assignment, refunds, reminders) keep
 *      working, and entries simply run until the event ends.
 */

type EventLike = Pick<
    EventDoc,
    "eventType" | "closingDate" | "endDate" | "noClosingDate" | "registrationOpen"
>;

function toMs(iso: string | undefined): number | null {
    if (!iso) return null;
    const ms = new Date(iso).getTime();
    return Number.isNaN(ms) ? null : ms;
}

/** True when the event carries a registration deadline of its own. */
export function hasClosingDate(e: EventLike): boolean {
    return !isErgEvent(e) && e.noClosingDate !== true && !!e.closingDate;
}

/** The instant entries close on their own, ignoring the manual switch. */
export function registrationCloseMs(e: EventLike): number | null {
    return hasClosingDate(e) ? toMs(e.closingDate) : toMs(e.endDate);
}

/** The event has been held — the one thing the host cannot override. */
export function eventHasEnded(e: EventLike): boolean {
    const end = toMs(e.endDate);
    return end != null && Date.now() > end;
}

export function isRegistrationClosed(e: EventLike): boolean {
    if (eventHasEnded(e)) return true;
    if (e.registrationOpen === false) return true;
    if (e.registrationOpen === true) return false;
    const close = registrationCloseMs(e);
    return close != null && Date.now() > close;
}

export function isRegistrationOpen(e: EventLike): boolean {
    return !isRegistrationClosed(e);
}

/**
 * One line of plain English for the current state, used under the host's switch
 * and on the public event page so the effective deadline is never a guess.
 */
export function registrationCloseSummary(
    e: EventLike,
    formatDate: (iso?: string) => string,
): string {
    if (eventHasEnded(e)) return "The event has been held — entries are closed for good.";
    if (e.registrationOpen === false) return "Entries are closed. No new registrations can be taken.";

    if (e.registrationOpen === true && hasClosingDate(e)) {
        return `You opened entries manually, so the closing date (${formatDate(e.closingDate)}) no longer applies — entries stay open until the event ends on ${formatDate(e.endDate)}.`;
    }
    if (hasClosingDate(e)) {
        return `Entries close automatically on ${formatDate(e.closingDate)}.`;
    }
    return `No closing date — entries stay open until the event ends on ${formatDate(e.endDate)}, or until you close them.`;
}
