import {
    collection,
    query,
    orderBy,
    startAt,
    endAt,
    limit,
    getDocs
} from "firebase/firestore";

import { db } from "../../../shared/lib/firebase";
import type { UserProfile } from "../../auth/types";

export async function searchUsersByName(name: string) {

    const q = query(
        collection(db, "users"),
        orderBy("fullName"),
        startAt(name),
        endAt(name + "\uf8ff"),
        limit(12)
    );

    const snap = await getDocs(q);

    return snap.docs.map(d => d.data() as UserProfile);
}

export function formatLength(cm: number, units: "metric" | "imperial") {
    if (units === "metric") return `${cm} cm`;
    const inches = cm / 2.54;
    const feet = Math.floor(inches / 12);
    const remInches = Math.round(inches % 12);
    return `${feet}'${remInches}"`;
}

export function formatWeight(kg: number, units: "metric" | "imperial") {
    if (units === "metric") return `${kg} kg`;
    const lbs = Math.round(kg * 2.20462);
    return `${lbs} lbs`;
}
