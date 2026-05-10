import type {BoatTimingDoc} from "../types.ts";
import {useLongPress} from "../useLongPress.ts";
import "../styles/TimingPage.css"
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
            <span>
                {boat.bowNumber}# {boat.clubName} {formatRowerNames(boat.rowerUids, profiles, boat.boatSize)}
            </span>

            <button
                className="btn-primary"
                onClick={() => onStart(boat.id)}
            >
                Start
            </button>
        </div>
    );
}