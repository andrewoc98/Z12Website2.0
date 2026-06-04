import type { EventDoc } from "../../events/types";

type EventWithId = EventDoc & { id: string };

const DAY = 86_400_000;
const HOUR = 3_600_000;

function future(ms: number): string {
    return new Date(Date.now() + ms).toISOString();
}

export const TOUR_ROWER_EVENTS: EventWithId[] = [
    {
        id: "tour-event-1",
        name: "Z12 Spring League — Stage 1",
        location: "National Rowing Centre, Cork",
        lengthMeters: 2000,
        status: "open",
        startDate: future(16 * DAY),
        endDate: future(17 * DAY),
        closingDate: future(10 * DAY),
        categories: [
            { id: "senior-men", name: "Men • Senior Open • 1x" },
            { id: "senior-women", name: "Women • Senior Open • 1x" },
        ],
        resultsPublishMode: "live",
    },
    {
        id: "tour-event-2",
        name: "Z12 Summer Series — Stage 2",
        location: "Lough Rynn Rowing Club, Leitrim",
        lengthMeters: 1000,
        status: "open",
        startDate: future(30 * DAY),
        endDate: future(31 * DAY),
        closingDate: future(24 * DAY),
        categories: [{ id: "senior-men", name: "Men • Senior Open • 1x" },
            { id: "senior-women", name: "Women • Senior Open • 1x" }],
        resultsPublishMode: "live",
    },
];

export const TOUR_HOST_EVENTS: EventWithId[] = [
    {
        id: "tour-host-event-1",
        name: "Z12 Spring League — Stage 1",
        location: "National Rowing Centre, Cork",
        lengthMeters: 2000,
        status: "open",
        startDate: future(16 * DAY),
        endDate: future(17 * DAY),
        closingDate: future(10 * DAY),
        categories: [{ id: "senior-men", name: "Men • Senior Open • 1x" },
            { id: "senior-women", name: "Women • Senior Open • 1x" }],
        resultsPublishMode: "live",
    },
    {
        id: "tour-host-event-2",
        name: "Z12 Summer Series — Stage 2",
        location: "Lough Rynn Rowing Club, Leitrim",
        lengthMeters: 1000,
        status: "open",
        startDate: future(30 * DAY),
        endDate: future(31 * DAY),
        closingDate: future(24 * DAY),
        categories: [{ id: "senior-men", name: "Men • Senior Open • 1x" },
            { id: "senior-women", name: "Women • Senior Open • 1x" }],
        resultsPublishMode: "live",
    },
];

import type { BoatTimingDoc } from "../../timing/types";

// Mock boats for the timing page — mix of statuses so all three tabs have content.
export const TOUR_TIMING_BOATS: BoatTimingDoc[] = [
    {
        id: "tour-boat-1", eventId: "tour-timing-event-1",
        bowNumber: 1, boatSize: 1,
        category: "Men • Senior Open • 1x",
        categoryId: "senior-men", categoryName: "Men • Senior Open • 1x",
        clubName: "Liffey Vikings RC",
        rowerUids: ["tour-rower-1"], status: "registered",
        activeRunId: null, startedAt: null, finishedAt: null,
        elapsedMs: null, adjustmentMs: 0,
        inviteCode: null, invitedEmails: [], createdAt: null, updatedAt: null,
    },
    {
        id: "tour-boat-2", eventId: "tour-timing-event-1",
        bowNumber: 2, boatSize: 1,
        category: "Women • Senior Open • 1x",
        categoryId: "senior-women", categoryName: "Women • Senior Open • 1x",
        clubName: "Cork Boat Club",
        rowerUids: ["tour-rower-2"], status: "registered",
        activeRunId: null, startedAt: null, finishedAt: null,
        elapsedMs: null, adjustmentMs: 0,
        inviteCode: null, invitedEmails: [], createdAt: null, updatedAt: null,
    },
    {
        id: "tour-boat-3", eventId: "tour-timing-event-1",
        bowNumber: 3, boatSize: 1,
        category: "Men • Senior Open • 1x",
        categoryId: "senior-men", categoryName: "Men • Senior Open • 1x",
        clubName: "Fermoy RC",
        rowerUids: ["tour-rower-3"], status: "in_progress",
        activeRunId: null, startedAt: Date.now() - 240_000, finishedAt: null,
        elapsedMs: null, adjustmentMs: 0,
        inviteCode: null, invitedEmails: [], createdAt: null, updatedAt: null,
    },
    {
        id: "tour-boat-4", eventId: "tour-timing-event-1",
        bowNumber: 4, boatSize: 1,
        category: "Women • Senior Open • 1x",
        categoryId: "senior-women", categoryName: "Women • Senior Open • 1x",
        clubName: "Skibbereen RC",
        rowerUids: ["tour-rower-4"], status: "finished",
        activeRunId: null, startedAt: Date.now() - 500_000,
        finishedAt: Date.now() - 75_000,
        elapsedMs: 425_000, adjustmentMs: 0,
        inviteCode: null, invitedEmails: [], createdAt: null, updatedAt: null,
    },
];

// Timing events use startAt / endAt (Firestore field names) as Date objects.
// One active event so the timing page shows the TIME EVENT button.
export const TOUR_TIMING_EVENTS = [
    {
        id: "tour-timing-event-1",
        name: "Z12 Spring League — Stage 1",
        location: "National Rowing Centre, Cork",
        lengthMeters: 2000,
        status: "running",
        startAt: new Date(Date.now() - 2 * HOUR),
        endAt: new Date(Date.now() + 22 * HOUR),
        categories: [{ id: "senior-men", name: "Men • Senior Open • 1x" },
            { id: "senior-women", name: "Women • Senior Open • 1x" }],
    },
    {
        id: "tour-timing-event-2",
        name: "Z12 Summer Series — Stage 2",
        location: "Lough Rynn Rowing Club, Leitrim",
        lengthMeters: 1000,
        status: "open",
        startAt: new Date(Date.now() + 14 * DAY),
        endAt: new Date(Date.now() + 15 * DAY),
        categories: [{ id: "senior-men", name: "Men • Senior Open • 1x" },
            { id: "senior-women", name: "Women • Senior Open • 1x" }],
    },
];
