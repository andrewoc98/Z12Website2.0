import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./Navbar.css";

import { DEV_MODE } from "../../lib/config";

// Mock mode hooks
import { useMockAuth } from "../../../providers/MockAuthProvider.tsx";
import { useMockRoles } from "../../../providers/MockRoleProvider";

// Firebase mode hooks
import { useAuth } from "../../../providers/AuthProvider";
import { useRoles } from "../../../providers/RoleProvider";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";

type NavItem = { to: string; label: string };

export default function Navbar() {
    const [open, setOpen] = useState(false);

    // ---- Read auth/roles depending on DEV_MODE ----
    const mockAuth = DEV_MODE ? useMockAuth() : null;
    const mockRoles = DEV_MODE ? useMockRoles() : null;

    const fbAuth = !DEV_MODE ? useAuth() : null;
    const fbRoles = !DEV_MODE ? useRoles() : null;

    const user = DEV_MODE ? mockAuth?.user ?? null : fbAuth?.user ?? null;
    const rolesLoading = DEV_MODE ? false : fbRoles?.loading ?? true;

    const hasRole = (r: "rower" | "host" | "admin") => {
        if (DEV_MODE) return !!mockRoles?.hasRole(r);
        return !!fbRoles?.hasRole(r);
    };

    const items: NavItem[] = useMemo(() => {
        const base: NavItem[] = [
            { to: "/", label: "Home" },
            { to: "/leaderboard", label: "Leaderboard" },
        ];

        // Not signed in → single entry point
        if (!user) {
            base.push({ to: "/auth", label: "Sign in" });
            return base;
        }

        // Signed in
        if (!rolesLoading) {
            if (hasRole("rower")) base.push({ to: "/rower/events", label: "Events" });
            if (hasRole("host")) base.push({ to: "/host/events/new", label: "Create Event" });
            if (hasRole("host")) base.push({ to: "/host/events/manage", label: "Manage Event" });
            if (hasRole("admin")) base.push({ to: "/admin/timing", label: "Timing" });
        }

        return base;
    }, [
        user,
        rolesLoading,
        // include these so the memo updates when roles change
        mockRoles,
        fbRoles,
    ]);

    async function onSignOut() {
        try {
            if (DEV_MODE) {
                mockAuth?.logout();
            } else {
                await signOut(auth);
            }
        } finally {
            setOpen(false);
        }
    }

    return (
        <header className="nav">
            <div className="nav__inner">
                <Link className="nav__brand" to="/" onClick={() => setOpen(false)}>
                    Z12
                </Link>

                <button className="nav__burger" onClick={() => setOpen(!open)} aria-label="Menu">
                    ☰
                </button>

                <nav className={`nav__links ${open ? "is-open" : ""}`}>
                    {items.map((x) => (
                        <Link key={x.to} to={x.to} onClick={() => setOpen(false)}>
                            {x.label}
                        </Link>
                    ))}

                    {user && (
                        <button className="nav__signout" onClick={onSignOut}>
                            Sign Out
                        </button>
                    )}
                </nav>
            </div>
        </header>
    );
}
