import type {BoatTimingDoc} from "../types.ts";
import {useLongPress} from "../useLongPress.ts";
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
        <div className="boat-item boat-item--running" {...longPress}>
            <div className="boat-item__body">
                <span className="boat-item__name">
                    {boat.bowNumber}# {boat.clubName} {formatRowerNames(boat.rowerUids, profiles, boat.boatSize)}
                </span>
                <span className="boat-item__elapsed">
                    {boat.startedAt ? formatElapsedTime(getLiveElapsed(boat.startedAt)) : "00:00.00"}
                </span>
            </div>
            <button className="boat-item__stop-btn" onClick={() => onStop(boat.id)}>
                Stop
            </button>
        </div>
    );
}