import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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

const linkCls = "text-text no-underline text-[14px] font-bold tracking-[1px] uppercase transition-[color] hover:text-brand-warm max-md:py-2 max-md:min-h-[44px] max-md:flex max-md:items-center max-md:w-full";

const panelLinkCls = "px-[14px] py-[9px] rounded-[8px] whitespace-nowrap text-text text-[13px] font-semibold tracking-[0.5px] uppercase no-underline transition-[color,background] hover:text-brand-warm hover:bg-surface max-md:min-h-[44px] max-md:flex max-md:items-center max-md:rounded-[6px]";

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
        <header className="sticky top-0 z-[100] bg-bg border-b border-border">
            <div className="w-full px-8 py-4 flex items-center justify-between max-md:px-4 max-md:py-3">
                <Link to="/" className="flex items-center">
                    <img src={logo} alt="Z12 Challenge" className="h-[85px]" />
                </Link>

                <button
                    data-nav-burger
                    className="hidden max-md:flex max-md:items-center max-md:justify-center text-[22px] bg-transparent border-none text-text cursor-pointer p-2 rounded-[6px] min-h-[unset] transition-[background] hover:bg-surface-2 hover:shadow-none"
                    onClick={() => setOpen(o => !o)}
                    aria-label="Menu"
                >
                    ☰
                </button>

                <nav
                    ref={navRef}
                    className={`flex items-center gap-7 max-md:absolute max-md:top-[70px] max-md:right-5 max-md:flex-col max-md:items-start max-md:bg-surface-2 max-md:p-4 max-md:rounded-[12px] max-md:border max-md:border-border max-md:min-w-[200px] max-md:max-h-[calc(100dvh-90px)] max-md:overflow-y-auto max-md:z-[200] ${open ? "max-md:flex" : "max-md:hidden"}`}
                >
                    {user && (
                        <Link to="/profile" className={linkCls} onClick={close}>
                            Profile
                        </Link>
                    )}

                    {navEntries.map(entry => {
                        if (entry.type === "link") {
                            return (
                                <Link key={entry.to} to={entry.to} className={linkCls} onClick={close}>
                                    {entry.label}
                                </Link>
                            );
                        }
                        const isOpen = openGroup === entry.label;
                        return (
                            <div
                                key={entry.label}
                                className="relative max-md:w-full"
                            >
                                <button
                                    data-nav-group={entry.label}
                                    className={`bg-transparent border-none text-[14px] font-bold tracking-[1px] uppercase cursor-pointer p-0 min-h-[unset] flex items-center gap-[5px] transition-[color] rounded-none hover:text-brand-warm hover:bg-transparent hover:shadow-none max-md:py-2 max-md:min-h-[44px] max-md:w-full max-md:justify-between ${isOpen ? "text-brand-warm" : "text-text"}`}
                                    onClick={() => toggleGroup(entry.label)}
                                    aria-expanded={isOpen}
                                >
                                    {entry.label}
                                    <span className={`text-[10px] inline-block leading-none transition-[transform] duration-200 ${isOpen ? "rotate-180" : ""}`}>▾</span>
                                </button>
                                <div className={`${isOpen ? "flex" : "hidden"} flex-col gap-[2px] md:absolute md:top-[calc(100%+14px)] md:left-1/2 md:-translate-x-1/2 md:min-w-[160px] md:bg-surface-2 md:border md:border-border md:rounded-[12px] md:shadow-DEFAULT md:p-[6px] md:z-[200] max-md:static max-md:[transform:none] max-md:bg-transparent max-md:border-l-2 max-md:border-border max-md:rounded-none max-md:shadow-none max-md:pl-3 max-md:py-1 max-md:w-full max-md:mt-1 max-md:mb-1`}>
                                    {entry.items.map(sub => (
                                        <Link key={sub.to} to={sub.to} className={panelLinkCls} onClick={close}>
                                            {sub.label}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {user ? (
                        <button
                            className="bg-transparent border-none text-muted font-bold cursor-pointer uppercase transition-[color] p-0 min-h-[unset] text-[14px] tracking-[1px] hover:text-brand-warm hover:bg-transparent hover:shadow-none"
                            onClick={onSignOut}
                        >Logout</button>
                    ) : (
                        <Link to="/auth" className={linkCls} onClick={close}>Login</Link>
                    )}
                </nav>
            </div>
        </header>
    );
}
