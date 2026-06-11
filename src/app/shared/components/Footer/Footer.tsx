import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../../../assets/Z12Challenge_Gold.png";
import Modal from "../Modal/Modal"
import { useRoles } from "../../../providers/RoleProvider";

const Footer: React.FC = () => {
    const navigate = useNavigate();
    const { hasRole, loading } = useRoles();
    const [modalConfig, setModalConfig] = useState<null | {
        title: string;
        message: string;
    }>(null);

    const handleEnterRace = () => {
        if (loading) return;
        if (!hasRole("rower")) {
            setModalConfig({ title: "Rower Access Required", message: "Please sign in as a rower to enter a race." });
            return;
        }
        navigate("/events");
    };

    const handleHostRace = () => {
        if (loading) return;
        if (!hasRole("host")) {
            setModalConfig({ title: "Host Access Required", message: "Please sign in as a host to create an event." });
            return;
        }
        navigate("/host/events/new");
    };

    return (
        <footer className="w-full bg-bg border-t-2 border-brand-warm px-6 py-4">
            <div className="flex flex-col items-center text-center gap-5 max-md:text-center md:flex-row md:items-center md:justify-between md:text-left max-w-[1400px] mx-auto">

                {/* Logo */}
                <div>
                    <img src={logo} alt="Z12" className="h-[85px]" />
                </div>

                {/* Buttons */}
                <div className="flex flex-col gap-3 items-end flex-1 max-md:items-center max-md:w-full">
                    <button
                        className="px-[18px] py-[10px] rounded-lg border border-transparent font-semibold text-[13px] cursor-pointer transition-[filter] duration-150 hover:brightness-95 bg-brand-warm text-brand-ink max-md:max-w-[250px] max-md:w-full max-md:min-h-[44px]"
                        onClick={handleEnterRace}
                        disabled={loading}
                    >
                        ENTER A RACE
                    </button>

                    <button
                        className="px-[18px] py-[10px] rounded-lg border border-border font-semibold text-[13px] cursor-pointer text-muted bg-transparent transition-[color,border-color] duration-150 hover:text-text hover:border-white/20 max-md:max-w-[250px] max-md:w-full max-md:min-h-[44px]"
                        onClick={handleHostRace}
                        disabled={loading}
                    >
                        HOST A RACE
                    </button>
                </div>

                {/* Links */}
                <div className="flex flex-col text-right max-md:text-center">
                    <a href="/terms"    className="text-[11px] text-muted no-underline my-[2px] transition-colors duration-150 hover:text-text">TERMS AND CONDITIONS</a>
                    <a href="/privacy"  className="text-[11px] text-muted no-underline my-[2px] transition-colors duration-150 hover:text-text">PRIVACY SETTINGS</a>
                    <a href="#"         className="text-[11px] text-muted no-underline my-[2px] transition-colors duration-150 hover:text-text">MANAGE COOKIES</a>
                    {!loading && !hasRole("clubAdmin") && (
                        <a href="/club/request" className="text-[11px] text-muted no-underline my-[2px] transition-colors duration-150 hover:text-text">START A CLUB</a>
                    )}
                </div>
            </div>

            {modalConfig && (
                <Modal
                    title={modalConfig.title}
                    message={modalConfig.message}
                    onClose={() => setModalConfig(null)}
                    actions={[
                        { label: "Close", onClick: () => setModalConfig(null) },
                        { label: "Go to Sign In", variant: "primary", onClick: () => { setModalConfig(null); navigate("/auth"); } },
                    ]}
                />
            )}
        </footer>
    );
};

export default Footer;
