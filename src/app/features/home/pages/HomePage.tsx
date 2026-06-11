import Navbar from "../../../shared/components/Navbar/Navbar";
import Footer from "../../../shared/components/Footer/Footer.tsx";
import picture from "../../../../assets/mensbaselayerheader_BW.jpg";

export default function HomePage() {

    return (
        <div className="page-container">
            <Navbar />
            <main className="page-content w-full">
                <div className="relative w-full h-[70vh] overflow-hidden after:content-[''] after:absolute after:inset-0 after:bg-gradient-to-b after:from-transparent after:to-black/60 after:pointer-events-none">
                    <img src={picture} alt="Rowing" className="w-full h-full object-cover block" />
                </div>
                <div className="relative text-center text-brand-warm font-black -mt-[0.6em] px-4 z-[2]">
                    <h1 className="text-[clamp(36px,6vw,100px)] m-0 leading-[1.1]">READY FOR THE CHALLENGE?</h1>
                </div>
                <section className="max-w-[900px] mx-auto mt-[40px] mb-[80px] px-6 text-[20px] leading-relaxed [&_p]:mb-6 [&_p]:text-text">
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