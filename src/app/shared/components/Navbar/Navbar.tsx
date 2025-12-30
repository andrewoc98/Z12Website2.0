import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useAuth } from "../../../providers/AuthProvider.tsx";
import { useRoles } from "../../../providers/RoleProvider.tsx";
import "./Navbar.css";

type NavItem = { to: string; label: string };

export default function Navbar() {
    const [open, setOpen] = useState(false);
    const { user, loading: authLoading } = useAuth();
    const { loading: rolesLoading, hasRole } = useRoles();

    const items = useMemo(() => {
        const base: NavItem[] = [
            { to: "/", label: "Home" },
            { to: "/leaderboard", label: "Leaderboard" },
        ];

        if (!user) {
            base.push({ to: "/signin", label: "Sign In" });
            base.push({ to: "/register", label: "Register" });
            return base;
        }

        // If signed in
        if (!rolesLoading) {
            if (hasRole("rower")) base.push({ to: "/rower/signup", label: "Event Sign-Up" });
            if (hasRole("host")) base.push({ to: "/host/events/new", label: "Create Event" });
            if (hasRole("admin")) base.push({ to: "/admin/timing", label: "Timing" });
        }

        return base;
    }, [user, rolesLoading, hasRole]);

    async function onSignOut() {
        await signOut(auth);
        setOpen(false);
    }

    return (
        <header className="nav">
            <div className="nav__inner">
                <Link className="nav__brand" to="/" onClick={() => setOpen(false)}>
                    Z12
                </Link>

                <button
                    className="nav__burger"
                    onClick={() => setOpen(!open)}
                    aria-label="Menu"
                    disabled={authLoading}
                >
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
