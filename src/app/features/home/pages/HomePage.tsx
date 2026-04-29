import { useMemo } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar";
import Footer from "../../../shared/components/Footer/Footer.tsx";
import ProfileCompletionModal from "../components/ProfileCompletionModal.tsx";
import { useAuth } from "../../../providers/AuthProvider";
import "../styles/HomePage.css";
import picture from "../../../../assets/mensbaselayerheader_BW.jpg";

export default function HomePage() {
    const { user, profile } = useAuth() as any;
    const p = profile ?? null;

    const missingFields = useMemo(() => {
        if (!user || !p || p.primaryRole !== "rower") return [];
        const missing: string[] = [];
        if (!p.gender) missing.push("gender");
        if (!p.dateOfBirth) missing.push("dateOfBirth");
        if (!(p.roles?.rower?.club ?? "").trim()) missing.push("club");
        return missing;
    }, [user, p]);

    return (
        <div className="page-container">
            <Navbar />

            {missingFields.length > 0 && (
                <ProfileCompletionModal missingFields={missingFields} />
            )}

            <main className="homepage page-content">
                <div className="hero">
                    <img src={picture} alt="Rowing" />
                </div>
                <div className="hero-title">
                    <h1>READY FOR THE CHALLENGE?</h1>
                </div>
                <section className="challenge-text">
                    <p>
                        The Z12 Challenge is a season-long rowing league built around a
                        structured series of outdoor time trial events held throughout
                        the fall.
                    </p>
                    <p>
                        Designed for ambitious athletes, it delivers consistent racing
                        opportunities, clear performance benchmarks, and a transparent
                        pathway toward high-performance rowing — all within a supportive
                        and motivating environment.
                    </p>
                </section>
            </main>

            <Footer />
        </div>
    );
}