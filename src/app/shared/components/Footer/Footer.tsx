import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Footer.css";
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
            setModalConfig({
                title: "Rower Access Required",
                message: "Please sign in as a rower to enter a race.",
            });
            return;
        }

        navigate("/events");
    };

    const handleHostRace = () => {
        if (loading) return;

        if (!hasRole("host")) {
            setModalConfig({
                title: "Host Access Required",
                message: "Please sign in as a host to create an event.",
            });
            return;
        }

        navigate("/host/events/new");
    };

    return (
        <footer className="footer">
            <div className="footer-inner">

                {/* Logo */}
                <div className="footer-logo">
                    <img src={logo} alt="Z12" />
                </div>

                {/* Buttons */}
                <div className="footer-actions">
                    <button
                        className="footer-btn primary"
                        onClick={handleEnterRace}
                        disabled={loading}
                    >
                        ENTER A RACE
                    </button>

                    <button
                        className="footer-btn secondary"
                        onClick={handleHostRace}
                        disabled={loading}
                    >
                        HOST A RACE
                    </button>
                </div>

                {/* Links */}
                <div className="footer-links">
                    <a href="/terms">TERMS AND CONDITIONS</a>
                    <a href="/privacy">PRIVACY SETTINGS</a>
                    <a href="#">MANAGE COOKIES</a>
                </div>
            </div>

            {/* Modal */}
            {modalConfig && (
                <Modal
                    title={modalConfig.title}
                    message={modalConfig.message}
                    onClose={() => setModalConfig(null)}
                    actions={[
                        {
                            label: "Close",
                            onClick: () => setModalConfig(null),
                        },
                        {
                            label: "Go to Sign In",
                            variant: "primary",
                            onClick: () => {
                                setModalConfig(null);
                                navigate("/auth");
                            },
                        },
                    ]}
                />
            )}
        </footer>
    );
};

export default Footer;