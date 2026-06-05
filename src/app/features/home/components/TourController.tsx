import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { driver } from "driver.js";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../shared/lib/firebase";
import { useAuth } from "../../../providers/AuthProvider";
import { useTourMock } from "../../../providers/TourMockContext";
import { getStepsForProfile, type TourStep } from "./tourSteps";
import { NAV_CONFIG } from "../../../shared/components/Navbar/navConfig";
import "driver.js/dist/driver.css";
import "../styles/tour.css";

// All hrefs that live inside .nav__links (top-level and dropdown items)
const NAV_HREFS = new Set(["/profile", ...NAV_CONFIG.map(i => i.to)]);

// Extracts the href value from a selector like a[href="/foo"]
function hrefFromSelector(selector: string): string | null {
    const m = selector.match(/a\[href="([^"]+)"\]/);
    return m ? m[1] : null;
}

// Returns the nav group label (e.g. "Coach") for a grouped href, or null
function navGroupForHref(href: string): string | null {
    return NAV_CONFIG.find(i => i.to === href)?.group ?? null;
}

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

// Waits until an element has layout dimensions (i.e. is actually visible, not display:none).
function waitForElementVisible(selector: string, timeout = 1500): Promise<void> {
    return new Promise(resolve => {
        const visible = () => {
            const el = document.querySelector(selector) as HTMLElement | null;
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 || r.height > 0;
        };
        if (visible()) return resolve();
        const obs = new MutationObserver(() => {
            if (visible()) { obs.disconnect(); resolve(); }
        });
        obs.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class", "style"],
        });
        setTimeout(() => { obs.disconnect(); resolve(); }, timeout);
    });
}

// Before each driver.js step advance:
//  - Closes any dropdown group that isn't needed for this step
//  - On mobile: opens/closes the hamburger menu as needed
//  - Opens the correct dropdown group for nav links that live inside one
//  - Waits until the target element is actually visible
async function prepareNavForStep(step: TourStep | undefined): Promise<void> {
    const selector = step ? (typeof step.element === "string" ? step.element : null) : null;
    const href     = selector ? hrefFromSelector(selector) : null;
    const isNav    = href !== null && NAV_HREFS.has(href);
    const group    = isNav && href ? navGroupForHref(href) : null;

    // Close any open dropdown that isn't the one we need for this step
    const openGroupTrigger = document.querySelector(
        ".nav__group.is-open .nav__group-trigger"
    ) as HTMLButtonElement | null;
    if (openGroupTrigger && openGroupTrigger.getAttribute("data-nav-group") !== group) {
        openGroupTrigger.click();
        await new Promise<void>(r => requestAnimationFrame(r));
    }

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const navLinks = document.querySelector(".nav__links");
    const menuOpen = !!navLinks?.classList.contains("is-open");
    const burger   = document.querySelector("[data-nav-burger]") as HTMLButtonElement | null;

    if (isMobile) {
        if (!isNav && menuOpen) {
            // Close the mobile menu — this step doesn't need the nav open
            burger?.click();
            await new Promise<void>(r => requestAnimationFrame(r));
        } else if (isNav && !menuOpen) {
            // Open the mobile menu so the nav link is reachable
            burger?.click();
            await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        }
    }

    if (!isNav || !selector) return;

    // Open the dropdown group if the link lives inside one
    if (group) {
        const trigger = document.querySelector(`[data-nav-group="${group}"]`) as HTMLButtonElement | null;
        const panel   = trigger?.closest(".nav__group");
        if (panel && !panel.classList.contains("is-open")) {
            trigger?.click();
        }
    }

    // Wait for the target element to actually have layout (visible)
    await waitForElementVisible(selector);
}

export default function TourController() {
    const { user, profile } = useAuth();
    const { setTourActive } = useTourMock();
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

        const proceed = async () => {
            // Open nav dropdown / mobile menu if this step targets a nav link,
            // and close them if it doesn't.
            await prepareNavForStep(targetStep);
            if (direction === "next") driverRef.current?.moveNext();
            else driverRef.current?.movePrevious();
        };

        if (targetStep?.element && typeof targetStep.element === "string") {
            waitForElement(targetStep.element).then(() => proceed());
        } else {
            // No element — give the page one frame to settle before showing
            // a centred popover so it doesn't flash over the previous page.
            requestAnimationFrame(() => requestAnimationFrame(() => proceed()));
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
            // Scroll the highlighted element to the vertical centre of the viewport
            // so sticky headers/footers don't obscure it. Using "instant" behaviour
            // so driver.js measures the final element position AFTER the scroll —
            // smooth scroll returns before the animation ends, causing the overlay
            // to be positioned at the pre-scroll coordinates and the element drifts
            // out of the highlight box as the page animates.
            // @ts-expect-error driver.js supports this option at runtime but hasn't typed it
            scrollIntoViewOptions: { block: "center", behavior: "instant" },
            allowClose: true,
            showProgress: true,
            progressText: "{{current}} of {{total}}",
            nextBtnText: "Next",
            prevBtnText: "Back",
            doneBtnText: "Done",
            steps: driveSteps,

            onNextClick: () => {
                const ci   = d.getActiveIndex() ?? 0;
                const next = stepsRef.current[ci + 1];
                if (next?.route && next.route !== window.location.pathname) {
                    pendingMoveRef.current = "next";
                    navigate(next.route);
                } else {
                    // No navigation needed — prepare the nav (open/close dropdown)
                    // then advance the tour.
                    prepareNavForStep(next).then(() => d.moveNext());
                }
            },

            onPrevClick: () => {
                const ci   = d.getActiveIndex() ?? 0;
                const prev = stepsRef.current[ci - 1];
                if (prev?.route && prev.route !== window.location.pathname) {
                    pendingMoveRef.current = "prev";
                    navigate(prev.route);
                } else {
                    prepareNavForStep(prev).then(() => d.movePrevious());
                }
            },

            // Fires when the tour ends for any reason (Done, X, ESC, backdrop click)
            onDestroyed: () => {
                setTourActive(false);
                markSeen();
            },
        });

        driverRef.current = d;

        // Short delay so the page has rendered before the first highlight
        const t = setTimeout(() => {
            setTourActive(true);
            d.drive();
        }, 300);

        return () => {
            clearTimeout(t);
            if (driverRef.current?.isActive()) driverRef.current.destroy();
            setTourActive(false);
        };
    }, [user?.uid, profile?.hasSeenTour]);

    return null;
}
