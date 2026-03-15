import React from "react";
import "./Footer.css";
import logo from "../../../../assets/Z12Challenge_Gold.png"

const Footer: React.FC = () => {
    return (
        <footer className="footer">
            <div className="footer-inner">

                {/* Logo */}
                <div className="footer-logo">
                    <img src={logo} alt="Z12" />
                </div>

                {/* Buttons */}
                <div className="footer-actions">
                    <button className="footer-btn primary">ENTER A RACE</button>
                    <button className="footer-btn secondary">HOST A RACE</button>
                </div>

                {/* Links */}
                <div className="footer-links">
                    <a href="#">TERMS AND CONDITIONS</a>
                    <a href="#">PRIVACY SETTINGS</a>
                    <a href="#">MANAGE COOKIES</a>
                </div>

            </div>
        </footer>
    );
};

export default Footer;
