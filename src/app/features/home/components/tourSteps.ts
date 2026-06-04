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
        route: "/rower/events/tour-event-1/signup",
        element: '[data-tour="signup-form"]',
        popover: {
            title: "Choose Your Category",
            description: "Select the category that matches your gender and age group. For multi-seat boats you'll get an invite link to share with your crew.",
            side: "top",
        },
    },
    {
        route: "/rower/events/tour-event-1/signup",
        element: '[data-tour="signup-start-list"]',
        popover: {
            title: "Start List",
            description: "Once you've registered, your entry appears here. You can see every other crew entered before race day.",
            side: "top",
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
        route: "/host/events/tour-host-event-1",
        element: '[data-tour="host-manage-tabs"]',
        popover: {
            title: "Event Dashboard",
            description: "Everything you need to run your event is spread across five tabs in this sidebar. Let's walk through each one.",
            side: "right",
        },
    },
    {
        route: "/host/events/tour-host-event-1",
        element: '[data-tour="tab-overview"]',
        popover: {
            title: "Overview",
            description: "The home base for your event. Edit the event name, dates, and location, assign bow numbers, and see a live breakdown of registrations by category.",
            side: "right",
        },
    },
    {
        route: "/host/events/tour-host-event-1",
        element: '[data-tour="tab-categories"]',
        popover: {
            title: "Categories",
            description: "Add or remove race categories. Each category controls who can enter and how boats are grouped in the start list and results.",
            side: "right",
        },
    },
    {
        route: "/host/events/tour-host-event-1",
        element: '[data-tour="tab-registrations"]',
        popover: {
            title: "Registrations",
            description: "See every crew that has entered, filter by category, and check entry details before race day.",
            side: "right",
        },
    },
    {
        route: "/host/events/tour-host-event-1",
        element: '[data-tour="tab-race"]',
        popover: {
            title: "Race",
            description: "Control how results are published — live as each boat finishes, only once an entire category is done, or when the full event wraps up.",
            side: "right",
        },
    },
    {
        route: "/host/events/tour-host-event-1",
        element: '[data-tour="tab-contacts"]',
        popover: {
            title: "Contacts",
            description: "See all timing admins attached to your account. Anyone listed here has access to the timing tools for your events on race day.",
            side: "right",
        },
    },
    {
        route: "/host/events/tour-host-event-1",
        element: '[data-tour="host-admin-invite"]',
        popover: {
            title: "Invite an Admin",
            description: "Enter an email address and hit Send Invite to give someone timing access. They'll receive a signup link and once registered will appear in your Contacts tab.",
            side: "top",
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
            description: "You have timing access for your assigned events. Let's take a quick look at the timing tools.",
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
        route: "/timing/tour-timing-event-1",
        element: '[data-tour="timing-tabs"]',
        popover: {
            title: "Start · In Progress · Finish",
            description: "Each tab shows boats at that stage. Tap a boat in Start to begin timing it, then tap again in In Progress to stop the clock when it crosses the line.",
            side: "bottom",
        },
    },
    {
        route: "/timing/tour-timing-event-1",
        element: '[data-tour="timing-tab-start"]',
        popover: {
            title: "DNS — Did Not Start",
            description: "The Start tab lists all boats yet to race. If a crew scratches before leaving the dock, long-press their card and choose Mark DNS. DNS entries won't appear in the results.",
            side: "bottom",
        },
    },
    {
        route: "/timing/tour-timing-event-1",
        element: '[data-tour="timing-tab-in-progress"]',
        popover: {
            title: "DNF — Did Not Finish",
            description: "The In Progress tab shows boats currently on the water. If a crew withdraws mid-race, long-press their card and choose Mark DNF. DNF entries appear at the bottom of results.",
            side: "bottom",
        },
    },
    {
        route: "/timing/tour-timing-event-1",
        element: '[data-tour="timing-dnf-demo"]',
        popover: {
            title: "The Action Menu",
            description: "Long-pressing any boat card opens this menu. Stop Boat records the finish time. Mark DNF removes them from the active race. The menu is also where you'll find DNS on the Start tab.",
            side: "top",
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

export function getStepsForProfile(roles: UserProfile["roles"] | undefined): TourStep[] {
    if (!roles) return ROWER_STEPS;
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
