import {
    collection, doc, addDoc, updateDoc, writeBatch, Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase';
import type { Session, PieceDefinition, BoatEntry } from '../types/session';
import { boatDisplayLabel } from '../types/session';

const SESSIONS = 'sessions';
const PIECE_RESULTS = 'pieceResults';

export async function createSession(
    coachId: string,
    name: string,
    date: Date,
    pieces: Array<{ distanceMeters: number; boats: BoatEntry[] }>,
): Promise<string> {
    const now = Timestamp.now();
    const pieceDefs: PieceDefinition[] = pieces.map((p, i) => ({
        pieceNumber: i + 1,
        distanceMeters: p.distanceMeters,
        boats: p.boats,
        status: 'pending',
        startTimestamp: null,
    }));

    const ref = await addDoc(collection(db, SESSIONS), {
        coachId,
        name,
        date: Timestamp.fromDate(date),
        status: 'draft',
        pieces: pieceDefs,
        createdAt: now,
        updatedAt: now,
    });
    return ref.id;
}

export async function startPiece(
    sessionId: string,
    session: Session,
    pieceIdx: number,
): Promise<Record<string, string>> {
    const startTs = Timestamp.now();
    const piece = session.pieces[pieceIdx];
    const batch = writeBatch(db);

    const updatedPieces = session.pieces.map((p, i) =>
        i === pieceIdx ? { ...p, status: 'active' as const, startTimestamp: startTs } : p,
    );

    batch.update(doc(db, SESSIONS, sessionId), {
        status: 'active',
        pieces: updatedPieces,
        updatedAt: startTs,
    });

    const boatIdToResultId: Record<string, string> = {};
    for (const boat of piece.boats) {
        const resultRef = doc(collection(db, PIECE_RESULTS));
        boatIdToResultId[boat.boatId] = resultRef.id;
        batch.set(resultRef, {
            sessionId,
            sessionName: session.name,
            coachId: session.coachId,
            pieceNumber: piece.pieceNumber,
            distanceMeters: piece.distanceMeters,
            boatId: boat.boatId,
            boatClass: boat.boatClass,
            rowerIds: boat.rowerIds,
            rowerNames: boat.rowerNames,
            displayName: boatDisplayLabel(boat.rowerNames, boat.boatClass),
            startTimestamp: startTs,
            endTimestamp: null,
            elapsedMs: null,
            split500mMs: null,
            status: 'running',
            createdAt: startTs,
        });
    }

    await batch.commit();
    return boatIdToResultId;
}

export async function stopBoat(
    resultId: string,
    startTimeMs: number,
    distanceMeters: number,
): Promise<void> {
    const now = Date.now();
    const elapsedMs = now - startTimeMs;
    const split500mMs = Math.round((elapsedMs / distanceMeters) * 500);
    await updateDoc(doc(db, PIECE_RESULTS, resultId), {
        endTimestamp: Timestamp.fromMillis(now),
        elapsedMs,
        split500mMs,
        status: 'finished',
    });
}

export async function markBoatDNF(resultId: string): Promise<void> {
    await updateDoc(doc(db, PIECE_RESULTS, resultId), {
        status: 'dnf',
        endTimestamp: Timestamp.now(),
    });
}

export async function completePiece(
    sessionId: string,
    session: Session,
    pieceIdx: number,
): Promise<void> {
    const updatedPieces = session.pieces.map((p, i) =>
        i === pieceIdx ? { ...p, status: 'completed' as const } : p,
    );
    await updateDoc(doc(db, SESSIONS, sessionId), {
        pieces: updatedPieces,
        updatedAt: Timestamp.now(),
    });
}

export async function finishSession(sessionId: string): Promise<void> {
    await updateDoc(doc(db, SESSIONS, sessionId), {
        status: 'completed',
        updatedAt: Timestamp.now(),
    });
}
