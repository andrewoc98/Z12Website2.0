import Navbar from "../../../shared/components/Navbar/Navbar";
import Footer from "../../../shared/components/Footer/Footer.tsx";

export default function AboutPage() {
    return (
        <div className="flex flex-col min-h-screen bg-bg text-text">
            <Navbar />

            <main className="flex-1 max-w-[1000px] mx-auto px-4 py-[40px] md:px-6 md:py-[80px] leading-[1.7]">
                {/* Page Heading */}
                <section className="[&_ul]:list-disc [&_ul]:pl-8 [&_ul]:mb-4 [&_li]:mb-2">
                    <h1 className="text-[clamp(36px,6vw,80px)] mb-6 text-brand-warm text-left md:text-center">WHAT IS THE Z12 CHALLENGE?</h1>
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
                <section className="mt-[80px]">
                    <h2 className="text-[clamp(28px,5vw,48px)] mb-4 text-brand-warm">OUR STORY</h2>
                    <p className="mb-4 text-[clamp(18px,2vw,20px)]">
                        The Z12 Challenge was created to build a <strong>clear, sustainable pathway</strong> for young athletes aiming to reach High Performance Rowing. We believe great athletes are developed through <strong>structured competition, purposeful training, and strong support systems</strong>. Our league provides a competitive yet inclusive environment where rowers gain experience, build confidence, and prepare for elite performance.
                    </p>
                    <p className="mb-4 text-[clamp(18px,2vw,20px)]">
                        More than just a racing series, Z12 is about <strong>community</strong> — connecting athletes with coaches, mentors, families, and peers to foster growth, resilience, and shared ambition. By welcoming masters and club rowers, we strengthen support for our National Team and unite generations within the sport, building a culture of mentorship, collaboration, and collective progress.
                    </p>
                </section>

                {/* Our Goals */}
                <section className="mt-[80px]">
                    <h2 className="text-[clamp(28px,5vw,48px)] mb-4 text-brand-warm">OUR GOALS</h2>
                    <p className="mb-4 text-[clamp(18px,2vw,20px)]">
                        Our goal is to create a supportive, high-performance environment where young athletes can develop their skills, character, and confidence while reaching their full potential—whether at the international, collegiate, or club level.
                    </p>
                    <p className="mb-4 text-[clamp(18px,2vw,20px)]">
                        We foster a culture that combines ambition with enjoyment, providing quality coaching, purposeful training, and meaningful competition to prepare athletes for the next stage of their journey. Above all, we aim to build strong friendships and a sense of community, developing not only successful rowers but well-rounded individuals who thrive both on and off the water.
                    </p>
                </section>

                {/* Our Impact */}
                <section className="mt-[80px]">
                    <h2 className="text-[clamp(28px,5vw,48px)] mb-4 text-brand-warm">OUR IMPACT</h2>
                    <p className="mb-4 text-[clamp(18px,2vw,20px)]">
                        Funds raised through this event support the growth of our regional development centers, giving young athletes access to quality facilities, structured training, and consistent support. They also strengthen our High-Performance coaching structure through a dedicated coach mentorship program, ensuring athletes are guided by skilled and aligned coaches.
                    </p>
                    <p className="mb-4 text-[clamp(18px,2vw,20px)]">
                        In addition, funding supports specialized training camps that provide focused development and high-level exposure. Together, these initiatives create a clear pathway that helps young athletes progress toward High Performance Rowing with confidence.
                    </p>
                </section>
            </main>

            <Footer />
        </div>
    );
}
