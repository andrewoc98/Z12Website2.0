import { useEffect, useRef, useState } from "react";
import "../styles/HomePage.css";


const sponsors = [
    "Sponsor Alpha",
    "Sponsor Beta",
    "Sponsor Gamma",
    "Sponsor Delta",
    "Sponsor Omega",
];

export default function SponsorsCarousel() {

    const trackRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);

    // duplicate items
    const looped = [...sponsors, ...sponsors];

    useEffect(() => {
        if (!trackRef.current) return;

        const fullWidth = trackRef.current.scrollWidth / 2;
        setWidth(fullWidth);
    }, []);

    return (
        <section className="sponsor-section">

            <h2>Sponsors</h2>

            <div className="sponsor-carousel-wrapper">

                <div
                    ref={trackRef}
                    className="sponsor-track"
                    style={{
                        "--scroll-distance": `${width}px`
                    } as React.CSSProperties}
                >

                    {looped.map((s, i) => (
                        <div key={i} className="sponsor-card">
                            {s}
                        </div>
                    ))}

                </div>

            </div>

        </section>
    );
}