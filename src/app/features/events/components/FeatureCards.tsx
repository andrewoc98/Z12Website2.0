import "../styles/HomePage.css";

const features = [
    {
        title: "For Rowers",
        desc: "Join and manage races.",
        more: "Full detailed rower content here..."
    },
    {
        title: "For Hosts",
        desc: "Create and manage events.",
        more: "Hosting platform explanation..."
    },
    {
        title: "Timing System",
        desc: "Precision timing tools.",
        more: "Timing system deep explanation..."
    },
];

type Props = {
    onLearnMore: (title: string, content: string) => void;
};

export default function FeatureCards({ onLearnMore }: Props) {

    return (
        <section className="features">

            {features.map((f, i) => (
                <div key={i} className="feature-card">

                    <h3>{f.title}</h3>
                    <p>{f.desc}</p>

                    <button
                        className="btn-primary"
                        onClick={() => onLearnMore(f.title, f.more)}
                    >
                        Learn More
                    </button>

                </div>
            ))}

        </section>
    );
}
