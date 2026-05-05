import type {BoatTimingDoc} from "../types.ts";
import {useLongPress} from "../useLongPress.ts";
import "../styles/TimingPage.css"
import {formatElapsedTime, formatRowerNames, getLiveElapsed} from "../lib/utils.ts";

export function StopBoatItem({
                      boat,
                      onLongPress,
                      onStop,
                      profiles,

                  }: {
    boat: BoatTimingDoc;
    onLongPress: (boat: BoatTimingDoc) => void;
    onStop: (boatId: string) => void;
    profiles: Record<string, any>;
}) {
    const longPress = useLongPress({
        onLongPress: () => onLongPress(boat),
    });

    return (
        <div className="boat-item" {...longPress}>
            <span>{boat.bowNumber}# {boat.clubName} {formatRowerNames(boat.rowerUids, profiles, boat.boatSize)}</span>
            <span className="timer">
                        {boat.startedAt ? formatElapsedTime(getLiveElapsed(boat.startedAt)) : "00:00.00"}
            </span>
            <button
                className="btn-primary"
                onClick={() => onStop(boat.id)}
            >
                Stop
            </button>
        </div>
    );
}