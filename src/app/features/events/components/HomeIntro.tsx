import "../styles/HomePage.css";

export default function HomeIntro() {
    return (
        <section className="home-hero">
            <h1>Z12 Rowing</h1>

            <p>
                Discover events, manage races, and streamline timing with a modern
                rowing platform built for athletes and organizers.
            </p>

            <div className="hero-buttons">
                <button className="btn-primary">Explore</button>
                <button className="btn-secondary">Learn More</button>
            </div>
        </section>
    );
}
