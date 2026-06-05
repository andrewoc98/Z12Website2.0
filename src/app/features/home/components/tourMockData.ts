import type { EventDoc } from "../../events/types";
import type { Session } from "../../trainingSessions/types/session";
import type { RowerSessionSummary } from "../../trainingSessions/hooks/useRowerSessions";
import type { RosterEntry } from "../../coaches/types/coachAssignment";
import type { UserRaceResult } from "../../results/hooks/useUserResults";
import type { Federation, Club } from "../../auth/club";
import type { ClubCreationRequest } from "../../admin/types/admin.types";

type EventWithId = EventDoc & { id: string };

const DAY = 86_400_000;
const HOUR = 3_600_000;

// Minimal Timestamp-shaped object for tour mock data (avoids a firebase import).
function fakeTs(ms: number) {
    return { toDate: () => new Date(ms), toMillis: () => ms } as unknown as Session["date"];
}

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

// ── Coach sessions (rowing legends easter egg) ────────────────────────────────
export const TOUR_COACH_SESSIONS: Session[] = [
    {
        id: "tour-session-1",
        coachId: "tour-coach",
        name: "Morning Ergo Block",
        date: fakeTs(Date.now() - DAY),
        status: "completed",
        pieces: [
            {
                pieceNumber: 1,
                distanceMeters: 2000,
                status: "completed",
                startTimestamp: fakeTs(Date.now() - DAY - 3 * HOUR),
                boats: [
                    { boatId: "b1", boatClass: "1x", rowerIds: ["r1"], rowerNames: ["Mahe Drysdale"] },
                    { boatId: "b2", boatClass: "1x", rowerIds: ["r2"], rowerNames: ["Xeno Müller"] },
                ],
            },
            {
                pieceNumber: 2,
                distanceMeters: 1000,
                status: "completed",
                startTimestamp: fakeTs(Date.now() - DAY - 2 * HOUR),
                boats: [
                    { boatId: "b1", boatClass: "1x", rowerIds: ["r1"], rowerNames: ["Mahe Drysdale"] },
                    { boatId: "b2", boatClass: "1x", rowerIds: ["r2"], rowerNames: ["Xeno Müller"] },
                ],
            },
            {
                pieceNumber: 3,
                distanceMeters: 500,
                status: "completed",
                startTimestamp: fakeTs(Date.now() - DAY - HOUR),
                boats: [
                    { boatId: "b1", boatClass: "1x", rowerIds: ["r1"], rowerNames: ["Mahe Drysdale"] },
                    { boatId: "b2", boatClass: "1x", rowerIds: ["r2"], rowerNames: ["Xeno Müller"] },
                ],
            },
        ],
        createdAt: fakeTs(Date.now() - 2 * DAY),
        updatedAt: fakeTs(Date.now() - DAY),
    },
    {
        id: "tour-session-2",
        coachId: "tour-coach",
        name: "Pairs Speed Work",
        date: fakeTs(Date.now()),
        status: "active",
        pieces: [
            {
                pieceNumber: 1,
                distanceMeters: 1500,
                status: "completed",
                startTimestamp: fakeTs(Date.now() - 2 * HOUR),
                boats: [
                    { boatId: "b3", boatClass: "2x", rowerIds: ["r3", "r4"], rowerNames: ["Steve Redgrave", "Matthew Pinsent"] },
                ],
            },
            {
                pieceNumber: 2,
                distanceMeters: 1500,
                status: "pending",
                startTimestamp: null,
                boats: [
                    { boatId: "b3", boatClass: "2x", rowerIds: ["r3", "r4"], rowerNames: ["Steve Redgrave", "Matthew Pinsent"] },
                ],
            },
        ],
        createdAt: fakeTs(Date.now() - DAY),
        updatedAt: fakeTs(Date.now() - HOUR),
    },
    {
        id: "tour-session-3",
        coachId: "tour-coach",
        name: "Technique Work — Singles",
        date: fakeTs(Date.now() + DAY),
        status: "draft",
        pieces: [
            {
                pieceNumber: 1,
                distanceMeters: 500,
                status: "pending",
                startTimestamp: null,
                boats: [
                    { boatId: "b5", boatClass: "1x", rowerIds: ["r5"], rowerNames: ["Kathleen Heddle"] },
                    { boatId: "b6", boatClass: "1x", rowerIds: ["r6"], rowerNames: ["Ekaterina Karsten"] },
                ],
            },
        ],
        createdAt: fakeTs(Date.now()),
        updatedAt: fakeTs(Date.now()),
    },
] as unknown as Session[];

