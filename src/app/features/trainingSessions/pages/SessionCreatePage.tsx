import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../../shared/components/Navbar/Navbar';
import { useAuth } from '../../../providers/AuthProvider';
import { useClubRowers } from '../../coaches/hooks/useClubRowers';
import { createSession } from '../services/sessionService';
import {
    BOAT_CLASSES, BOAT_CLASS_LABELS, BOAT_CLASS_SEATS,
    type BoatClass, type BoatEntry, type SessionType,
} from '../types/session';

interface BoatForm {
    boatId: string;
    boatClass: BoatClass;
    rowerSlots: string[];
}

interface PieceForm {
    distanceMeters: string;
    boats: BoatForm[];
}

function emptyBoat(): BoatForm {
    return { boatId: crypto.randomUUID(), boatClass: '1x', rowerSlots: [''] };
}

function emptyPiece(): PieceForm {
    return { distanceMeters: '2000', boats: [emptyBoat()] };
}

function resizeSlots(slots: string[], newClass: BoatClass): string[] {
    const count = BOAT_CLASS_SEATS[newClass];
    if (slots.length === count) return slots;
    if (slots.length < count) return [...slots, ...Array(count - slots.length).fill('')];
    return slots.slice(0, count);
}

export default function SessionCreatePage() {
    const { profile } = useAuth();
    const navigate    = useNavigate();

    const coachClubs = profile?.roles?.coach?.clubMemberships?.filter(m => m.membershipStatus === 'active') ?? [];
    const { rowers } = useClubRowers(coachClubs);

    const [name, setName]               = useState('');
    const [date, setDate]               = useState(new Date().toISOString().slice(0, 10));
    const [sessionType, setSessionType] = useState<SessionType>('race');
    const [assistantEmail, setAssistantEmail] = useState('');
    const [pieces, setPieces]           = useState<PieceForm[]>([emptyPiece()]);
    const [saving, setSaving]           = useState(false);
    const [error, setError]             = useState<string | null>(null);

    // collect all rowerIds already used in a piece (for disabling duplicates)
    function usedInPiece(pieceIdx: number, excludeBoatIdx: number, excludeSlotIdx: number): Set<string> {
        const used = new Set<string>();
        const piece = pieces[pieceIdx];
        piece.boats.forEach((boat, bi) => {
            boat.rowerSlots.forEach((rid, si) => {
                if ((bi !== excludeBoatIdx || si !== excludeSlotIdx) && rid) used.add(rid);
            });
        });
        return used;
    }

    function updatePiece(idx: number, update: Partial<PieceForm>) {
        setPieces(ps => ps.map((p, i) => (i === idx ? { ...p, ...update } : p)));
    }

    function updateBoat(pieceIdx: number, boatIdx: number, update: Partial<BoatForm>) {
        setPieces(ps => ps.map((p, i) => {
            if (i !== pieceIdx) return p;
            return {
                ...p,
                boats: p.boats.map((b, bi) => (bi !== boatIdx ? b : { ...b, ...update })),
            };
        }));
    }

    function changeBoatClass(pieceIdx: number, boatIdx: number, cls: BoatClass) {
        const current = pieces[pieceIdx].boats[boatIdx];
        updateBoat(pieceIdx, boatIdx, {
            boatClass: cls,
            rowerSlots: resizeSlots(current.rowerSlots, cls),
        });
    }

    function setRowerSlot(pieceIdx: number, boatIdx: number, slotIdx: number, rowerId: string) {
        setPieces(ps => ps.map((p, i) => {
            if (i !== pieceIdx) return p;
            return {
                ...p,
                boats: p.boats.map((b, bi) => {
                    if (bi !== boatIdx) return b;
                    const slots = b.rowerSlots.map((s, si) => (si === slotIdx ? rowerId : s));
                    return { ...b, rowerSlots: slots };
                }),
            };
        }));
    }

    function addBoat(pieceIdx: number) {
        setPieces(ps => ps.map((p, i) =>
            i === pieceIdx ? { ...p, boats: [...p.boats, emptyBoat()] } : p,
        ));
    }

    function removeBoat(pieceIdx: number, boatIdx: number) {
        setPieces(ps => ps.map((p, i) => {
            if (i !== pieceIdx) return p;
            return { ...p, boats: p.boats.filter((_, bi) => bi !== boatIdx) };
        }));
    }

    function addPiece() {
        setPieces(ps => [...ps, emptyPiece()]);
    }

    function removePiece(idx: number) {
        setPieces(ps => ps.filter((_, i) => i !== idx));
    }

    function validate(): string | null {
        if (!name.trim()) return 'Session name is required.';
        if (!date) return 'Date is required.';
        for (let pi = 0; pi < pieces.length; pi++) {
            const p = pieces[pi];
            const dist = Number(p.distanceMeters);
            if (!dist || dist < 100) return `Piece ${pi + 1}: distance must be at least 100m.`;
            if (p.boats.length === 0) return `Piece ${pi + 1}: at least one boat is required.`;
            for (let bi = 0; bi < p.boats.length; bi++) {
                const b = p.boats[bi];
                if (b.rowerSlots.some(s => !s)) {
                    return `Piece ${pi + 1}, boat ${bi + 1}: all rower seats must be filled.`;
                }
            }
        }
        return null;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const err = validate();
        if (err) { setError(err); return; }
        if (!profile) return;

        setSaving(true);
        setError(null);

        try {
            const boatEntries = (pf: PieceForm): BoatEntry[] =>
                pf.boats.map(b => {
                    const rowerIds   = b.rowerSlots;
                    const rowerNames = rowerIds.map(id => {
                        const rower = rowers.find(r => r.uid === id);
                        return rower?.displayName ?? id;
                    });
                    return { boatId: b.boatId, boatClass: b.boatClass, rowerIds, rowerNames };
                });

            const trimmedEmail = assistantEmail.trim() || null;
            const sessionId = await createSession(
                profile.uid,
                name.trim(),
                new Date(date),
                sessionType,
                trimmedEmail,
                null,
                pieces.map(p => ({ distanceMeters: Number(p.distanceMeters), boats: boatEntries(p) })),
            );
            navigate(`/coach/sessions/${sessionId}/run`);
        } catch (err: unknown) {
            console.error('[SessionCreate] createSession failed:', err);
            const msg = err instanceof Error ? err.message : String(err);
            setError(`Failed to save session: ${msg}`);
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <Navbar />
            <div className="ts-page page shell">
                <div className="ts-page__header">
                    <h1 className="ts-page__title">New Session</h1>
                </div>

                <form className="ts-create-form" onSubmit={handleSubmit}>
                    <div className="ts-field">
                        <label className="ts-label" htmlFor="session-name">Session Name</label>
                        <input
                            id="session-name"
                            className="ts-input"
                            type="text"
                            placeholder="e.g. Tuesday 2k / 1k"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="ts-field">
                        <label className="ts-label" htmlFor="session-date">Date</label>
                        <input
                            id="session-date"
                            className="ts-input ts-input--date"
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            required
                        />
                    </div>

                    <div className="ts-field" data-tour="session-type-toggle">
                        <span className="ts-label">Session Type</span>
                        <div className="ts-type-toggle">
                            <button
                                type="button"
                                className={`ts-type-toggle__btn${sessionType === 'race' ? ' ts-type-toggle__btn--active' : ''}`}
                                onClick={() => setSessionType('race')}
                            >
                                Race
                            </button>
                            <button
                                type="button"
                                className={`ts-type-toggle__btn${sessionType === 'time_trial' ? ' ts-type-toggle__btn--active' : ''}`}
                                onClick={() => setSessionType('time_trial')}
                            >
                                Time Trial
                            </button>
                        </div>
                        {sessionType === 'time_trial' && (
                            <p className="ts-field-hint">
                                Boats are timed one at a time. Start and stop each boat individually.
                            </p>
                        )}
                    </div>

                    <div className="ts-field" data-tour="session-assistant">
                        <label className="ts-label" htmlFor="assistant-email">
                            Timing Assistant Email <span className="ts-label-optional">(optional)</span>
                        </label>
                        <input
                            id="assistant-email"
                            className="ts-input"
                            type="email"
                            placeholder="assistant@example.com"
                            value={assistantEmail}
                            onChange={e => setAssistantEmail(e.target.value)}
                        />
                        <p className="ts-field-hint">
                            Share the session link with them — they'll be able to start and stop boats alongside you.
                        </p>
                    </div>

                    {pieces.map((piece, pi) => (
                        <div key={pi} className="ts-piece-block">
                            <div className="ts-piece-block__header">
                                <span className="ts-piece-block__label">Piece {pi + 1}</span>
                                {pieces.length > 1 && (
                                    <button
                                        type="button"
                                        className="ts-btn-remove"
                                        onClick={() => removePiece(pi)}
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>

                            <div className="ts-field">
                                <label className="ts-label">Distance (m)</label>
                                <input
                                    className="ts-input ts-input--distance"
                                    type="number"
                                    min="100"
                                    step="100"
                                    value={piece.distanceMeters}
                                    onChange={e => updatePiece(pi, { distanceMeters: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="ts-boats">
                                {piece.boats.map((boat, bi) => {
                                    const seatCount = BOAT_CLASS_SEATS[boat.boatClass];
                                    return (
                                        <div key={boat.boatId} className="ts-boat-row">
                                            <div className="ts-boat-row__header">
                                                <span className="ts-boat-row__num">Boat {bi + 1}</span>
                                                {piece.boats.length > 1 && (
                                                    <button
                                                        type="button"
                                                        className="ts-btn-remove ts-btn-remove--sm"
                                                        onClick={() => removeBoat(pi, bi)}
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>

                                            <div className="ts-boat-row__fields">
                                                <select
                                                    className="ts-select ts-select--class"
                                                    value={boat.boatClass}
                                                    onChange={e => changeBoatClass(pi, bi, e.target.value as BoatClass)}
                                                >
                                                    {BOAT_CLASSES.map(cls => (
                                                        <option key={cls} value={cls}>
                                                            {BOAT_CLASS_LABELS[cls]}
                                                        </option>
                                                    ))}
                                                </select>

                                                <div className="ts-boat-row__seats">
                                                    {Array.from({ length: seatCount }).map((_, si) => {
                                                        const used = usedInPiece(pi, bi, si);
                                                        return (
                                                            <select
                                                                key={si}
                                                                className="ts-select ts-select--rower"
                                                                value={boat.rowerSlots[si] ?? ''}
                                                                onChange={e => setRowerSlot(pi, bi, si, e.target.value)}
                                                            >
                                                                <option value="">
                                                                    {seatCount === 1 ? '— Select rower —' : `Seat ${si + 1}`}
                                                                </option>
                                                                {rowers.map(r => (
                                                                    <option
                                                                        key={r.uid}
                                                                        value={r.uid}
                                                                        disabled={used.has(r.uid)}
                                                                    >
                                                                        {r.displayName}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                <button
                                    type="button"
                                    className="ts-btn-add-boat"
                                    onClick={() => addBoat(pi)}
                                >
                                    + Add Boat
                                </button>
                            </div>
                        </div>
                    ))}

                    <button type="button" className="ts-btn-add-piece" onClick={addPiece}>
                        + Add Another Piece
                    </button>

                    {error && <p className="ts-error">{error}</p>}

                    <div className="ts-create-form__actions">
                        <button type="button" className="btn-ghost" onClick={() => navigate('/coach/sessions')}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={saving}>
                            {saving ? 'Saving…' : 'Save Session'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
