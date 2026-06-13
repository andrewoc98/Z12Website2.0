import {
    collection, doc, addDoc, updateDoc, writeBatch, deleteDoc, Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../shared/lib/firebase';
import type { Session, PieceDefinition, BoatEntry, SessionType } from '../types/session';
import { boatDisplayLabel } from '../types/session';

const SESSIONS = 'sessions';
const PIECE_RESULTS = 'pieceResults';

export async function createSession(
    coachId: string,
    name: string,
    date: Date,
    sessionType: SessionType,
    timingAssistantEmail: string | null,
    timingAssistantName: string | null,
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
        sessionType,
        timingAssistantEmail,
        timingAssistantName,
        name,
        date: Timestamp.fromDate(date),
        status: 'draft',
        pieces: pieceDefs,
        createdAt: now,
        updatedAt: now,
    });
    return ref.id;
}

export async function startBoatTimeTrial(
    sessionId: string,
    session: Session,
    pieceIdx: number,
    boatIdx: number,
    startTs?: Timestamp,
): Promise<{ resultId: string; startMs: number }> {
    startTs = startTs ?? Timestamp.now();
    const piece = session.pieces[pieceIdx];
    const boat = piece.boats[boatIdx];
    const isFirstBoat = piece.startTimestamp === null;
    const batch = writeBatch(db);

    if (isFirstBoat) {
        const updatedPieces = session.pieces.map((p, i) =>
            i === pieceIdx ? { ...p, status: 'active' as const, startTimestamp: startTs } : p,
        );
        batch.update(doc(db, SESSIONS, sessionId), {
            status: 'active',
            pieces: updatedPieces,
            updatedAt: startTs,
        });
    }

    const resultRef = doc(collection(db, PIECE_RESULTS));
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

    await batch.commit();
    return { resultId: resultRef.id, startMs: startTs.toMillis() };
}

export async function startPiece(
    sessionId: string,
    session: Session,
    pieceIdx: number,
    startTs?: Timestamp,
): Promise<Record<string, string>> {
    startTs = startTs ?? Timestamp.now();
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

export async function deletePieceResult(resultId: string): Promise<void> {
    await deleteDoc(doc(db, PIECE_RESULTS, resultId));
}

export async function undoPieceStart(
    sessionId: string,
    session: Session,
    pieceIdx: number,
    resultIds: string[],
): Promise<void> {
    const batch = writeBatch(db);
    for (const id of resultIds) {
        batch.delete(doc(db, PIECE_RESULTS, id));
    }
    const updatedPieces = session.pieces.map((p, i) =>
        i === pieceIdx ? { ...p, status: 'pending' as const, startTimestamp: null } : p,
    );
    batch.update(doc(db, SESSIONS, sessionId), {
        pieces: updatedPieces,
        updatedAt: Timestamp.now(),
    });
    await batch.commit();
}

export async function undoBoatResult(resultId: string): Promise<void> {
    await updateDoc(doc(db, PIECE_RESULTS, resultId), {
        endTimestamp: null,
        elapsedMs: null,
        split500mMs: null,
        status: 'running',
    });
}

export async function updateSession(
    sessionId: string,
    name: string,
    date: Date,
    sessionType: SessionType,
    timingAssistantEmail: string | null,
    pieces: Array<{ distanceMeters: number; boats: BoatEntry[] }>,
): Promise<void> {
    const pieceDefs: PieceDefinition[] = pieces.map((p, i) => ({
        pieceNumber: i + 1,
        distanceMeters: p.distanceMeters,
        boats: p.boats,
        status: 'pending',
        startTimestamp: null,
    }));
    await updateDoc(doc(db, SESSIONS, sessionId), {
        name,
        date: Timestamp.fromDate(date),
        sessionType,
        timingAssistantEmail,
        pieces: pieceDefs,
        updatedAt: Timestamp.now(),
    });
}

export async function activateSession(sessionId: string): Promise<void> {
    await updateDoc(doc(db, SESSIONS, sessionId), {
        status: 'active',
        updatedAt: Timestamp.now(),
    });
}

export async function finishSession(sessionId: string): Promise<void> {
    await updateDoc(doc(db, SESSIONS, sessionId), {
        status: 'completed',
        updatedAt: Timestamp.now(),
    });
}

export async function deleteSession(sessionId: string): Promise<void> {
    const fn = httpsCallable<{ sessionId: string }, { deleted: string }>(functions, 'deleteSession');
    await fn({ sessionId });
}
