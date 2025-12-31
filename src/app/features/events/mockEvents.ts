import type { EventDoc } from "./types";
import { buildDefaultCategories } from "./lib/categories";

export const MOCK_EVENTS: EventDoc[] = [
    {
        id: "event-1",
        hostId: "mock-host-uid",
        name: "Z12 Head Race",
        description: "Annual Z12 fall head race",
        location: "Charles River",
        startDate: "2025-10-01",
        endDate: "2026-12-31",
        closingDate: "2025-09-20",
        lengthMeters: 5000,

        // ✅ everything enabled by default
        categories: buildDefaultCategories(),

        status: "open",
        createdAt: Date.now(),
    },
];

