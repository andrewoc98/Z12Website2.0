import Navbar from "../../../shared/components/Navbar/Navbar";
import Footer from "../../../shared/components/Footer/Footer.tsx";
import "../styles/HomePage.css";
import picture from "../../../../assets/mensbaselayerheader_BW.jpg"
export default function HomePage() {
    return (
        <div className="page-container">
            <Navbar />

            <main className="homepage page-content">

                {/* HERO IMAGE */}
                <div className="hero">
                    <img src={picture} alt="Rowing" />
                    <div className="hero-title">
                        <h1>
                        READY FOR THE CHALLENGE?
                        </h1>
                    </div>
                </div>

                {/* TEXT SECTION */}
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
