import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./Navbar.css";
import logo from "../../../../assets/Z12Challenge_Gold.png"
import { DEV_MODE } from "../../lib/config";

import { useMockAuth } from "../../../providers/MockAuthProvider.tsx";
import { useMockRoles } from "../../../providers/MockRoleProvider";

import { useAuth } from "../../../providers/AuthProvider";
import { useRoles } from "../../../providers/RoleProvider";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";

type NavItem = { to: string; label: string };

export default function Navbar() {
    const [open, setOpen] = useState(false);

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
        const base: NavItem[] = [{ to: "/", label: "Home" }];

        if (!user) {
            base.push({ to: "/auth", label: "Login" });
            return base;
        }

        if (!rolesLoading) {
            base.push({ to: "/about", label: "About" });

            if (hasRole("rower")) base.push({ to: "/rower/events", label: "Races" });
            if (hasRole("host")) {
                base.push({ to: "/host/events", label: "Manage Races" });
                base.push({ to: "/host/events/new", label: "Create Race" });
            }
            base.unshift({ to: "/profile", label: "Profile" });
            // logout option
            base.push({ to: "/auth", label: "Logout" });
        }

        return base;
    }, [user, rolesLoading, mockRoles, fbRoles]);

    async function onSignOut() {
        if (DEV_MODE) mockAuth?.logout();
        else await signOut(auth);
    }

    return (
        <header className="nav">
            <div className="nav__inner">
                <Link to="/" className="nav__brand">
                    <img src={logo} alt="Z12 Challenge" />
                </Link>

                <button
                    className="nav__burger"
                    onClick={() => setOpen(!open)}
                    aria-label="Menu"
                >
                    ☰
                </button>

                <nav className={`nav__links ${open ? "is-open" : ""}`}>
                    {items.map((x) => (
                        <Link
                            key={x.to}
                            to={x.to}
                            onClick={async () => {
                                setOpen(false);
                                if (x.label === "Logout") await onSignOut();
                            }}
                        >
                            {x.label}
                        </Link>
                    ))}
                </nav>
            </div>
        </header>
    );
}
