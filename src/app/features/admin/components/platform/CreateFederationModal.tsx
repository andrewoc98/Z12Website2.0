import { useState } from "react";
import { createFederation } from "../../services/federationService";
import "../../styles/platformAdmin.css";

type Props = {
    onClose:   () => void;
    onCreated: (federationId: string) => void;
};

function friendlyError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("already-exists") || m.includes("slug"))
        return "A federation with that name already exists. Choose a different name.";
    if (m.includes("invalid-argument")) return msg;
    return "Something went wrong. Please try again.";
}

export default function CreateFederationModal({ onClose, onCreated }: Props) {
    const [name,         setName]         = useState("");
    const [country,      setCountry]      = useState("");
    const [contactEmail, setContactEmail] = useState("");
    const [shortName,    setShortName]    = useState("");
    const [busy,         setBusy]         = useState(false);
    const [error,        setError]        = useState<string | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (busy) return;

        setBusy(true);
        setError(null);

        try {
            const { federationId } = await createFederation({
                name:         name.trim(),
                country:      country.trim().toUpperCase(),
                contactEmail: contactEmail.trim(),
                shortName:    shortName.trim() || undefined,
            });
            onCreated(federationId);
        } catch (err: any) {
            setError(friendlyError(err?.message ?? ""));
            setBusy(false);
        }
    }

    return (
        <div className="pa-overlay" onClick={onClose}>
            <div className="pa-modal" onClick={e => e.stopPropagation()}>

                <div className="pa-modal__header">
                    <h3 className="pa-modal__title">Create Federation</h3>
                    <button className="pa-modal__close" onClick={onClose} aria-label="Close">✕</button>
                </div>

                <form className="pa-modal__body" onSubmit={onSubmit}>

                    <label>
                        Federation name *
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Rowing Ireland"
                            required
                            autoFocus
                        />
                    </label>

                    <label>
                        Short name
                        <input
                            value={shortName}
                            onChange={e => setShortName(e.target.value)}
                            placeholder="e.g. RI"
                            maxLength={10}
                        />
                    </label>

                    <label>
                        Country (ISO code) *
                        <input
                            value={country}
                            onChange={e => setCountry(e.target.value)}
                            placeholder="IE"
                            maxLength={2}
                            required
                            style={{ textTransform: "uppercase" }}
                        />
                    </label>

                    <label>
                        Contact email *
                        <input
                            type="email"
                            value={contactEmail}
                            onChange={e => setContactEmail(e.target.value)}
                            placeholder="info@federation.org"
                            required
                        />
                    </label>

                    {error && <div className="pa-error">{error}</div>}

                </form>

                <div className="pa-modal__footer">
                    <button className="pa-btn pa-btn--ghost" onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button className="pa-btn pa-btn--primary" onClick={onSubmit as any} disabled={busy}>
                        {busy ? "Creating…" : "Create federation"}
                    </button>
                </div>

            </div>
        </div>
    );
}
