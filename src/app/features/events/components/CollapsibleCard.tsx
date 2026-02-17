import { useState } from "react";

export default function CollapsibleCard({
                                            title,
                                            children,
                                            defaultOpen = true
                                        }: any) {

    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className={`card collapsible ${open ? "open" : "closed"}`}>

            <div
                className="collapsible-header"
                onClick={() => setOpen((prev: boolean) => !prev)}
            >
                <h3>{title}</h3>
                <span className="collapse-icon">
                    {open ? "−" : "+"}
                </span>
            </div>

            {open && (
                <div className="collapsible-body">
                    {children}
                </div>
            )}

        </div>
    );
}