import { useState } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar";

import HomeIntro from "../components/HomeIntro";
import FeatureCards from "../components/FeatureCards";
import SponsorsCarousel from "../components/SponsorsCarousel";
import GlobalModal from "../components/GlobalModal";

export default function HomePage() {

    const [modal, setModal] = useState<{
        title?: string;
        content?: string;
    } | null>(null);

    return (
        <>
            <Navbar />

            <main className="homepage">

                <HomeIntro />

                <FeatureCards
                    onLearnMore={(title, content) =>
                        setModal({ title, content })
                    }
                />

                <SponsorsCarousel />

            </main>

            <GlobalModal
                open={!!modal}
                title={modal?.title}
                onClose={() => setModal(null)}
            >
                <p>{modal?.content}</p>
            </GlobalModal>
        </>
    );
}
