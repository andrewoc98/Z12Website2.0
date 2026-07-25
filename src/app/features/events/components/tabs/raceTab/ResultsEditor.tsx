import { useState } from "react";
import { saveBoatAdjustment, saveBoatTimes } from "../../../api/events";

function parseTimeToUnix(input: string, eventDate?: string): { unix: number | null; error: string | null } {
    const trimmed = input.trim();
    if (!trimmed) return { unix: null, error: null };

    if (!trimmed.includes(":") && /^\d+(\.\d+)+$/.test(trimmed)) {
        const suggested = trimmed.replace(/\./g, ":");
        return { unix: null, error: `Use colons, not dots — did you mean "${suggested}"?` };
    }

    const parts = trimmed.split(":");
    let hours = 0, minutes = 0, secondsFloat = 0;

    if (parts.length === 2) {
        minutes = parseInt(parts[0], 10);
        secondsFloat = parseFloat(parts[1]);
    } else if (parts.length === 3) {
        hours = parseInt(parts[0], 10);
        minutes = parseInt(parts[1], 10);
        secondsFloat = parseFloat(parts[2]);
    } else {
        return { unix: null, error: "Use mm:ss or hh:mm:ss format" };
    }

    if (isNaN(hours) || isNaN(minutes) || isNaN(secondsFloat)) {
        return { unix: null, error: "Numbers only — use mm:ss or hh:mm:ss" };
    }
    if (hours > 23 || minutes > 59 || secondsFloat >= 60) {
        return { unix: null, error: "Invalid value — check hours, minutes, seconds" };
    }

    const base = (eventDate ?? new Date().toISOString()).split("T")[0];
    const [y, mo, d] = base.split("-").map(Number);
    const secs = Math.floor(secondsFloat);
    const ms = Math.round((secondsFloat - secs) * 1000);
    return { unix: new Date(y, mo - 1, d, hours, minutes, secs, ms).getTime(), error: null };
}

function unixToTimeString(unix: number | null | undefined): string {
    if (!unix) return "";
    const d = new Date(unix);
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
        .map(n => String(n).padStart(2, "0"))
        .join(":");
}

