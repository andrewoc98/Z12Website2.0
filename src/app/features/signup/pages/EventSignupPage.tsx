import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import type { EventDoc } from "../../events/types";
import { listEvents } from "../../events/api/events";
import { useMockAuth } from "../../../providers/MockAuthProvider";
import type { BoatSize } from "../types";
import { createBoat, listBoatsForEvent } from "../api/boats";
import {
    parseBoatClassFromCategory,
    boatSizeFromBoatClass,
    type Gender,
} from "../../events/lib/categories";

type GroupKey = "All" | "Junior" | "U19" | "U21" | "U23" | "Senior" | "Masters" | "Para";
type GenderFilter = "All" | Gender;

function groupFromDivisionString(division: string): GroupKey {
    if (division.startsWith("Junior")) return "Junior";
    if (division.startsWith("U19")) return "U19";
    if (division.startsWith("U21")) return "U21";
    if (division.startsWith("U23")) return "U23";
    if (division.startsWith("Senior")) return "Senior";
    if (division.startsWith("Masters")) return "Masters";
    if (division === "Para") return "Para";
    return "All";
}

function parseCategoryParts(cat: string): { gender: string; division: string; boatClass: string } | null {
    const parts = cat.split("•").map((s) => s.trim());
    if (parts.length !== 3) return null;
    return { gender: parts[0], division: parts[1], boatClass: parts[2] };
}

function boatSizeLabel(size: number) {
    if (size === 1) return "Single";
    if (size === 2) return "Double";
    if (size === 4) return "Quad";
    if (size === 8) return "Eight";
    return String(size);
}

