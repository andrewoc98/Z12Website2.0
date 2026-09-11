
import type { EventDoc, EventStatus } from "../types.ts";

function deriveStatus(
    stored: string,
    startIso?: string,
    endIso?: string,
    closeIso?: string,
    registrationOpen?: boolean,
): EventStatus {
    if (stored === "draft") return "draft";
    if (!startIso || !endIso) return (stored as EventStatus) ?? "open";
    const now = Date.now();
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const close = closeIso ? new Date(closeIso).getTime() : null;
    if (now > end) return "finished";
    if (now >= start) return "running";
    // The host's manual switch outranks the closing date before the event runs;
    // see lib/registration.ts for the full precedence.
    if (registrationOpen === false) return "closed";
    if (registrationOpen === true) return "open";
    if (close && now > close) return "closed";
    return "open";
}

export function mapEvent(id: string, data: any): EventDoc {
    const startDate = data.startAt?.toDate ? data.startAt.toDate().toISOString() : undefined;
    const endDate = data.endAt?.toDate ? data.endAt.toDate().toISOString() : undefined;
    const closingDate = data.closeAt?.toDate ? data.closeAt.toDate().toISOString() : undefined;
    return {
        id,
        name: data.name,
        startDate,
        endDate,
        closingDate,
        noClosingDate: data.noClosingDate === true,
        registrationOpen: data.registrationOpen,
        status: deriveStatus(data.status ?? "open", startDate, endDate, closingDate, data.registrationOpen),
        location: data.location ?? "",
        description: data.description ?? "",
        lengthMeters: data.lengthMeters ?? 0,
        clubId: data.clubId,
        federationId: data.federationId,
        seriesType: data.seriesType,
        seriesGroupId: data.seriesGroupId,
        createdByUid: data.createdByUid ?? "",
        createdByName: data.createdByName ?? "",
        hostId: data.hostId,
        categories: data.categories ?? [],
        excludedBowNumbers: data.excludedBowNumbers ?? [],
        resultsPublishMode: data.resultsPublishMode,
        // Absent on every event created before indoor events existed, which
        // isErgEvent() reads as open water. Must be carried through here or the
        // whole erg branch of the UI is dead — this mapper is the only way an
        // event document reaches the app.
        eventType: data.eventType,
        ergConfig: data.ergConfig,
    };
}