function formatElapsed(ms: number | null) {
    if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
    const totalSecs = ms / 1000;
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    const sf = s.toFixed(1).padStart(4, "0");
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${sf}`;
    if (m > 0) return `${m}:${sf}`;
    return `${sf}s`;
}

function statusLabel(status: string | undefined): string {
    const map: Record<string, string> = {
        pending_crew: "Pending",
        registered: "Reg",
        in_progress: "Racing",
        finished: "Done",
        dns: "DNS",
        dnf: "DNF",
        under_review: "Review",
    };
    return map[status ?? ""] ?? (status ?? "");
}

function statusStyle(status: string | undefined): React.CSSProperties {
    if (status === "dns" || status === "dnf") return { color: "var(--danger)" };
    if (status === "in_progress") return { color: "var(--brand)" };
    if (status === "finished") return { color: "rgba(74,222,128,0.9)" };
    return { color: "var(--muted)" };
}

interface TimeState {
    start: string;
    finish: string;
    startError: string | null;
    finishError: string | null;
}

export default function ResultsEditor({ event, boats }: any) {
    const eventDate = event?.startDate as string | undefined;

    const [timeState, setTimeState] = useState<Record<string, TimeState>>(() => {
        const init: Record<string, TimeState> = {};
        boats.forEach((b: any) => {
            init[b.id] = {
                start: unixToTimeString(b.startedAt),
                finish: unixToTimeString(b.finishedAt),
                startError: null,
                finishError: null,
            };
        });
        return init;
    });

    const [adjustments, setAdjustments] = useState<Record<string, number>>(() => {
        const init: Record<string, number> = {};
        boats.forEach((b: any) => {
            if (b.adjustmentMs) init[b.id] = b.adjustmentMs;
        });
        return init;
    });

    const [saving, setSaving] = useState<Record<string, Record<string, boolean>>>({});

    const setSavingField = (boatId: string, field: string, val: boolean) =>
        setSaving(prev => ({ ...prev, [boatId]: { ...prev[boatId], [field]: val } }));

    const handleTimeChange = (boatId: string, field: "start" | "finish", value: string) => {
        setTimeState(prev => ({
            ...prev,
            [boatId]: { ...prev[boatId], [field]: value, [`${field}Error`]: null },
        }));
    };

    const handleTimeBlur = async (boatId: string, field: "start" | "finish") => {
        const state = timeState[boatId];
        if (!state) return;

        const raw = field === "start" ? state.start : state.finish;
        if (!raw.trim()) return;

        const { unix, error } = parseTimeToUnix(raw, eventDate);
        if (error) {
            setTimeState(prev => ({
                ...prev,
                [boatId]: { ...prev[boatId], [`${field}Error`]: error },
            }));
            return;
        }
        if (unix == null) return;

        const boat = boats.find((b: any) => b.id === boatId);
        const otherRaw = field === "start" ? state.finish : state.start;
        const otherParsed = parseTimeToUnix(otherRaw, eventDate);
        const otherUnix =
            otherParsed.error == null && otherParsed.unix != null
                ? otherParsed.unix
                : field === "start"
                ? (boat?.finishedAt ?? null)
                : (boat?.startedAt ?? null);

        const startedAt = field === "start" ? unix : otherUnix;
        const finishedAt = field === "finish" ? unix : otherUnix;

        if (startedAt != null && finishedAt != null && finishedAt < startedAt) {
            const errorField = field === "finish" ? "finishError" : "startError";
            const msg = field === "finish" ? "Finish must be after start" : "Start must be before finish";
            setTimeState(prev => ({ ...prev, [boatId]: { ...prev[boatId], [errorField]: msg } }));
            return;
        }

        setSavingField(boatId, field, true);
        try {
            await saveBoatTimes(event.id, boatId, startedAt, finishedAt);
        } catch (err) {
            console.error("Failed to save time", err);
        } finally {
            setSavingField(boatId, field, false);
        }
    };

    const handleAdjChange = (boatId: string, value: string) =>
        setAdjustments(prev => ({ ...prev, [boatId]: Number(value) }));

    const handleAdjSave = async (boatId: string) => {
        const newValue = Number.isFinite(adjustments[boatId]) ? adjustments[boatId] : 0;
        const boat = boats.find((b: any) => b.id === boatId);
        const existing = boat?.adjustmentMs != null ? boat.adjustmentMs : 0;
        if (existing === newValue) return;

        setSavingField(boatId, "adj", true);
        try {
            await saveBoatAdjustment(event.id, boatId, newValue);
        } catch (err) {
            console.error("Failed to save adjustment", err);
        } finally {
            setSavingField(boatId, "adj", false);
        }
    };

    // Sort by category then bow number, then group by category for headers
    const sortedBoats = [...boats].sort((a: any, b: any) => {
        const catA = a.categoryName ?? "";
        const catB = b.categoryName ?? "";
        if (catA !== catB) return catA.localeCompare(catB);
        return (a.bowNumber ?? Infinity) - (b.bowNumber ?? Infinity);
    });

    const cols = "grid-cols-[40px_1fr_110px_110px_70px_50px]";

    const timeInput = (boatId: string, field: "start" | "finish", state: TimeState, isSaving: Record<string, boolean>) => {
        const isStart = field === "start";
        const value = isStart ? state.start : state.finish;
        const error = isStart ? state.startError : state.finishError;
        return (
            <div className="flex flex-col gap-1">
                <input
                    type="text"
                    inputMode="numeric"
                    placeholder="hh:mm:ss"
                    value={value}
                    disabled={isSaving[field]}
                    onChange={e => handleTimeChange(boatId, field, e.target.value)}
                    onBlur={() => handleTimeBlur(boatId, field)}
                    style={error ? { borderColor: "var(--danger)" } : {}}
                />
                {error && (
                    <span className="text-xs leading-tight" style={{ color: "var(--danger)" }}>
                        {error}
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="card">
            <h3>Results &amp; Times</h3>
            <p className="text-muted text-sm mb-4">
                Enter times as <strong>hh:mm:ss</strong> or <strong>mm:ss</strong>. Times are saved when you leave each field.
            </p>

            {sortedBoats.length === 0 && (
                <p className="text-muted text-sm py-2 text-center">No crews registered yet.</p>
            )}

            {sortedBoats.length > 0 && (
                <>
                    {/* ── TABLE (sm+): scrolls horizontally if needed ── */}
                    <div className="max-[640px]:hidden overflow-x-auto -mx-[14px] px-[14px]">
                        <div style={{ minWidth: "540px" }}>
                            <div className={`grid ${cols} gap-2 py-2 border-b border-border font-semibold text-text text-sm`}>
                                <span>Bow</span>
                                <span>Club</span>
                                <span>Start</span>
                                <span>Finish</span>
                                <span>Elapsed</span>
                                <span>Adj</span>
                            </div>

                            {sortedBoats.map((b: any, i: number) => {
                                const prev = sortedBoats[i - 1];
                                const showCatHeader = b.categoryName && b.categoryName !== prev?.categoryName;

                                const state = timeState[b.id] ?? { start: "", finish: "", startError: null, finishError: null };
                                const isSaving = saving[b.id] ?? {};

                                const sp = parseTimeToUnix(state.start, eventDate);
                                const fp = parseTimeToUnix(state.finish, eventDate);
                                const startMs = sp.error == null ? sp.unix : null;
                                const finishMs = fp.error == null ? fp.unix : null;
                                const adjMs = (Number.isFinite(adjustments[b.id]) ? adjustments[b.id] : 0) * 1000;
                                const elapsed = Number.isFinite(startMs) && Number.isFinite(finishMs) ? (finishMs! - startMs! + adjMs) : null;

                                return (
                                    <div key={b.id}>
                                        {showCatHeader && (
                                            <div className="text-xs font-semibold text-muted uppercase tracking-wider pt-3 pb-1 border-b border-border">
                                                {b.categoryName}
                                            </div>
                                        )}
                                        <div className={`grid ${cols} gap-2 py-2 border-b border-border items-start last:border-b-0`}>
                                            <div className="overflow-hidden">
                                                <span className="font-mono font-bold text-sm block">{b.bowNumber ?? "—"}</span>
                                                <span className="text-xs block truncate" style={statusStyle(b.status)}>{statusLabel(b.status)}</span>
                                            </div>
                                            <span className="text-sm self-center overflow-hidden text-ellipsis whitespace-nowrap" title={b.clubName}>{b.clubName}</span>
                                            {timeInput(b.id, "start", state, isSaving)}
                                            {timeInput(b.id, "finish", state, isSaving)}
                                            <span className="font-mono text-sm self-center">{formatElapsed(elapsed)}</span>
                                            <input
                                                type="number"
                                                value={adjustments[b.id] ?? ""}
                                                placeholder="0"
                                                disabled={isSaving.adj}
                                                onChange={e => handleAdjChange(b.id, e.target.value)}
                                                onBlur={() => handleAdjSave(b.id)}
                                                className="self-center"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── MOBILE CARDS (below 640px) ── */}
                    <div className="min-[641px]:hidden flex flex-col gap-3">
                        {sortedBoats.map((b: any, i: number) => {
                            const prev = sortedBoats[i - 1];
                            const showCatHeader = b.categoryName && b.categoryName !== prev?.categoryName;

                            const state = timeState[b.id] ?? { start: "", finish: "", startError: null, finishError: null };
                            const isSaving = saving[b.id] ?? {};

                            const sp = parseTimeToUnix(state.start, eventDate);
                            const fp = parseTimeToUnix(state.finish, eventDate);
                            const startMs = sp.error == null ? sp.unix : null;
                            const finishMs = fp.error == null ? fp.unix : null;
                            const adjMs = (adjustments[b.id] ?? 0) * 1000;
                            const elapsed = startMs != null && finishMs != null ? finishMs - startMs + adjMs : null;

                            return (
                                <div key={b.id}>
                                    {showCatHeader && (
                                        <div className="text-xs font-semibold text-muted uppercase tracking-wider pt-2 pb-1">
                                            {b.categoryName}
                                        </div>
                                    )}
                                    <div className="bg-surface-2 border border-border rounded-[12px] p-3 flex flex-col gap-3">
                                        {/* Identity */}
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-mono font-bold text-base flex-shrink-0">{b.bowNumber ?? "—"}</span>
                                                <span className="text-sm font-medium truncate">{b.clubName}</span>
                                            </div>
                                            <span className="text-xs flex-shrink-0" style={statusStyle(b.status)}>{statusLabel(b.status)}</span>
                                        </div>

                                        {/* Start / Finish */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <label>
                                                Start
                                                {timeInput(b.id, "start", state, isSaving)}
                                            </label>
                                            <label>
                                                Finish
                                                {timeInput(b.id, "finish", state, isSaving)}
                                            </label>
                                        </div>

                                        {/* Elapsed + Adj */}
                                        <div className="flex items-start gap-3">
                                            <div className="flex-1">
                                                <span className="block text-xs text-muted font-semibold mb-1">Elapsed</span>
                                                <span className="font-mono text-sm">{formatElapsed(elapsed)}</span>
                                            </div>
                                            <label className="w-[80px] flex-shrink-0">
                                                Adj (s)
                                                <input
                                                    type="number"
                                                    value={adjustments[b.id] ?? ""}
                                                    placeholder="0"
                                                    disabled={isSaving.adj}
                                                    onChange={e => handleAdjChange(b.id, e.target.value)}
                                                    onBlur={() => handleAdjSave(b.id)}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