// ── Rower sessions (athlete's view — same legends, rower's own entries) ────────
export const TOUR_ROWER_SESSIONS: RowerSessionSummary[] = [
    { sessionId: "tour-session-2", sessionName: "Pairs Speed Work",          pieceCount: 2, latestStartMs: Date.now() - 2 * HOUR },
    { sessionId: "tour-session-1", sessionName: "Morning Ergo Block",         pieceCount: 3, latestStartMs: Date.now() - DAY },
    { sessionId: "tour-session-4", sessionName: "Cross-Training Quads",       pieceCount: 1, latestStartMs: Date.now() - 3 * DAY },
];

// ── Shared user profiles (keyed by tour UID) ─────────────────────────────────
// Used by timing (formatRowerNames) and signup (bestName) to show legend names.
export const TOUR_USER_PROFILES: Record<string, { displayName: string }> = {
    "tour-rower-1": { displayName: "Rob Waddell" },
    "tour-rower-2": { displayName: "Rumyana Neykova" },
    "tour-rower-3": { displayName: "Olaf Tufte" },
    "tour-rower-4": { displayName: "Kathleen Heddle" },
};

// ── Host event registrations (all registered so the Registrations tab is populated)
import type { BoatTimingDoc } from "../../timing/types";
export const TOUR_HOST_BOATS: BoatTimingDoc[] = [
    {
        id: "tour-hb-1", eventId: "tour-host-event-1",
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
        id: "tour-hb-2", eventId: "tour-host-event-1",
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
        id: "tour-hb-3", eventId: "tour-host-event-1",
        bowNumber: 3, boatSize: 1,
        category: "Men • Senior Open • 1x",
        categoryId: "senior-men", categoryName: "Men • Senior Open • 1x",
        clubName: "Fermoy RC",
        rowerUids: ["tour-rower-3"], status: "registered",
        activeRunId: null, startedAt: null, finishedAt: null,
        elapsedMs: null, adjustmentMs: 0,
        inviteCode: null, invitedEmails: [], createdAt: null, updatedAt: null,
    },
    {
        id: "tour-hb-4", eventId: "tour-host-event-1",
        bowNumber: 4, boatSize: 1,
        category: "Women • Senior Open • 1x",
        categoryId: "senior-women", categoryName: "Women • Senior Open • 1x",
        clubName: "Skibbereen RC",
        rowerUids: ["tour-rower-4"], status: "registered",
        activeRunId: null, startedAt: null, finishedAt: null,
        elapsedMs: null, adjustmentMs: 0,
        inviteCode: null, invitedEmails: [], createdAt: null, updatedAt: null,
    },
];

// ── Athlete roster for coach's "My Athletes" section ─────────────────────────
export const TOUR_ATHLETE_ROSTER: RosterEntry[] = [
    {
        id: "ra1", rowerId: "tour-rower-1", rowerDisplayName: "Rob Waddell",
        assignmentId: "aa1", clubId: "tour-club", clubName: "Z12 Demo Club",
        roles: ["head_coach"], status: "active",
        updatedAt: fakeTs(Date.now() - 7 * DAY),
    },
    {
        id: "ra2", rowerId: "tour-rower-2", rowerDisplayName: "Rumyana Neykova",
        assignmentId: "aa2", clubId: "tour-club", clubName: "Z12 Demo Club",
        roles: ["head_coach"], status: "active",
        updatedAt: fakeTs(Date.now() - 3 * DAY),
    },
    {
        id: "ra3", rowerId: "tour-rower-3", rowerDisplayName: "Olaf Tufte",
        assignmentId: "aa3", clubId: "tour-club", clubName: "Z12 Demo Club",
        roles: ["assistant_coach"], status: "pending",
        updatedAt: fakeTs(Date.now() - DAY),
    },
    {
        id: "ra4", rowerId: "tour-rower-4", rowerDisplayName: "Kathleen Heddle",
        assignmentId: "aa4", clubId: "tour-club", clubName: "Z12 Demo Club",
        roles: ["sc_coach"], status: "active",
        updatedAt: fakeTs(Date.now() - 2 * DAY),
    },
] as unknown as RosterEntry[];

