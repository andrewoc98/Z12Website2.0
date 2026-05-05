import type {BoatTimingDoc} from "../types.ts";
import {useLongPress} from "../useLongPress.ts";
import "../styles/TimingPage.css"

export function StartBoatItem({
                      boat,
                      onLongPress,
                      onStart,
                  }: {
    boat: BoatTimingDoc;
    onLongPress: (boat: BoatTimingDoc) => void;
    onStart: (boatId: string) => void;
}) {
    const longPress = useLongPress({
        onLongPress: () => onLongPress(boat),
    });

    return (
        <div className="boat-item" {...longPress}>
            <span>
                {boat.bowNumber}# {boat.clubName}
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