import { useEffect, useState, useCallback } from "react";
import type { ClubMembership } from "../../../auth/club";
import { getClubMembers } from "../../services/clubAdminService";
import RoleBadge from "../../../../shared/components/RoleBadge/RoleBadge";
import RemoveMemberModal from "./RemoveMemberModal";

type Props = {
    clubId:   string;
    onAction: (msg: string, type?: "success" | "error") => void;
};

type Filter = "all" | "rower" | "coach";

function initials(name: string): string {
    return name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function SkeletonRows() {
    return (
        <div className="stack">
            {[1, 2, 3, 4].map(i => <div key={i} className="pa-skeleton-row" />)}
        </div>
    );
}

export default function MemberList({ clubId, onAction }: Props) {
    const [members,    setMembers]    = useState<ClubMembership[]>([]);
    const [loading,    setLoading]    = useState(true);
    const [filter,     setFilter]     = useState<Filter>("all");
    const [removing,   setRemoving]   = useState<ClubMembership | null>(null);
    const [tick,       setTick]       = useState(0);

    const reload = useCallback(() => setTick(t => t + 1), []);

    useEffect(() => {
        if (!clubId) return;
        let cancelled = false;
        setLoading(true);

        getClubMembers(clubId)
            .then(data => { if (!cancelled) { setMembers(data); setLoading(false); } })
            .catch(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [clubId, tick]);

    const filtered = filter === "all"
        ? members
        : members.filter(m => m.role === filter);

    const rowerCount = members.filter(m => m.role === "rower").length;
    const coachCount = members.filter(m => m.role === "coach").length;

    function onRemoved(msg: string) {
        setRemoving(null);
        onAction(msg);
        reload();
    }

    return (
        <>
            <div className="flex items-center justify-between flex-wrap gap-sm mb-md">
                <div className="flex gap-[6px]">
                    {(["all", "rower", "coach"] as Filter[]).map(f => (
                        <button
                            key={f}
                            className={`px-3 py-[5px] text-[0.78rem] rounded-full border cursor-pointer font-sans font-medium transition-[background,color,border-color] duration-150 normal-case tracking-normal min-h-[unset] shadow-none ${filter === f ? "bg-brand/12 text-brand border-brand/35 font-semibold" : "border-border bg-transparent text-muted hover:text-text hover:bg-surface-2"}`}
                            onClick={() => setFilter(f)}
                        >
                            {f === "all"   ? `All (${members.length})`  : ""}
                            {f === "rower" ? `Rowers (${rowerCount})`   : ""}
                            {f === "coach" ? `Coaches (${coachCount})`  : ""}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <SkeletonRows />
            ) : filtered.length === 0 ? (
                <div className="pa-empty">
                    <div className="pa-empty__icon">👥</div>
                    <p className="pa-empty__text">
                        {members.length === 0
                            ? "No members yet. Add members using the button above."
                            : `No ${filter}s in this club.`}
                    </p>
                </div>
            ) : (
                <div className="stack">
                    {filtered.map(member => (
                        <div key={member.uid} className="flex items-center gap-md px-[14px] py-3 bg-surface-2 border border-border rounded-sm transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-soft max-sm:flex-wrap">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-[0.9rem] shrink-0 font-sans ${member.role === "coach" ? "bg-[linear-gradient(135deg,rgba(254,185,89,0.2),rgba(254,185,89,0.4))] text-brand-warm" : "bg-[linear-gradient(135deg,rgba(96,165,250,0.2),rgba(96,165,250,0.4))] text-[#93c5fd]"}`}>
                                {initials(member.displayName)}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-[0.9rem] text-text truncate">{member.displayName}</div>
                                <div className="text-[0.78rem] text-muted mt-[2px] truncate">{member.email}</div>
                            </div>

                            <div className="flex items-center gap-sm shrink-0 max-sm:w-full max-sm:justify-end max-sm:pt-2 max-sm:border-t max-sm:border-border max-sm:mt-1">
                                <RoleBadge role={member.role as any} />
                                <button
                                    className="pa-btn"
                                    style={{ fontSize: "0.75rem", padding: "5px 10px", color: "var(--danger)", borderColor: "rgba(255,77,109,0.25)" }}
                                    onClick={() => setRemoving(member)}
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {removing && (
                <RemoveMemberModal
                    member={removing}
                    onClose={() => setRemoving(null)}
                    onRemoved={onRemoved}
                />
            )}
        </>
    );
}
