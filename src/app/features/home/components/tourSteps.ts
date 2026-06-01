import type { DriveStep } from "driver.js";
import type { UserProfile } from "../../auth/types";

// A TourStep extends Driver.js's DriveStep with a required `route`.
// To add steps: insert into the relevant role array below.
// To add a new role: add a const array + a case in getStepsForProfile.
export type TourStep = DriveStep & { route: string };

// ── Rower ─────────────────────────────────────────────────────────────────────

const ROWER_STEPS: TourStep[] = [
    {
        route: "/",
        popover: {
            title: "Welcome to Z12",
            description: "The Z12 Challenge is a season-long rowing league built around structured time trial events. Let's take a quick look around.",
        },
    },
    {
        route: "/",
        element: 'a[href="/profile"]',
        popover: {
            title: "Your Profile",
            description: "Your profile is the hub for everything — athlete stats, best times, club membership, and coaches.",
            side: "bottom",
            align: "center",
        },
    },
    {
        route: "/profile",
        element: '[data-tour="profile-stats"]',
        popover: {
            title: "Athlete Stats",
            description: "Add your height, weight, and wingspan here. Coaches and selectors use these to find you.",
            side: "top",
        },
    },
    {
        route: "/profile",
        element: '[data-tour="profile-performances"]',
        popover: {
            title: "Best Erg Scores",
            description: "Log your best times for each distance. These benchmarks are used for rankings and selection.",
            side: "top",
        },
    },
    {
        route: "/events",
        element: '[data-tour="events-list"]',
        popover: {
            title: "Browse & Enter Races",
            description: "Every upcoming Z12 event is listed here. Hit Enter Race to register — you'll see the draw before race day.",
            side: "bottom",
        },
    },
    {
        route: "/events",
        popover: {
            title: "You're all set!",
            description: "That's the tour. Head back to your profile anytime to update your details or connect with a coach.",
        },
    },
];

// ── Coach ─────────────────────────────────────────────────────────────────────

const COACH_STEPS: TourStep[] = [
    {
        route: "/",
        popover: {
            title: "Welcome to Z12",
            description: "The Z12 Challenge is a season-long rowing league. Let's take a quick look at your coaching tools.",
        },
    },
    {
        route: "/",
        element: 'a[href="/profile"]',
        popover: {
            title: "Your Profile",
            description: "Set up your coaching profile and open yourself to assignment requests from athletes in your clubs.",
            side: "bottom",
            align: "center",
        },
    },
    {
        route: "/profile",
        element: '[data-tour="my-athletes"]',
        popover: {
            title: "My Athletes",
            description: "Your roster lives here. Accept or decline requests from rowers, and track their progress across events.",
            side: "bottom",
        },
    },
    {
        route: "/events",
        element: '[data-tour="events-list"]',
        popover: {
            title: "Race Calendar",
            description: "Browse every Z12 event. Results are published in real time — follow your athletes across the full season.",
            side: "bottom",
        },
    },
    {
        route: "/events",
        popover: {
            title: "You're all set!",
            description: "That's the tour. Head to your profile to open up athlete assignment requests.",
        },
    },
];

// ── Host ──────────────────────────────────────────────────────────────────────

const HOST_STEPS: TourStep[] = [
    {
        route: "/",
        popover: {
            title: "Welcome to Z12",
            description: "The Z12 Challenge is a season-long rowing league. Let's take a look at your event hosting tools.",
        },
    },
    {
        route: "/",
        element: 'a[href="/host/events"]',
        popover: {
            title: "Manage Races",
            description: "All your events live here. Review registrations, manage crew changes, and publish the heat draw.",
            side: "bottom",
            align: "center",
        },
    },
    {
        route: "/",
        element: 'a[href="/host/events/new"]',
        popover: {
            title: "Create a Race",
            description: "Set up a new event — categories, entry limits, deadlines, and location details — all in one place.",
            side: "bottom",
            align: "center",
        },
    },
    {
        route: "/host/events",
        element: '[data-tour="host-events-list"]',
        popover: {
            title: "Your Events",
            description: "Once created, your events appear here. Click into any one to manage entries and publish the heat draw.",
            side: "bottom",
        },
    },
    {
        route: "/host/events",
        popover: {
            title: "You're all set!",
            description: "That's the tour. Use the Timing link in the nav on race day to record and publish results.",
        },
    },
];

// ── Timing admin (roles.admin — attached to host accounts) ────────────────────

const ADMIN_STEPS: TourStep[] = [
    {
        route: "/",
        popover: {
            title: "Welcome to Z12",
            description: "You have timing access for your assigned events. Let's take a quick look.",
        },
    },
    {
        route: "/",
        element: 'a[href="/timing"]',
        popover: {
            title: "Timing",
            description: "This takes you to your assigned events. Select an event to begin timing or manage entries.",
            side: "bottom",
            align: "center",
        },
    },
    {
        route: "/timing",
        element: '[data-tour="timing-select"]',
        popover: {
            title: "Select an Event",
            description: "Your events appear here. Active events are highlighted — click one to open the timing tools.",
            side: "bottom",
        },
    },
    {
        route: "/timing",
        popover: {
            title: "You're all set!",
            description: "That's the tour. Results are published to all participants the moment you record them.",
        },
    },
];

// ── Federation admin ──────────────────────────────────────────────────────────

const FEDERATION_ADMIN_STEPS: TourStep[] = [
    {
        route: "/",
        popover: {
            title: "Welcome to Z12",
            description: "You have federation admin access. Let's take a quick look at your management tools.",
        },
    },
    {
        route: "/",
        element: 'a[href="/admin/federation"]',
        popover: {
            title: "Federation Dashboard",
            description: "Manage clubs, review creation requests, and access athlete selection profiles from here.",
            side: "bottom",
            align: "center",
        },
    },
    {
        route: "/admin/federation",
        element: '[data-tour="federation-dashboard"]',
        popover: {
            title: "Your Federation",
            description: "All clubs and events in your federation are managed here, including athlete selection visibility.",
            side: "bottom",
        },
    },
    {
        route: "/admin/federation",
        popover: {
            title: "You're all set!",
            description: "That's the tour. Use the dashboard to approve club requests and oversee events across your federation.",
        },
    },
];

// ── Role resolution ───────────────────────────────────────────────────────────
// Priority order: federationAdmin > host > admin > coach > rower
// Multi-role users get all matching step arrays concatenated in priority order.
// The welcome step is kept only from the highest-priority role; the closing
// "You're all set!" step is kept only from the lowest-priority role.

const ROLE_PRIORITY: Array<{ key: keyof UserProfile["roles"]; steps: TourStep[] }> = [
    { key: "federationAdmin", steps: FEDERATION_ADMIN_STEPS },
    { key: "host",            steps: HOST_STEPS },
    { key: "admin",           steps: ADMIN_STEPS },
    { key: "coach",           steps: COACH_STEPS },
    { key: "rower",           steps: ROWER_STEPS },
];

export function getStepsForProfile(roles: UserProfile["roles"]): TourStep[] {
    const matching = ROLE_PRIORITY
        .filter(({ key }) => !!roles[key])
        .map(({ steps }) => steps);

    if (matching.length === 0) return ROWER_STEPS;
    if (matching.length === 1) return matching[0];

    // Exactly one welcome (from the highest-priority role) and one closing
    // "You're all set!" (from the lowest-priority role). Everything in between
    // is the ole-specific middle steps from each matching role.
    const welcome = matching[0][0];
    const done    = matching[matching.length - 1].at(-1)!;
    const middle  = matching.flatMap(steps => steps.slice(1, -1));
    return [welcome, ...middle, done];
}
