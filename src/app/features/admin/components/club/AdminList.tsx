import { useEffect, useState, useCallback } from "react";
import {
    getClubAdminProfiles,
    removeClubAdmin,
    type ClubAdminProfile,
} from "../../services/clubAdminService";

type Props = {
    clubId:    string;
    adminUids: string[];
    currentUid: string;
    onAction:  (msg: string, type?: "success" | "error") => void;
};

function initials(name: string): string {
    return name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function AdminList({ clubId, adminUids, currentUid, onAction }: Props) {
    const [admins,   setAdmins]   = useState<ClubAdminProfile[]>([]);
    const [loading,  setLoading]  = useState(true);
    const [removing, setRemoving] = useState<string | null>(null);

    const reload = useCallback(() => {
        if (!adminUids.length) { setAdmins([]); setLoading(false); return; }
        setLoading(true);
        getClubAdminProfiles(adminUids)
            .then(data => { setAdmins(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [adminUids]);

    useEffect(() => { reload(); }, [reload]);

    async function onRemove(targetUid: string, displayName: string) {
        if (removing) return;
        setRemoving(targetUid);
        try {
            await removeClubAdmin({ targetUid });
            onAction(`${displayName} has been removed as admin.`);
            reload();
        } catch (err: any) {
            onAction(err?.message ?? "Failed to remove admin.", "error");
        } finally {
            setRemoving(null);
        }
    }

    if (loading) {
        return (
            <div className="stack">
                {[1, 2].map(i => <div key={i} className="pa-skeleton-row" />)}
            </div>
        );
    }

    if (!admins.length) {
        return <p className="muted" style={{ fontSize: 13 }}>No admins found.</p>;
    }

    return (
        <div className="stack">
            {admins.map(admin => (
                <div key={admin.uid} className="flex items-center gap-md px-[14px] py-3 bg-surface-2 border border-border rounded-sm max-sm:flex-wrap">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[0.9rem] shrink-0 font-sans bg-[linear-gradient(135deg,rgba(255,212,0,0.2),rgba(255,212,0,0.35))] text-brand">
                        {initials(admin.displayName || admin.email)}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[0.9rem] text-text truncate">{admin.displayName || "—"}</div>
                        <div className="text-[0.78rem] text-muted mt-[2px] truncate">{admin.email}</div>
                    </div>

                    <div className="flex items-center gap-sm shrink-0 max-sm:w-full max-sm:justify-end max-sm:pt-2 max-sm:border-t max-sm:border-border max-sm:mt-1">
                        {admin.canManageAdmins && (
                            <span className="text-[0.72rem] px-2 py-[4px] border border-brand/30 text-brand rounded-sm">
                                Admin manager
                            </span>
                        )}
                        {admin.uid === currentUid ? (
                            <span className="text-[0.72rem] text-muted px-2 py-[4px]">You</span>
                        ) : (
                            <button
                                className="pa-btn"
                                style={{ fontSize: "0.75rem", padding: "5px 10px", color: "var(--danger)", borderColor: "rgba(255,77,109,0.25)" }}
                                onClick={() => onRemove(admin.uid, admin.displayName)}
                                disabled={removing === admin.uid}
                            >
                                {removing === admin.uid ? "Removing…" : "Remove"}
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
