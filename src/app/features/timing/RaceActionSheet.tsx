import { createPortal } from "react-dom";

export type BoatAction =
    | "start"
    | "stop"
    | "dns"
    | "dnf"
    | "undo";

interface Props {
    open: boolean;
    onClose: () => void;
    title: string;
    actions: { key: BoatAction; label: string; onClick: () => void }[];
}

export default function RaceActionSheet({ open, onClose, title, actions }: Props) {
    if (!open) return null;

    return createPortal(
        <div className="sheet-overlay" onClick={onClose}>
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
                <div className="sheet-title">{title}</div>

                {actions.map(a => (
                    <button
                        key={a.key}
                        className="sheet-action"
                        onClick={() => {
                            a.onClick();
                            onClose();
                        }}
                    >
                        {a.label}
                    </button>
                ))}

                <button className="sheet-cancel" onClick={onClose}>
                    Cancel
                </button>
            </div>
        </div>,
        document.body
    );
}