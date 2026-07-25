import { useState, useMemo } from "react";
import PublishControls from "./PublishControls";
import ActiveRaceList from "./ActiveRaceList";
import ResultsEditor from "./ResultsEditor";
import CollapsibleCard from "../../CollapsibleCard";

export default function RaceTab({ event, boats = [] }: any) {

    const [publishMode, setPublishMode] = useState<"Live" | "Category" | "Event">(event?.resultsPublishMode ?? "Live")

    const activeBoats = useMemo(() => {
        return boats.filter((b:any) =>
            b.startedAt && !b.finishedAt && !b.resultStatus
        );
    }, [boats]);

    const editorBoats = useMemo(() => {
        return boats.filter((b: any) => b.status !== "pending_crew");
    }, [boats]);

    return (
        <div className="flex flex-col gap-5 bg-bg text-text">

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

            <CollapsibleCard title={`Results Editor (${editorBoats.length})`} defaultOpen={false}>
                <ResultsEditor boats={editorBoats} event={event}/>
            </CollapsibleCard>

        </div>
    );
}