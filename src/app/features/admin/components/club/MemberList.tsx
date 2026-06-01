import { useEffect, useState, useCallback } from "react";
import type { ClubMembership } from "../../../auth/club";
import { getClubMembers } from "../../services/clubAdminService";
import RoleBadge from "../../../../shared/components/RoleBadge/RoleBadge";
import RemoveMemberModal from "./RemoveMemberModal";
import "../../styles/platformAdmin.css";
import "../../styles/clubAdmin.css";

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
            <div className="cl-list-header">
                <div className="cl-filter-tabs">
                    {(["all", "rower", "coach"] as Filter[]).map(f => (
                        <button
                            key={f}
                            className={`cl-filter-tab${filter === f ? " cl-filter-tab--active" : ""}`}
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
                        <div key={member.uid} className="cl-member-row">
                            <div className={`cl-member-row__avatar${member.role === "coach" ? " cl-member-row__avatar--coach" : ""}`}>
                                {initials(member.displayName)}
                            </div>

                            <div className="cl-member-row__body">
                                <div className="cl-member-row__name">{member.displayName}</div>
                                <div className="cl-member-row__email">{member.email}</div>
                            </div>

                            <div className="cl-member-row__right">
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
