import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./Navbar.css";
import logo from "../../../../assets/Z12Challenge_Gold.png";
import { DEV_MODE } from "../../lib/config";
import { useMockAuth } from "../../../providers/MockAuthProvider.tsx";
import { useMockRoles } from "../../../providers/MockRoleProvider";
import { useAuth } from "../../../providers/AuthProvider";
import { useRoles } from "../../../providers/RoleProvider";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { NAV_CONFIG, type CheckableRole } from "./navConfig";

type FlatLink  = { type: "link";  to: string; label: string };
type GroupLink = { type: "group"; label: string; items: { to: string; label: string }[] };
type NavEntry  = FlatLink | GroupLink;

export default function Navbar() {
    const [open, setOpen]           = useState(false);
    const [openGroup, setOpenGroup] = useState<string | null>(null);
    const navRef                    = useRef<HTMLElement>(null);

    const mockAuth  = DEV_MODE ? useMockAuth() : null;
    const mockRoles = DEV_MODE ? useMockRoles() : null;
    const fbAuth    = !DEV_MODE ? useAuth() : null;
    const fbRoles   = !DEV_MODE ? useRoles() : null;

    const user         = DEV_MODE ? mockAuth?.user ?? null : fbAuth?.user ?? null;
    const rolesLoading = DEV_MODE ? false : fbRoles?.loading ?? true;

    const hasRole = (r: CheckableRole): boolean => {
        if (DEV_MODE) return !!mockRoles?.hasRole(r);
        return !!fbRoles?.hasRole(r);
    };

    useEffect(() => {
        if (!openGroup) return;
        function handler(e: MouseEvent) {
            if (navRef.current && !navRef.current.contains(e.target as Node)) {
                setOpenGroup(null);
            }
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [openGroup]);

    const navEntries = useMemo((): NavEntry[] => {
        const visible = NAV_CONFIG.filter(item => {
            if (item.requireAuth && !user) return false;
            if (!item.roles) return true;
            if (!user || rolesLoading) return false;
            return item.roles.some(r => hasRole(r));
        });

        const result: NavEntry[] = [];
        const seenGroups = new Map<string, { to: string; label: string }[]>();

        for (const item of visible) {
            if (!item.group) {
                result.push({ type: "link", to: item.to, label: item.label });
            } else if (!seenGroups.has(item.group)) {
                const items = [{ to: item.to, label: item.label }];
                seenGroups.set(item.group, items);
                result.push({ type: "group", label: item.group, items });
            } else {
                seenGroups.get(item.group)!.push({ to: item.to, label: item.label });
            }
        }

        return result;
    }, [user, rolesLoading, mockRoles, fbRoles]);

    function close() {
        setOpen(false);
        setOpenGroup(null);
    }

    function toggleGroup(label: string) {
        setOpenGroup(prev => (prev === label ? null : label));
    }

    async function onSignOut() {
        if (DEV_MODE) mockAuth?.logout();
        else await signOut(auth);
        close();
    }

    return (
        <header className="nav">
            <div className="nav__inner">
                <Link to="/" className="nav__brand">
                    <img src={logo} alt="Z12 Challenge" />
                </Link>

                <button
                    className="nav__burger"
                    onClick={() => setOpen(o => !o)}
                    aria-label="Menu"
                >
                    ☰
                </button>

                <nav ref={navRef} className={`nav__links ${open ? "is-open" : ""}`}>
                    {user && (
                        <Link to="/profile" className="nav__profile-link" onClick={close}>
                            Profile
                        </Link>
                    )}

                    {navEntries.map(entry => {
                        if (entry.type === "link") {
                            return (
                                <Link key={entry.to} to={entry.to} onClick={close}>
                                    {entry.label}
                                </Link>
                            );
                        }
                        const isOpen = openGroup === entry.label;
                        return (
                            <div
                                key={entry.label}
                                className={`nav__group${isOpen ? " is-open" : ""}`}
                            >
                                <button
                                    className="nav__group-trigger"
                                    onClick={() => toggleGroup(entry.label)}
                                    aria-expanded={isOpen}
                                >
                                    {entry.label}
                                    <span className="nav__caret">▾</span>
                                </button>
                                <div className="nav__group-panel">
                                    {entry.items.map(sub => (
                                        <Link key={sub.to} to={sub.to} onClick={close}>
                                            {sub.label}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {user ? (
                        <button className="nav__signout" onClick={onSignOut}>Logout</button>
                    ) : (
                        <Link to="/auth" onClick={close}>Login</Link>
                    )}
                </nav>
            </div>
        </header>
    );
}
