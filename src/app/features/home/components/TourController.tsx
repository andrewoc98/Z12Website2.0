import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { driver } from "driver.js";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import { useAuth } from "../../../providers/AuthProvider";
import { getStepsForProfile, type TourStep } from "./tourSteps";
import "driver.js/dist/driver.css";
import "../styles/tour.css";

// Waits for a CSS selector to appear in the DOM before resolving.
// Falls back after `timeout` ms so a missing element never stalls the tour.
function waitForElement(selector: string, timeout = 2000): Promise<void> {
    return new Promise((resolve) => {
        if (document.querySelector(selector)) return resolve();
        const observer = new MutationObserver(() => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
            observer.disconnect();
            resolve();
        }, timeout);
    });
}

export default function TourController() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const driverRef = useRef<ReturnType<typeof driver> | null>(null);
    const pendingMoveRef = useRef<"next" | "prev" | null>(null);
    const stepsRef = useRef<TourStep[]>([]);

    async function markSeen() {
        if (!user) return;
        try {
            await updateDoc(doc(db, "users", user.uid), { hasSeenTour: true });
        } catch {
            // Non-critical — the overlay is already gone
        }
    }

    // After navigating to a new page, resume the driver once the target element
    // appears in the DOM (or after a timeout if the element never appears).
    useEffect(() => {
        if (!pendingMoveRef.current || !driverRef.current?.isActive()) return;

        const direction = pendingMoveRef.current;
        pendingMoveRef.current = null;

        const ci = driverRef.current.getActiveIndex() ?? 0;
        const targetIndex = direction === "next" ? ci + 1 : ci - 1;
        const targetStep = stepsRef.current[targetIndex];

        const proceed = () => {
            if (direction === "next") driverRef.current?.moveNext();
            else driverRef.current?.movePrevious();
        };

        if (targetStep?.element && typeof targetStep.element === "string") {
            waitForElement(targetStep.element).then(proceed);
        } else {
            // No element — give the page one frame to settle before showing
            // a centred popover so it doesn't flash over the previous page.
            requestAnimationFrame(() => requestAnimationFrame(proceed));
        }
    }, [pathname]);

    useEffect(() => {
        if (!user || !profile || profile.hasSeenTour) return;

        const steps = getStepsForProfile(profile.roles);
        stepsRef.current = steps;

        // Strip the `route` field before passing to Driver.js
        const driveSteps = steps.map(({ route: _r, ...step }) => step);

        let d: ReturnType<typeof driver>;

        d = driver({
            animate: true,
            overlayOpacity: 0.65,
            smoothScroll: true,
            allowClose: true,
            showProgress: true,
            progressText: "{{current}} of {{total}}",
            nextBtnText: "Next",
            prevBtnText: "Back",
            doneBtnText: "Done",
            steps: driveSteps,

            onNextClick: () => {
                const ci = d.getActiveIndex() ?? 0;
                const next = stepsRef.current[ci + 1];
                if (next?.route && next.route !== window.location.pathname) {
                    pendingMoveRef.current = "next";
                    navigate(next.route);
                } else {
                    d.moveNext();
                }
            },

            onPrevClick: () => {
                const ci = d.getActiveIndex() ?? 0;
                const prev = stepsRef.current[ci - 1];
                if (prev?.route && prev.route !== window.location.pathname) {
                    pendingMoveRef.current = "prev";
                    navigate(prev.route);
                } else {
                    d.movePrevious();
                }
            },

            // Fires when the tour ends for any reason (Done, X, ESC, backdrop click)
            onDestroyed: () => {
                markSeen();
            },
        });

        driverRef.current = d;

        // Short delay so the page has rendered before the first highlight
        const t = setTimeout(() => d.drive(), 300);

        return () => {
            clearTimeout(t);
            if (driverRef.current?.isActive()) driverRef.current.destroy();
        };
    }, [user?.uid, profile?.hasSeenTour]);

    return null;
}
