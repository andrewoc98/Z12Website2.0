import { useState, useRef, useEffect } from "react";
import "./InfoTooltip.css";

interface InfoTooltipProps {
    text: string;
    position?: "top" | "bottom" | "left" | "right";
}

export default function InfoTooltip({ text, position = "top" }: InfoTooltipProps) {
    const [visible, setVisible] = useState(false);
    const [coords, setCoords] = useState({ x: 0, y: 0 });
    const iconRef = useRef<HTMLButtonElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (visible && iconRef.current && tooltipRef.current) {
            const iconRect = iconRef.current.getBoundingClientRect();
            const tooltipRect = tooltipRef.current.getBoundingClientRect();

            let x = 0;
            let y = 0;

            switch (position) {
                case "top":
                    x = iconRect.left + iconRect.width / 2 - tooltipRect.width / 2;
                    y = iconRect.top - tooltipRect.height - 10;
                    break;
                case "bottom":
                    x = iconRect.left + iconRect.width / 2 - tooltipRect.width / 2;
                    y = iconRect.bottom + 10;
                    break;
                case "left":
                    x = iconRect.left - tooltipRect.width - 10;
                    y = iconRect.top + iconRect.height / 2 - tooltipRect.height / 2;
                    break;
                case "right":
                    x = iconRect.right + 10;
                    y = iconRect.top + iconRect.height / 2 - tooltipRect.height / 2;
                    break;
            }

            // Keep within viewport
            x = Math.max(8, Math.min(x, window.innerWidth - tooltipRect.width - 8));
            y = Math.max(8, Math.min(y, window.innerHeight - tooltipRect.height - 8));

            setCoords({ x, y });
        }
    }, [visible, position]);

    return (
        <>
            <button
                ref={iconRef}
                className={`info-tooltip-icon${visible ? " is-visible" : ""}`}
                onMouseEnter={() => setVisible(true)}
                onMouseLeave={() => setVisible(false)}
                onFocus={() => setVisible(true)}
                onBlur={() => setVisible(false)}
                aria-label={`Info: ${text}`}
            >
                i
            </button>

            <div
                ref={tooltipRef}
                role="tooltip"
                data-position={position}
                className={`info-tooltip-bubble${visible ? " is-visible" : ""}`}
                style={{ top: coords.y, left: coords.x }}
            >
                {text}
                <span className="info-tooltip-tail" />
            </div>
        </>
    );
}