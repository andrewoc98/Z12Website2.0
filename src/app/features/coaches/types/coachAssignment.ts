import type { Timestamp } from 'firebase/firestore';
import type { CoachRole } from '../constants/coachRoles';

export interface CoachAssignment {
    id: string;
    coachId: string;
    coachDisplayName: string;
    clubId: string;
    clubName: string;
    roles: CoachRole[];
    status: 'active' | 'pending' | 'archived';
    requestedAt: Timestamp;
    confirmedAt: Timestamp | null;
    archivedAt: Timestamp | null;
    archivedBy: string | null;
}

export interface RosterEntry {
    id: string;
    rowerId: string;
    rowerDisplayName: string;
    assignmentId: string;
    clubId: string;
    clubName: string;
    roles: CoachRole[];
    status: 'active' | 'pending' | 'archived';
    updatedAt: Timestamp;
}

export interface CoachProfile {
    uid: string;
    displayName: string;
    openAssignment: boolean;
}
