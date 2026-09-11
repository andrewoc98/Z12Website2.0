import { useState } from "react";
import { formatErgTime, formatSplit } from "../../events/api/ergScores";

/** The only fields the erg leaderboard needs off a user profile. */
export interface LeaderboardProfile {
    displayName?: string;
    fullName?: string;
}

export interface ErgEntry {
    id: string;
    clubName: string;
    categoryName?: string;
    category?: string;
    rowerUids?: string[];
    ergBestTimeMs?: number | null;
    ergScoreCount?: number;
}

interface Props {
    entry: ErgEntry;
    rank: number;
    distanceMeters: number;
    profiles: Record<string, LeaderboardProfile>;
    currentUserUid?: string;
    linkedAthleteUids?: Set<string>;
}

function athleteName(uid: string | undefined, profiles: Record<string, LeaderboardProfile>): string {
    if (!uid) return "Unknown";
    const p = profiles[uid];
    const name: string | undefined = p?.displayName ?? p?.fullName;
    if (!name) return "Unknown";
    const parts = name.trim().split(" ");
    return parts.length > 1 ? `${parts[0].charAt(0)}. ${parts[parts.length - 1]}` : name;
}

/**
 * One row of an erg leaderboard. Deliberately mirrors ResultCard's markup and
 * classes so the two kinds of event produce a leaderboard that reads the same —
 * only the metrics differ (split and attempt count instead of a start time).
 */
export default function ErgResultCard({
    entry,
    rank,
    distanceMeters,
    profiles,
    currentUserUid,
    linkedAthleteUids,
}: Props) {
    const [open, setOpen] = useState(false);

    const uids = entry.rowerUids ?? [];
    const isMe = !!(currentUserUid && uids.includes(currentUserUid));
    const isMyAthlete =
        !isMe && !!(linkedAthleteUids?.size && uids.some((uid) => linkedAthleteUids.has(uid)));

    const timeMs = entry.ergBestTimeMs ?? 0;
    const attempts = entry.ergScoreCount ?? 0;

    const cardCls = [
        "bg-surface border rounded-sm px-4 py-[14px] cursor-pointer transition-[border-color] duration-150 max-sm:px-3",
        isMe        ? "border-brand bg-[rgba(255,212,0,0.03)] animate-[mine-glow_3s_ease-in-out_infinite] hover:border-brand" : "",
        isMyAthlete ? "border-[#10b981] bg-[rgba(16,185,129,0.03)] hover:border-[#10b981]" : "",
        !isMe && !isMyAthlete ? "border-border hover:border-brand" : "",
    ].filter(Boolean).join(" ");

    return (
        <li className={cardCls} onClick={() => setOpen(!open)}>
            <div className="flex justify-between items-center gap-3 max-sm:flex-wrap max-sm:gap-2">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="text-brand font-bold text-lg w-8 shrink-0">{rank}</span>
                    <div className="min-w-0">
                        <div className="font-semibold truncate">
                            {athleteName(uids[0], profiles)}
                            {isMe && (
                                <span className="ml-2 text-[10px] font-bold text-brand tracking-wider">YOU</span>
                            )}
                            {isMyAthlete && (
                                <span className="ml-2 text-[10px] font-bold text-[#10b981] tracking-wider">ATHLETE</span>
                            )}
                        </div>
                        <div className="text-muted text-xs truncate">
                            {entry.clubName || "—"}
                            {entry.categoryName ? ` · ${entry.categoryName}` : ""}
                        </div>
                    </div>
                </div>

                <div className="text-right shrink-0">
                    <div className="font-bold tabular-nums">{formatErgTime(timeMs)}</div>
                    <div className="text-muted text-xs tabular-nums">
                        {formatSplit(timeMs, distanceMeters)}
                    </div>
                </div>
            </div>

            {open && (
                <div className="mt-3 pt-3 border-t border-border text-xs text-muted grid gap-1">
                    <div>
                        Best of {attempts} verified {attempts === 1 ? "attempt" : "attempts"}
                    </div>
                    <div>Distance: {distanceMeters}m on a Concept2 RowErg</div>
                    <div>Verified by Concept2 Logbook</div>
                </div>
            )}
        </li>
    );
}
