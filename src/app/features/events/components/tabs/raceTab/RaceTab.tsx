import { useState, useMemo } from "react";
import PublishControls from "./PublishControls";
import ActiveRaceList from "./ActiveRaceList";
import ResultsEditor from "./ResultsEditor";
import CollapsibleCard from "../../CollapsibleCard";
import "./race.css";

export default function RaceTab({ event, boats = [] }: any) {

    const [publishMode, setPublishMode] = useState<"Live" | "Category" | "Event">(event?.resultsPublishMode ?? "Live")

    const activeBoats = useMemo(() => {
        return boats.filter((b:any) =>
            b.startedAt && !b.finishedAt && !b.resultStatus
        );
    }, [boats]);

    const finishedBoats = useMemo(() => {
        return boats.filter((b:any) =>
            b.finishedAt || b.resultStatus
        )
            .sort((a:any, b:any) => {
                // Handle missing bowNumber: treat undefined as Infinity so they appear last
                const aBow = a.bowNumber ?? Infinity;
                const bBow = b.bowNumber ?? Infinity;

                return aBow - bBow;
            });
    }, [boats]);

    return (
        <div className="race-container">

            <CollapsibleCard title="Results Publishing" defaultOpen={false}>
                <PublishControls
                    publishMode={publishMode}
                    setPublishMode={setPublishMode}
                    eventId={event?.id}
                />
            </CollapsibleCard>

            <CollapsibleCard title={`Active Crews (${activeBoats.length})`} defaultOpen={false}>
                <ActiveRaceList
                    boats={activeBoats}
                />
            </CollapsibleCard>

            <CollapsibleCard title={`Results Editor (${finishedBoats.length})`} defaultOpen={false}>
                <ResultsEditor boats={finishedBoats} event = {event}/>
            </CollapsibleCard>

        </div>
    );
}