// ── Race history for rower profile page ──────────────────────────────────────
export const TOUR_RACE_RESULTS: UserRaceResult[] = [
    {
        id: "tr1",
        eventId: "tour-event-past-1",
        eventName: "Z12 Spring League — Stage 1",
        eventLengthMeters: 2000,
        categoryId: "senior-men",
        categoryName: "Men • Senior Open • 1x",
        rowerUid: "tour-rower-1",
        clubName: "Liffey Vikings RC",
        startedAt: Date.now() - 16 * DAY,
        finishedAt: Date.now() - 16 * DAY + 402_300,
        time: 402_300,
        place: 1,
        totalInCategory: 8,
    },
    {
        id: "tr2",
        eventId: "tour-event-past-2",
        eventName: "Z12 National Trials",
        eventLengthMeters: 2000,
        categoryId: "senior-men",
        categoryName: "Men • Senior Open • 1x",
        rowerUid: "tour-rower-1",
        clubName: "Liffey Vikings RC",
        startedAt: Date.now() - 45 * DAY,
        finishedAt: Date.now() - 45 * DAY + 425_100,
        time: 425_100,
        place: 3,
        totalInCategory: 14,
    },
];

// ── Federation admin dashboard ────────────────────────────────────────────────
const NOW = new Date().toISOString();

export const TOUR_FEDERATION: Federation = {
    id: "tour-federation",
    name: "Rowing Ireland",
    shortName: "RI",
    sport: "rowing",
    slug: "rowing-ireland",
    country: "IE",
    adminUids: [],
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: "tour",
};

export const TOUR_FEDERATION_CLUBS: Club[] = [
    {
        id: "tour-club-1", name: "Liffey Vikings RC", shortName: "Liffey Vikings",
        sport: "rowing", federationId: "tour-federation",
        location: { city: "Dublin", country: "IE" },
        adminUids: [], memberCount: 84, rowerCount: 62, coachCount: 8,
        status: "active", openMembership: false,
        createdAt: NOW, updatedAt: NOW, createdBy: "tour",
        approvedAt: NOW, approvedBy: "tour",
    },
    {
        id: "tour-club-2", name: "Cork Boat Club", shortName: "Cork BC",
        sport: "rowing", federationId: "tour-federation",
        location: { city: "Cork", country: "IE" },
        adminUids: [], memberCount: 56, rowerCount: 40, coachCount: 5,
        status: "active", openMembership: true,
        createdAt: NOW, updatedAt: NOW, createdBy: "tour",
        approvedAt: NOW, approvedBy: "tour",
    },
    {
        id: "tour-club-3", name: "Fermoy RC", shortName: "Fermoy",
        sport: "rowing", federationId: "tour-federation",
        location: { city: "Fermoy", county: "Cork", country: "IE" },
        adminUids: [], memberCount: 31, rowerCount: 24, coachCount: 3,
        status: "active", openMembership: false,
        createdAt: NOW, updatedAt: NOW, createdBy: "tour",
        approvedAt: NOW, approvedBy: "tour",
    },
    {
        id: "tour-club-4", name: "Skibbereen RC", shortName: "Skibbereen",
        sport: "rowing", federationId: "tour-federation",
        location: { city: "Skibbereen", county: "Cork", country: "IE" },
        adminUids: [], memberCount: 48, rowerCount: 37, coachCount: 4,
        status: "active", openMembership: false,
        createdAt: NOW, updatedAt: NOW, createdBy: "tour",
        approvedAt: NOW, approvedBy: "tour",
    },
];

export const TOUR_FEDERATION_PENDING: ClubCreationRequest[] = [
    {
        id: "tour-req-1",
        requestedBy: "tour-rower-3",
        requesterDisplayName: "Olaf Tufte",
        requesterEmail: "o.tufte@example.com",
        federationId: "tour-federation",
        proposedClubName: "Neptune RC",
        proposedClubLocation: "Wexford, IE",
        proposedClubDescription: "Coastal rowing club based in Wexford Harbour.",
        supportingInfo: null,
        status: "pending",
        submittedAt: new Date(Date.now() - 2 * DAY).toISOString(),
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null,
        resultingClubId: null,
    },
];
