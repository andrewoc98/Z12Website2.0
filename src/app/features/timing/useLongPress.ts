import { useRef } from "react";

type LongPressOptions = {
    onLongPress: () => void;
    delay?: number;
};

export function useLongPress({ onLongPress, delay = 500 }: LongPressOptions) {
    const timeout = useRef<number | null>(null);

    const start = () => {
        timeout.current = window.setTimeout(() => {
            onLongPress();
        }, delay);
    };

    const clear = () => {
        if (timeout.current) {
            clearTimeout(timeout.current);
            timeout.current = null;
        }
    };

    return {
        onMouseDown: start,
        onMouseUp: clear,
        onMouseLeave: clear,
        onTouchStart: start,
        onTouchEnd: clear,
    };
}