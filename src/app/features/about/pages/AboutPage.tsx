import Navbar from "../../../shared/components/Navbar/Navbar";
import Footer from "../../../shared/components/Footer/Footer.tsx";
import "../styles/AboutPage.css";

export default function AboutPage() {
    return (
        <div className="z12-page-container">
            <Navbar />

            <main className="z12-page-content">
                {/* Page Heading */}
                <section className="z12-intro">
                    <h1>WHAT IS THE Z12 CHALLENGE?</h1>
                    <p>
                        The Z12 Challenge provides a structured competition pathway for developing rowers, offering meaningful race experiences that build confidence, resilience, and performance. Through a series of timed outdoor events, athletes gain:
                    </p>
                    <ul>
                        <li>Consistent racing opportunities</li>
                        <li>Clear benchmarks for progression</li>
                        <li>Transparent ranking and advancement</li>
                        <li>A supportive high-performance framework</li>
                    </ul>
                    <p>
                        Whether stepping into competition for the first time or striving toward elite performance, athletes are challenged, supported, and inspired at every stage.
                    </p>
                </section>

                {/* Our Story */}
                <section className="z12-section">
                    <h2>OUR STORY</h2>
                    <p>
                        The Z12 Challenge was created to build a <strong>clear, sustainable pathway</strong> for young athletes aiming to reach High Performance Rowing. We believe great athletes are developed through <strong>structured competition, purposeful training, and strong support systems</strong>. Our league provides a competitive yet inclusive environment where rowers gain experience, build confidence, and prepare for elite performance.
                    </p>
                    <p>
                        More than just a racing series, Z12 is about <strong>community</strong> — connecting athletes with coaches, mentors, families, and peers to foster growth, resilience, and shared ambition. By welcoming masters and club rowers, we strengthen support for our National Team and unite generations within the sport, building a culture of mentorship, collaboration, and collective progress.
                    </p>
                </section>

                {/* Our Goals */}
                <section className="z12-section">
                    <h2>OUR GOALS</h2>
                    <p>
                        Our goal is to create a supportive, high-performance environment where young athletes can develop their skills, character, and confidence while reaching their full potential—whether at the international, collegiate, or club level.
                    </p>
                    <p>
                        We foster a culture that combines ambition with enjoyment, providing quality coaching, purposeful training, and meaningful competition to prepare athletes for the next stage of their journey. Above all, we aim to build strong friendships and a sense of community, developing not only successful rowers but well-rounded individuals who thrive both on and off the water.
                    </p>
                </section>

                {/* Our Impact */}
                <section className="z12-section">
                    <h2>OUR IMPACT</h2>
                    <p>
                        Funds raised through this event support the growth of our regional development centers, giving young athletes access to quality facilities, structured training, and consistent support. They also strengthen our High-Performance coaching structure through a dedicated coach mentorship program, ensuring athletes are guided by skilled and aligned coaches.
                    </p>
                    <p>
                        In addition, funding supports specialized training camps that provide focused development and high-level exposure. Together, these initiatives create a clear pathway that helps young athletes progress toward High Performance Rowing with confidence.
                    </p>
                </section>
            </main>

            <Footer />
        </div>
    );
}
