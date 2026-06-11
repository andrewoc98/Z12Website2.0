import type {BoatTimingDoc} from "../types.ts";
import {useLongPress} from "../useLongPress.ts";
import {formatRowerNames} from "../lib/utils.ts";

export function StartBoatItem({
                      boat,
                      onLongPress,
                      onStart,
                      profiles
                  }: {
    boat: BoatTimingDoc;
    onLongPress: (boat: BoatTimingDoc) => void;
    onStart: (boatId: string) => void;
    profiles: Record<string, any>;
}) {
    const longPress = useLongPress({
        onLongPress: () => onLongPress(boat),
    });

    return (
        <div className="boat-item" {...longPress}>
            <span className="boat-item__info">
                {boat.bowNumber}# {boat.clubName} {formatRowerNames(boat.rowerUids, profiles, boat.boatSize)}
            </span>
            <button className="boat-item__start-btn" onClick={() => onStart(boat.id)}>
                Start
            </button>
        </div>
    );
}