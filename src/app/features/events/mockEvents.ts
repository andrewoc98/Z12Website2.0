import type { EventDoc } from "./types";

export const MOCK_EVENTS: EventDoc[] = [
    {
        id: "event-1",
        hostId: "mock-host-uid",
        name: "Z12 Head Race",
        description: "Annual Z12 fall head race",
        location: "Charles River",
        startDate: "2025-10-01",
        endDate: "2025-10-01",
        closingDate: "2025-09-20",
        lengthMeters: 5000,
        categories: ["1x Men Open", "1x Women Open", "2x Open"],
        status: "open",
        createdAt: Date.now(),
    },
];
