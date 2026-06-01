import { useState, useEffect } from "react";
import type { Club } from "../../../auth/club";
import { updateClubInfo } from "../../services/clubAdminService";
import "../../styles/platformAdmin.css";
import "../../styles/clubAdmin.css";

type Props = {
    club:     Club;
    onSaved:  (msg: string) => void;
};

export default function ClubInfoEditor({ club, onSaved }: Props) {
    const [name,          setName]          = useState(club.name         ?? "");
    const [contactEmail,  setContactEmail]  = useState(club.contactEmail ?? "");
    const [websiteUrl,    setWebsiteUrl]    = useState(club.websiteUrl   ?? "");
    const [city,          setCity]          = useState(club.location?.city    ?? "");
    const [country,       setCountry]       = useState(club.location?.country ?? "");
    const [openMembership, setOpenMembership] = useState(club.openMembership ?? false);
    const [busy,          setBusy]          = useState(false);
    const [error,         setError]         = useState<string | null>(null);

    // Sync if the club prop changes (e.g. after a reload)
    useEffect(() => {
        setName(club.name ?? "");
        setContactEmail(club.contactEmail ?? "");
        setWebsiteUrl(club.websiteUrl ?? "");
        setCity(club.location?.city ?? "");
        setCountry(club.location?.country ?? "");
        setOpenMembership(club.openMembership ?? false);
    }, [club.id]); // eslint-disable-line react-hooks/exhaustive-deps

    async function onSave(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) { setError("Club name is required."); return; }

        setBusy(true);
        setError(null);
        try {
            await updateClubInfo(club.id, {
                name:          name.trim(),
                contactEmail:  contactEmail.trim() || undefined,
                websiteUrl:    websiteUrl.trim()   || undefined,
                openMembership,
                location: { city: city.trim() || undefined, country: country.trim() || undefined },
            });
            onSaved("Club info saved.");
        } catch (err: any) {
            setError(err?.message ?? "Failed to save. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <form className="cl-editor" onSubmit={onSave}>

            <label>
                Club name *
                <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Neptune Rowing Club"
                    required
                />
            </label>

            <div className="cl-editor__row">
                <label>
                    City
                    <input
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        placeholder="Cork"
                    />
                </label>
                <label>
                    Country (ISO code)
                    <input
                        value={country}
                        onChange={e => setCountry(e.target.value)}
                        placeholder="IE"
                        maxLength={2}
                        style={{ textTransform: "uppercase" }}
                    />
                </label>
            </div>

            <label>
                Contact email
                <input
                    type="email"
                    value={contactEmail}
                    onChange={e => setContactEmail(e.target.value)}
                    placeholder="info@clubname.ie"
                />
            </label>

            <label>
                Website URL
                <input
                    type="url"
                    value={websiteUrl}
                    onChange={e => setWebsiteUrl(e.target.value)}
                    placeholder="https://www.clubname.ie"
                />
            </label>

            <div className="cl-editor__toggle-row">
                <div>
                    <div className="cl-editor__toggle-label">Open membership</div>
                    <div className="cl-editor__toggle-sub">
                        When enabled, any user can join without approval
                    </div>
                </div>
                <label className="ca-switch" style={{ marginTop: 0 }}>
                    <input
                        type="checkbox"
                        checked={openMembership}
                        onChange={e => setOpenMembership(e.target.checked)}
                    />
                    <span className="ca-switch__track" />
                </label>
            </div>

            {error && <div className="pa-error">{error}</div>}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="pa-btn pa-btn--primary" type="submit" disabled={busy}>
                    {busy ? "Saving…" : "Save changes"}
                </button>
            </div>

        </form>
    );
}
