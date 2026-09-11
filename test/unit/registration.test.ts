import { describe, it, expect } from "vitest";
import {
    hasClosingDate,
    isRegistrationClosed,
    isRegistrationOpen,
    registrationCloseMs,
} from "../../src/app/features/events/lib/registration";

const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const DAY = 24 * 60 * 60 * 1000;

/** A water event whose closing date and end date are both in the future. */
function water(extra: Record<string, unknown> = {}) {
    return {
        eventType: "open_water" as const,
        closingDate: iso(3 * DAY),
        endDate: iso(7 * DAY),
        ...extra,
    };
}

describe("registration window", () => {
    it("keeps a dated water event open before its closing date", () => {
        const e = water();
        expect(hasClosingDate(e)).toBe(true);
        expect(registrationCloseMs(e)).toBe(new Date(e.closingDate).getTime());
        expect(isRegistrationOpen(e)).toBe(true);
    });

    it("closes a dated water event once the closing date passes", () => {
        expect(isRegistrationClosed(water({ closingDate: iso(-DAY) }))).toBe(true);
    });

    it("runs a no-closing-date event to the end of the event", () => {
        const e = water({ noClosingDate: true, registrationOpen: true, closingDate: iso(7 * DAY) });
        expect(hasClosingDate(e)).toBe(false);
        expect(registrationCloseMs(e)).toBe(new Date(e.endDate).getTime());
        expect(isRegistrationOpen(e)).toBe(true);
    });

    it("never takes an entry after the event has been held", () => {
        const held = water({
            noClosingDate: true,
            registrationOpen: true,
            startDate: iso(-3 * DAY),
            endDate: iso(-DAY),
        });
        expect(isRegistrationClosed(held)).toBe(true);
    });

    it("lets the host close entries early", () => {
        expect(isRegistrationClosed(water({ registrationOpen: false }))).toBe(true);
    });

    it("lets the host hold entries open past the closing date", () => {
        const reopened = water({ closingDate: iso(-DAY), registrationOpen: true });
        expect(isRegistrationOpen(reopened)).toBe(true);
    });

    it("leaves events created before the switch existed on their dates", () => {
        expect(isRegistrationOpen(water())).toBe(true);
        expect(isRegistrationClosed(water({ closingDate: iso(-DAY) }))).toBe(true);
    });

    it("treats an erg event as open until it ends", () => {
        const erg = { eventType: "erg" as const, closingDate: iso(7 * DAY), endDate: iso(7 * DAY) };
        expect(hasClosingDate(erg)).toBe(false);
        expect(isRegistrationOpen(erg)).toBe(true);
        expect(isRegistrationClosed({ ...erg, endDate: iso(-1) })).toBe(true);
    });
});