export default function EventSignupPage() {
    const { eventId } = useParams<{ eventId: string }>();
    const { user } = useMockAuth();

    const [events, setEvents] = useState<EventDoc[]>([]);
    const [boats, setBoats] = useState<any[]>([]);

    const [clubName, setClubName] = useState("Z12 RC");
    const [category, setCategory] = useState("");
    const [inviteEmail, setInviteEmail] = useState("");

    // Category filters
    const [catGender, setCatGender] = useState<GenderFilter>("All");
    const [catGroup, setCatGroup] = useState<GroupKey>("All");
    const [catQuery, setCatQuery] = useState("");

    const [loadingEvent, setLoadingEvent] = useState(true);
    const [loadingBoats, setLoadingBoats] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Load events list (or replace with getEvent(eventId) if you have it)
    useEffect(() => {
        (async () => {
            setLoadingEvent(true);
            setErr(null);
            try {
                const e = await listEvents();
                setEvents(e);
            } catch (e: any) {
                setErr(e?.message ?? "Failed to load event");
            } finally {
                setLoadingEvent(false);
            }
        })();
    }, []);

    const selectedEvent = useMemo(() => {
        if (!eventId) return null;
        return events.find((e) => e.id === eventId) ?? null;
    }, [events, eventId]);

    // Load boats for this event
    useEffect(() => {
        if (!eventId) return;
        (async () => {
            setLoadingBoats(true);
            try {
                const b = await listBoatsForEvent(eventId);
                setBoats(b);
            } finally {
                setLoadingBoats(false);
            }
        })();
    }, [eventId]);

    // Default category when event loads/changes
    useEffect(() => {
        if (selectedEvent && selectedEvent.categories.length > 0) {
            setCategory(selectedEvent.categories[0]);
            setCatGender("All");
            setCatGroup("All");
            setCatQuery("");
        }
    }, [eventId, selectedEvent?.categories?.length]);

    const filteredCategories = useMemo(() => {
        if (!selectedEvent) return [];
        const q = catQuery.trim().toLowerCase();

        return selectedEvent.categories.filter((c) => {
            const p = parseCategoryParts(c);
            if (!p) return false;

            if (catGender !== "All" && p.gender !== catGender) return false;

            const group = groupFromDivisionString(p.division);
            if (catGroup !== "All" && group !== catGroup) return false;

            if (q) {
                const hay = `${p.gender} ${p.division} ${p.boatClass}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [selectedEvent, catGender, catGroup, catQuery]);

    // Ensure selected category stays valid under filters
    useEffect(() => {
        if (!selectedEvent) return;
        if (!category) return;
        if (filteredCategories.length === 0) return;

        if (!filteredCategories.includes(category)) {
            setCategory(filteredCategories[0]);
        }
    }, [filteredCategories, selectedEvent, category]);

    // Derived boat size from category
    const derivedBoatSize: BoatSize | null = useMemo(() => {
        const bc = parseBoatClassFromCategory(category);
        if (!bc) return null;
        return boatSizeFromBoatClass(bc) as BoatSize;
    }, [category]);

    const canCreate =
        !!user &&
        !!selectedEvent &&
        clubName.trim().length > 1 &&
        !!category &&
        derivedBoatSize !== null &&
        selectedEvent.status === "open";

    async function onCreateBoat() {
        if (!user || !selectedEvent || !eventId || derivedBoatSize === null) return;

        setErr(null);
        setBusy(true);
        try {
            const invites = derivedBoatSize === 1 ? [] : inviteEmail.trim() ? [inviteEmail.trim()] : [];

            await createBoat({
                eventId,
                category,
                clubName,
                boatSize: derivedBoatSize,
                rowerUids: [user.uid],
                invitedEmails: invites,
            });

            const b = await listBoatsForEvent(eventId);
            setBoats(b);

            setInviteEmail("");
            alert("Signed up boat!");
        } catch (e: any) {
            setErr(e?.message ?? "Failed to sign up");
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Navbar />
            <main>
                <div className="row" style={{ marginBottom: 10 }}>
                    <Link to="/rower/events">
                        <button type="button" className="btn-ghost">
                            ← Back to events
                        </button>
                    </Link>
                </div>

                {loadingEvent ? (
                    <p>Loading event…</p>
                ) : err ? (
                    <p style={{ color: "crimson" }}>{err}</p>
                ) : !eventId ? (
                    <p>Missing event id.</p>
                ) : !selectedEvent ? (
                    <div className="card">
                        <h2>Event not found</h2>
                        <p className="muted">This event may have been removed or you may not have access.</p>
                        <Link to="/rower/events">
                            <button type="button" className="btn-primary">
                                Return to events
                            </button>
                        </Link>
                    </div>
                ) : (
                    <>
                        <h1>{selectedEvent.name}</h1>
                        <p>
                            {selectedEvent.location} • {selectedEvent.startDate} → {selectedEvent.endDate}
                        </p>

                        {selectedEvent.description && <p className="muted">{selectedEvent.description}</p>}

                        {selectedEvent.status !== "open" && (
                            <div className="card" style={{ marginTop: 12 }}>
                                <div className="space-between">
                                    <h3>Sign up closed</h3>
                                    <span className="badge">Status: {selectedEvent.status}</span>
                                </div>
                                <p className="muted">You can still view registered boats below.</p>
                            </div>
                        )}

                        {/* Category filters */}
                        <div className="card" style={{ marginTop: 12 }}>
                            <div className="space-between">
                                <h3>Category</h3>
                                <span className="badge">
                  {filteredCategories.length}/{selectedEvent.categories.length}
                </span>
                            </div>

                            <div className="row" style={{ marginTop: 10 }}>
                                <select value={catGender} onChange={(e) => setCatGender(e.target.value as GenderFilter)}>
                                    <option value="All">All genders</option>
                                    <option value="Men">Men</option>
                                    <option value="Women">Women</option>
                                    <option value="Mixed">Mixed</option>
                                </select>

                                <select value={catGroup} onChange={(e) => setCatGroup(e.target.value as GroupKey)}>
                                    <option value="All">All groups</option>
                                    <option value="Junior">Junior</option>
                                    <option value="U19">U19</option>
                                    <option value="U21">U21</option>
                                    <option value="U23">U23</option>
                                    <option value="Senior">Senior</option>
                                    <option value="Masters">Masters</option>
                                    <option value="Para">Para</option>
                                </select>

                                <input
                                    value={catQuery}
                                    onChange={(e) => setCatQuery(e.target.value)}
                                    placeholder="Search (e.g. Masters A, 2x, Open)"
                                />
                            </div>

                            <label style={{ marginTop: 10 }}>
                                Pick a category
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    disabled={filteredCategories.length === 0 || selectedEvent.status !== "open"}
                                >
                                    {filteredCategories.map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="row" style={{ marginTop: 10 }}>
                <span className="badge badge--brand">
                  Boat: {derivedBoatSize ? boatSizeLabel(derivedBoatSize) : "—"}
                </span>
                                <span className="muted">Boat size is derived from the boat class in the category.</span>
                            </div>

                            {filteredCategories.length === 0 && <p className="muted">No categories match your filters.</p>}
                        </div>

                        <label>
                            Club Name
                            <input value={clubName} onChange={(e) => setClubName(e.target.value)} />
                        </label>

                        {derivedBoatSize !== 1 && selectedEvent.status === "open" && (
                            <label>
                                Invite teammate email (optional for now)
                                <input
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="friend@email.com"
                                />
                            </label>
                        )}

                        {err && <p style={{ color: "crimson" }}>{err}</p>}

                        <button disabled={!canCreate || busy} onClick={onCreateBoat} style={{ marginTop: 12 }}>
                            {busy ? "Signing up..." : "Register Boat"}
                        </button>

                        <hr />

                        <h2>Registered Boats</h2>

                        {loadingBoats ? (
                            <p>Loading boats…</p>
                        ) : boats.length === 0 ? (
                            <p>No boats registered yet.</p>
                        ) : (
                            <ul style={{ display: "grid", gap: 10, padding: 0, listStyle: "none" }}>
                                {boats.map((b) => {
                                    const bc = parseBoatClassFromCategory(b.category);
                                    const derived = bc ? boatSizeFromBoatClass(bc) : null;

                                    return (
                                        <li key={b.id} className="card card--tight">
                                            <b>
                                                {b.clubName} • {b.category}
                                            </b>
                                            <div className="muted" style={{ marginTop: 6 }}>
                                                Boat: {derived ? boatSizeLabel(derived) : b.boatSize ?? "—"}
                                            </div>
                                            <div className="muted">
                                                Invites: {b.invitedEmails?.length ? b.invitedEmails.join(", ") : "None"}
                                            </div>
                                            <div className="muted">Bow: {b.bowNumber ?? "Not assigned yet"}</div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </>
                )}
            </main>
        </>
    );
}
