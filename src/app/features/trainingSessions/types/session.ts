import type { Timestamp } from 'firebase/firestore';

export type BoatClass = '1x' | '2x' | '4-' | '4x' | '4+' | '8+';

export const BOAT_CLASS_SEATS: Record<BoatClass, number> = {
    '1x': 1,
    '2x': 2,
    '4-': 4,
    '4x': 4,
    '4+': 5,
    '8+': 9,
};

export const BOAT_CLASS_LABELS: Record<BoatClass, string> = {
    '1x': 'Single (1x)',
    '2x': 'Double (2x)',
    '4-': 'Coxless Four (4-)',
    '4x': 'Quad (4x)',
    '4+': 'Coxed Four (4+)',
    '8+': 'Eight (8+)',
};

export const BOAT_CLASSES: BoatClass[] = ['1x', '2x', '4-', '4x', '4+', '8+'];

export interface BoatEntry {
    boatId: string;
    boatClass: BoatClass;
    rowerIds: string[];
    rowerNames: string[];
}

export interface PieceDefinition {
    pieceNumber: number;
    distanceMeters: number;
    boats: BoatEntry[];
    status: 'pending' | 'active' | 'completed';
    startTimestamp: Timestamp | null;
}

export interface Session {
    id: string;
    coachId: string;
    name: string;
    date: Timestamp;
    status: 'draft' | 'active' | 'completed';
    pieces: PieceDefinition[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface PieceResult {
    id: string;
    sessionId: string;
    sessionName: string;
    coachId: string;
    pieceNumber: number;
    distanceMeters: number;
    boatId: string;
    boatClass: BoatClass;
    rowerIds: string[];
    rowerNames: string[];
    displayName: string;
    startTimestamp: Timestamp;
    endTimestamp: Timestamp | null;
    elapsedMs: number | null;
    split500mMs: number | null;
    status: 'running' | 'finished' | 'dnf';
    createdAt: Timestamp;
}

export function formatTime(ms: number): string {
    const totalSeconds = ms / 1000;
    const mins = Math.floor(totalSeconds / 60);
    const secs = (totalSeconds % 60).toFixed(1).padStart(4, '0');
    return `${mins}:${secs}`;
}

export function boatDisplayLabel(rowerNames: string[], boatClass: BoatClass): string {
    if (rowerNames.length === 0) return `Boat (${boatClass})`;
    if (rowerNames.length === 1) return `${rowerNames[0]} (${boatClass})`;
    const first = rowerNames[0].split(' ')[0];
    if (rowerNames.length === 2) {
        const second = rowerNames[1].split(' ')[0];
        return `${first} & ${second} (${boatClass})`;
    }
    return `${first} +${rowerNames.length - 1} (${boatClass})`;
}
