import Navbar from "../../../shared/components/Navbar/Navbar";
import { useParams } from "react-router-dom";

export default function EventResultsPage() {
    const { eventId } = useParams<{ eventId: string }>();
    return (
        <>
            <Navbar />
            <main>
                <h1>Results</h1>
                <p className="muted">Coming soon. Event: {eventId}</p>
            </main>
        </>
    );
}
