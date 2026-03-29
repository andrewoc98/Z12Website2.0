
import type {EventDoc} from "../types.ts";

export function mapEvent(id: string, data: any): EventDoc {
    return {
        id,
        name: data.name,
        startDate: data.startAt?.toDate ? data.startAt.toDate().toISOString() : undefined,
        endDate: data.endAt?.toDate ? data.endAt.toDate().toISOString() : undefined,
        closingDate: data.closeAt?.toDate ? data.closeAt.toDate().toISOString() : undefined,
        status: data.status ?? "open",
        location: data.location ?? "",
        description: data.description ?? "",
        lengthMeters: data.lengthMeters ?? 0,
        createdByUid: data.createdByUid ?? "",
        createdByName: data.createdByName ?? "",
        categories: data.categories ?? [],
        resultsPublishMode: data.resultsPublishMode
    };
}
