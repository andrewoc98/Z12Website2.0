import { useState, useMemo } from "react";
import CollapsibleCard from "../../CollapsibleCard";
import { updateBowNumber } from "../../../../signup/api/boats";
import { updateEvent } from "../../../api/events";
import { useUserProfiles } from "../../../../timing/useUserProfiles";

export default function BowNumbersTab({ event, boats = [] }: any) {
    const eventId: string = event?.id ?? "";
    const categoryOrder: string[] = useMemo(
        () => (event?.categories ?? []).map((c: any) => c.name ?? c.id),
        [event]
    );

    // ── Excluded numbers ────────────────────────────────────────────────────
    const [excludedInput, setExcludedInput] = useState<string>(
        (event?.excludedBowNumbers ?? []).join(", ")
    );
    const [excludeSaving, setExcludeSaving] = useState(false);
    const [excludeSaved, setExcludeSaved] = useState(false);

    function parseExcluded(raw: string): number[] {
        return raw
            .split(/[\s,]+/)
            .map((s) => parseInt(s, 10))
            .filter((n) => !isNaN(n) && n > 0);
    }

    const handleSaveExcluded = async () => {
        setExcludeSaving(true);
        const nums = parseExcluded(excludedInput);
        await updateEvent(eventId, { excludedBowNumbers: nums });
        setExcludeSaving(false);
        setExcludeSaved(true);
        setTimeout(() => setExcludeSaved(false), 2000);
    };

    // ── Manual bow number assignment ────────────────────────────────────────
    const [bowEdits, setBowEdits] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<string | null>(null);

    const activeBoats = useMemo(
        () => boats.filter((b: any) => b.status !== "pending_crew" && b.status !== "cancelled"),
        [boats]
    );

    const boatsByCategory = useMemo(() => {
        const map = new Map<string, any[]>();
        for (const key of categoryOrder) map.set(key, []);

        for (const boat of activeBoats) {
            const key = boat.categoryName ?? boat.category ?? boat.categoryId ?? "Uncategorised";
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(boat);
        }

        // Sort within each category: assigned (by bow number) first, then unassigned (by createdAt)
        for (const list of map.values()) {
            list.sort((a: any, b: any) => {
                if (a.bowNumber != null && b.bowNumber != null) return a.bowNumber - b.bowNumber;
                if (a.bowNumber != null) return -1;
                if (b.bowNumber != null) return 1;
                return (a.createdAt ?? 0) - (b.createdAt ?? 0);
            });
        }

        // Drop empty category slots
        for (const [key, list] of map) {
            if (list.length === 0) map.delete(key);
        }

        return map;
    }, [activeBoats, categoryOrder]);

    const dirtyCount = Object.keys(bowEdits).length;

    const handleSaveAll = async () => {
        if (!dirtyCount) return;
        setSaving(true);
        const tasks = Object.entries(bowEdits).map(([boatId, val]) => {
            const trimmed = val.trim();
            const num = trimmed === "" ? null : parseInt(trimmed, 10);
            const resolved = num !== null && isNaN(num) ? null : num;
            return updateBowNumber(eventId, boatId, resolved);
        });
        await Promise.allSettled(tasks);
        setBowEdits({});
        setSaving(false);
        setSaveMsg(`Saved ✓`);
        setTimeout(() => setSaveMsg(null), 2500);
    };

    // ── Start list export ────────────────────────────────────────────────────
    const allUids = useMemo(
        () => [...new Set(boats.flatMap((b: any) => b.rowerUids ?? []))] as string[],
        [boats]
    );
    const { profiles } = useUserProfiles(allUids);

    const startList = useMemo(
        () =>
            [...activeBoats]
                .filter((b: any) => b.bowNumber != null)
                .sort((a: any, b: any) => a.bowNumber - b.bowNumber),
        [activeBoats]
    );

    const startedCount = useMemo(
        () => boats.filter((b: any) => b.startedAt).length,
        [boats]
    );

    const handleExportCsv = () => {
        const rows: string[][] = [
            ["Bow", "Club", "Category", "Boat Size", "Rowers", "Status"],
        ];
        for (const b of startList) {
            const names = (b.rowerUids ?? [])
                .map((uid: string) => {
                    const p = profiles[uid];
                    return p?.fullName ?? p?.displayName ?? uid;
                })
                .join(" / ");
            rows.push([
                String(b.bowNumber),
                b.clubName ?? "",
                b.categoryName ?? b.category ?? b.categoryId ?? "",
                String(b.boatSize ?? ""),
                names,
                b.status ?? "",
            ]);
        }
        const csv = rows
            .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
            .join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${event?.name ?? "event"}-start-list.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col gap-5">

            {/* ── Excluded numbers ── */}
            <CollapsibleCard title="Excluded Bow Numbers" defaultOpen={true}>
                <p className="text-muted text-[14px] mb-3">
                    Enter bow numbers that are physically unavailable (e.g. lost or damaged).
                    These will be skipped during auto-assignment.
                </p>
                <div className="flex gap-2 items-center flex-wrap">
                    <input
                        className="border border-border rounded-[6px] bg-surface text-text px-3 py-[7px] w-[260px] text-[14px]"
                        placeholder="e.g. 7, 12, 15"
                        value={excludedInput}
                        onChange={(e) => { setExcludedInput(e.target.value); setExcludeSaved(false); }}
                    />
                    <button
                        className="btn"
                        onClick={handleSaveExcluded}
                        disabled={excludeSaving}
                    >
                        {excludeSaving ? "Saving…" : excludeSaved ? "Saved ✓" : "Save"}
                    </button>
                </div>
                {parseExcluded(excludedInput).length > 0 && (
                    <p className="text-muted text-[13px] mt-2">
                        Skipping: {parseExcluded(excludedInput).join(", ")}
                    </p>
                )}
            </CollapsibleCard>

            {/* ── Manual bow number assignment ── */}
            <CollapsibleCard title={`Bow Numbers (${activeBoats.length})`} defaultOpen={true}>
                {startedCount > 0 && (
                    <div className="bg-[rgba(255,107,107,0.12)] border border-[#ff6b6b] rounded-[6px] px-4 py-3 mb-4 text-[14px] text-[#ff6b6b]">
                        Warning: {startedCount} boat{startedCount !== 1 ? "s have" : " has"} already started.
                        Changing bow numbers won't affect timing.
                    </div>
                )}

                {activeBoats.length === 0 ? (
                    <p className="text-muted text-[14px]">No registered entries yet.</p>
                ) : (
                    <>
                        <div className="flex gap-3 items-center mb-5 flex-wrap">
                            <button
                                className="btn-primary"
                                onClick={handleSaveAll}
                                disabled={saving || dirtyCount === 0}
                            >
                                {saving
                                    ? "Saving…"
                                    : saveMsg
                                    ?? (dirtyCount > 0
                                        ? `Save ${dirtyCount} change${dirtyCount !== 1 ? "s" : ""}`
                                        : "No changes")}
                            </button>
                            <span className="text-muted text-[13px]">
                                Edit any bow number below, then save. Changes are highlighted.
                            </span>
                        </div>

                        <div className="flex flex-col gap-5">
                            {[...boatsByCategory.entries()].map(([catName, catBoats]) => (
                                <div key={catName}>
                                    <div className="text-[12px] font-semibold text-muted uppercase tracking-wide pb-1 border-b border-border mb-1">
                                        {catName} <span className="font-normal normal-case">({catBoats.length})</span>
                                    </div>
                                    <div className="border border-border rounded-[6px] overflow-hidden">
                                        <div className="grid grid-cols-[72px_1fr_1fr] bg-surface-2 px-3 py-[7px] text-[11px] font-semibold text-muted uppercase tracking-wide">
                                            <span>Bow #</span>
                                            <span>Club</span>
                                            <span>Rowers</span>
                                        </div>
                                        {catBoats.map((b: any) => {
                                            const isDirty = b.id in bowEdits;
                                            const displayVal = isDirty
                                                ? bowEdits[b.id]
                                                : (b.bowNumber != null ? String(b.bowNumber) : "");
                                            const rowerNames = (b.rowerUids ?? [])
                                                .map((uid: string) => {
                                                    const p = profiles[uid];
                                                    return p?.fullName ?? p?.displayName ?? "…";
                                                })
                                                .join(", ");
                                            return (
                                                <div
                                                    key={b.id}
                                                    className={`grid grid-cols-[72px_1fr_1fr] px-3 py-[8px] border-t border-border text-[14px] items-center transition-colors ${
                                                        isDirty
                                                            ? "bg-[rgba(254,185,89,0.07)]"
                                                            : "hover:bg-surface-2"
                                                    }`}
                                                >
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        className="border border-border rounded-[4px] bg-surface text-text px-2 py-[3px] text-[13px] w-[56px] text-center"
                                                        value={displayVal}
                                                        placeholder="—"
                                                        onChange={(e) =>
                                                            setBowEdits(prev => ({ ...prev, [b.id]: e.target.value }))
                                                        }
                                                        onBlur={(e) => {
                                                            const val = e.target.value.trim();
                                                            const orig = b.bowNumber != null ? String(b.bowNumber) : "";
                                                            if (val === orig) {
                                                                setBowEdits(prev => {
                                                                    const next = { ...prev };
                                                                    delete next[b.id];
                                                                    return next;
                                                                });
                                                            }
                                                        }}
                                                    />
                                                    <span className="text-text text-[13px] px-2 truncate">
                                                        {b.clubName || "—"}
                                                    </span>
                                                    <span className="text-muted text-[13px] px-2 truncate">
                                                        {rowerNames || "—"}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </CollapsibleCard>

            {/* ── Start list ── */}
            <CollapsibleCard title={`Start List (${startList.length})`} defaultOpen={false}>
                <div className="flex gap-3 items-center mb-4">
                    <button
                        className="btn"
                        onClick={handleExportCsv}
                        disabled={startList.length === 0}
                    >
                        Export CSV
                    </button>
                    {startList.length === 0 && (
                        <span className="text-muted text-[13px]">Assign bow numbers first.</span>
                    )}
                </div>
                {startList.length > 0 && (
                    <div className="border border-border rounded-[6px] overflow-hidden">
                        <div className="grid grid-cols-[56px_1fr_1fr_80px] bg-surface-2 px-3 py-2 text-[12px] font-semibold text-muted uppercase tracking-wide">
                            <span>Bow</span>
                            <span>Club</span>
                            <span>Category</span>
                            <span>Size</span>
                        </div>
                        {startList.map((b: any) => {
                            const names = (b.rowerUids ?? [])
                                .map((uid: string) => {
                                    const p = profiles[uid];
                                    return p?.fullName ?? p?.displayName ?? "…";
                                })
                                .join(", ");
                            return (
                                <div key={b.id} className="border-t border-border px-3 py-[9px] text-[14px] text-text hover:bg-surface-2">
                                    <div className="grid grid-cols-[56px_1fr_1fr_80px] items-start">
                                        <span className="font-semibold text-brand-warm">{b.bowNumber}</span>
                                        <span>{b.clubName}</span>
                                        <span className="text-muted">{b.categoryName ?? b.category ?? b.categoryId}</span>
                                        <span className="text-muted">{b.boatSize}x</span>
                                    </div>
                                    {names && (
                                        <div className="col-span-4 text-[12px] text-muted mt-[2px] pl-[56px]">
                                            {names}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </CollapsibleCard>

        </div>
    );
}
