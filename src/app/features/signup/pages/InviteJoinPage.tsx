import { useEffect, useRef, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { useAuth } from "../../../providers/AuthProvider";
import { joinBoatWithInviteCode, getInviteRequirements } from "../api/boats";

export default function InviteJoinPage() {
    const { eventId, code } = useParams<{ eventId: string; code: string }>();
    const { user, profile } = useAuth() as any;

    const [busy, setBusy] = useState(false);
    const [ok, setOk] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [eligibilityError, setEligibilityError] = useState<string | null>(null);
    const [requirements, setRequirements] = useState<any>(null);
    const [boatId, setBoatId] = useState<string | null>(null);

    const location = useLocation();
    const returnTo = encodeURIComponent(location.pathname + location.search);
    const hasValidatedRef = useRef(false);

    /* -----------------------------
       Load + validate eligibility
    ------------------------------ */
    useEffect(() => {
        if (!user || !profile || !eventId || !code) return;
        if (hasValidatedRef.current) return;

        hasValidatedRef.current = true;

        async function validate() {
            try {
                const req = await getInviteRequirements(eventId, code);
                setRequirements(req);
                setBoatId(req.boatId);

                // Ensure profile completeness
                if (!profile.dateOfBirth) {
                    setEligibilityError("Please add your date of birth to your profile.");
                    return;
                }

                if (!profile.gender) {
                    setEligibilityError("Please add your gender to your profile.");
                    return;
                }

                // Parse category string
                const parsed = parseCategoryString(req.category);
                if (!parsed) {
                    setEligibilityError("Unable to read category info.");
                    return;
                }

                // Gender check
                if (!isGenderAllowed(profile.gender, parsed.gender)) {
                    setEligibilityError(
                        `This boat is restricted to ${parsed.gender} rowers.`
                    );
                    return;
                }

                // Age check
                const age = getAgeOnDate(profile.dateOfBirth, req.eventDate);
                if (!isAgeAllowed(age, parsed.ageGroup)) {
                    setEligibilityError(
                        `You are not eligible for this category (${parsed.ageGroup}) based on your age.`
                    );
                    return;
                }

                setEligibilityError(null);
            } catch {
                setEligibilityError("Unable to validate invite eligibility.");
            }
        }

        validate();
    }, [user, profile, eventId, code]);

    /* -----------------------------
       Join handler
    ------------------------------ */
    async function onJoin() {
        if (!user || !profile || !eventId || !code || !boatId) return;
        if (eligibilityError) return;

        setBusy(true);
        setErr(null);

        try {
            await joinBoatWithInviteCode({
                eventId,
                boatId,
                uid: user.uid,
            });
            setOk(true);
        } catch (e: any) {
            setErr(e?.message ?? "Failed to join boat.");
        } finally {
            setBusy(false);
        }
    }

    /* -----------------------------
       Render
    ------------------------------ */
    return (
        <>
            <Navbar />
            <main>
                <div className="card auth-card">
                    <h1 className="auth-title">Join crew</h1>

                    {!eventId || !code ? (
                        <p className="muted">Missing invite link details.</p>
                    ) : !user ? (
                        <>
                            <p className="muted">Please sign in to accept this invite.</p>
                            <div className="auth-actions">
                                <Link to={`/auth?returnTo=${returnTo}`}>
                                    <button className="btn-primary">Sign in</button>
                                </Link>
                            </div>
                        </>
                    ) : ok ? (
                        <>
                            <p className="muted">You’ve joined the crew.</p>
                            <div className="auth-actions">
                                <Link to={`/rower/events/${eventId}/signup`}>
                                    <button className="btn-primary">Back to event</button>
                                </Link>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="muted">
                                Review eligibility below before joining this crew.
                            </p>

                            {requirements && (
                                <div className="card auth-info">
                                    <div className="muted">
                                        <strong>Category:</strong> {requirements.category}
                                    </div>
                                </div>
                            )}

                            {eligibilityError && (
                                <div className="card auth-error">
                                    <div className="auth-error-title">Not eligible</div>
                                    <div className="auth-error-msg muted">{eligibilityError}</div>
                                </div>
                            )}

                            {err && (
                                <div className="card auth-error">
                                    <div className="auth-error-title">Error</div>
                                    <div className="auth-error-msg muted">{err}</div>
                                </div>
                            )}

                            <div className="auth-actions">
                                <button
                                    className="btn-primary"
                                    disabled={busy || !!eligibilityError}
                                    onClick={onJoin}
                                >
                                    {busy ? "Joining..." : "Join crew"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </>
    );
}

/* -----------------------------
   Helpers
------------------------------ */

function parseCategoryString(category: string) {
    const parts = category.split("•").map((p) => p.trim());
    if (parts.length < 2) return null;

    let gender: "Male" | "Female";
    if (/Men/i.test(parts[0])) gender = "Male";
    else if (/Women/i.test(parts[0])) gender = "Female";
    else gender = "Male";

    return {
        gender,
        ageGroup: parts[1],      // second part is age group
        boatClass: parts[2] ?? "",
    };
}

function isAgeAllowed(age: number, ageGroupStr: string): boolean {
    const ranges: Record<string, [number, number]> = {
        "Junior 14": [14, 14],
        "Junior 15": [15, 15],
        "Junior 16": [16, 16],
        "U19": [17, 18],
        "U21": [19, 20],
        "U23": [21, 22],
        "Masters A": [27, 35],
        "Masters B": [36, 42],
        "Masters C": [43, 49],
        "Masters D": [50, 54],
        "Masters E": [55, 59],
        "Masters F": [60, 150],
        "Open": [0, 150],
    };

    const range = ranges[ageGroupStr];
    if (!range) {
        console.warn(`Unknown age group "${ageGroupStr}", allowing by default.`);
        return true;
    }

    const [minAge, maxAge] = range;
    return age >= minAge && age <= maxAge;
}

function isGenderAllowed(rowerGender: string, categoryGender: string) {
    if (!rowerGender) return false;
    if (!categoryGender) return true;
    return rowerGender.toLowerCase() === categoryGender.toLowerCase();
}

function getAgeOnDate(dob: string, eventDate: string) {
    const birth = new Date(dob);
    const event = new Date(eventDate);
    let age = event.getFullYear() - birth.getFullYear();
    const m = event.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && event.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}
