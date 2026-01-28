import { Timestamp } from "firebase/firestore";
import type {EventDoc, FirestoreEventDoc} from "../types.ts";

export function mapEvent(id: string, data: FirestoreEventDoc): EventDoc {
    return {
        id,
        name: data.name,
        startDate: (data.startAt as Timestamp).toDate().toISOString(),
        endDate: (data.endAt as Timestamp).toDate().toISOString(),
        closingDate: data.closeAt ? (data.closeAt as Timestamp).toDate().toISOString() : undefined,
        status: data.status,
        location: data.location,
        description: data.description,
        lengthMeters: data.lengthMeters,
        createdByUid: data.createdByUid,
        createdByName: data.createdByName,
        categories: data.categories ?? [],
    };
}
