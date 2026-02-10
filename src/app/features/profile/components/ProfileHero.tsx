import type {UserProfile} from "../../auth/types.ts";

export function ProfileHero({
                         profile,
                         unit,
                         toggleUnit
                     }: { profile: UserProfile; unit: "metric"|"imperial"; toggleUnit: ()=>void }) {

    const roles = [];
    if(profile.roles?.rower) roles.push("Rower");
    if(profile.roles?.coach) roles.push("Coach");
    if(profile.roles?.host) roles.push("Host");
    if(profile.roles?.admin) roles.push("Admin");

    return (
        <section className="profile-hero card">
            <div className="profile-avatar">{profile.displayName?.charAt(0)}</div>
            <div>
                <h2>{profile.displayName || profile.fullName}</h2>
                <p className="muted">{profile.primaryRole}</p>
                {profile.roles?.rower && <p className="muted">Club: {profile.roles.rower.club}</p>}
                {roles.length > 0 && (
                    <div className="chips">
                        {roles.map(r => <span key={r} className="chip">{r}</span>)}
                    </div>
                )}
                {profile.roles.rower && (
                    <button className="btn-toggle" onClick={toggleUnit}>
                        Switch to {unit === "metric" ? "Imperial" : "Metric"}
                    </button>
                )}


            </div>
        </section>
    )
}
