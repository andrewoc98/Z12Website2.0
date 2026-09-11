import { describe, it, expect } from "vitest";
import { mapEvent } from "../../src/app/features/events/lib/mapper";
import { isErgEvent, eventTypeOf } from "../../src/app/features/events/lib/categories";

/** Minimal Firestore Timestamp stand-in — mapEvent only calls toDate(). */
const ts = (d: Date) => ({ toDate: () => d });

const START = new Date("2026-09-01T00:01:00Z");
const END   = new Date("2026-09-30T23:59:00Z");

function raw(extra: Record<string, unknown> = {}) {
    return {
        name: "Test Event",
        startAt: ts(START),
        endAt: ts(END),
        closeAt: ts(END),
        status: "running",
        location: "Remote",
        lengthMeters: 2000,
        categories: [{ id: "Men • Senior Open", name: "Men • Senior Open" }],
        createdByUid: "host-1",
        hostId: "host-1",
        resultsPublishMode: "Live",
        ...extra,
    };
}

describe("mapEvent", () => {
    // mapEvent copies fields one by one, so a new field on the document is
    // silently dropped unless it is added here too. That is exactly how the
    // erg branch of the UI once ended up unreachable: the event page reads
    // eventType through this mapper and nowhere else.
    it("carries eventType through", () => {
        const ev = mapEvent("e1", raw({ eventType: "erg" }));
        expect(ev.eventType).toBe("erg");
        expect(isErgEvent(ev)).toBe(true);
    });

    it("carries ergConfig through", () => {
        const ev = mapEvent("e1", raw({
            eventType: "erg",
            ergConfig: { machineType: "rower", distanceMeters: 2000 },
        }));
        expect(ev.ergConfig).toEqual({ machineType: "rower", distanceMeters: 2000 });
    });

    it("treats an event with no eventType as open water", () => {
        const ev = mapEvent("e1", raw());
        expect(ev.eventType).toBeUndefined();
        expect(eventTypeOf(ev)).toBe("open_water");
        expect(isErgEvent(ev)).toBe(false);
    });

    it("maps an explicit open_water event as open water", () => {
        const ev = mapEvent("e1", raw({ eventType: "open_water" }));
        expect(isErgEvent(ev)).toBe(false);
    });

    it("still maps the fields the rest of the page depends on", () => {
        const ev = mapEvent("e1", raw({ eventType: "erg" }));
        expect(ev.id).toBe("e1");
        expect(ev.name).toBe("Test Event");
        expect(ev.lengthMeters).toBe(2000);
        expect(ev.startDate).toBe(START.toISOString());
        expect(ev.endDate).toBe(END.toISOString());
        expect(ev.closingDate).toBe(END.toISOString());
        expect(ev.categories).toHaveLength(1);
        expect(ev.resultsPublishMode).toBe("Live");
    });
});
