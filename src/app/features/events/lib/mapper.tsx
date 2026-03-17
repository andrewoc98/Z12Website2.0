import { Timestamp } from "firebase/firestore";
import type {EventDoc, FirestoreEventDoc} from "../types.ts";

export function mapEvent(id: string, data: FirestoreEventDoc): EventDoc {
    return {
        id,
        name: data.name,

        startDate: data.startAt instanceof Timestamp
            ? data.startAt.toDate().toISOString()
            : "",

        endDate: data.endAt instanceof Timestamp
            ? data.endAt.toDate().toISOString()
            : "",

        closingDate: data.closeAt instanceof Timestamp
            ? data.closeAt.toDate().toISOString()
            : undefined,

        status: data.status,
        location: data.location,
        description: data.description,
        lengthMeters: data.lengthMeters,
        createdByUid: data.createdByUid,
        createdByName: data.createdByName,
        categories: data.categories ?? [],
        resultsPublishMode: data.resultsPublishMode
    };
}
