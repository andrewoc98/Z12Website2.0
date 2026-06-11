
import type { EventDoc, EventStatus } from "../types.ts";

function deriveStatus(stored: string, startIso?: string, endIso?: string, closeIso?: string): EventStatus {
    if (stored === "draft") return "draft";
    if (!startIso || !endIso) return (stored as EventStatus) ?? "open";
    const now = Date.now();
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const close = closeIso ? new Date(closeIso).getTime() : null;
    if (now > end) return "finished";
    if (now >= start) return "running";
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
        status: deriveStatus(data.status ?? "open", startDate, endDate, closingDate),
        location: data.location ?? "",
        description: data.description ?? "",
        lengthMeters: data.lengthMeters ?? 0,
        createdByUid: data.createdByUid ?? "",
        createdByName: data.createdByName ?? "",
        categories: data.categories ?? [],
        resultsPublishMode: data.resultsPublishMode
    };
}
