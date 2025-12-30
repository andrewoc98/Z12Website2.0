import { useState } from "react";
import { Link } from "react-router-dom";
import "./Navbar.css";

export default function Navbar() {
    const [open, setOpen] = useState(false);

    return (
        <header className="nav">
            <div className="nav__inner">
                <Link className="nav__brand" to="/">Z12</Link>

                <button className="nav__burger" onClick={() => setOpen(!open)} aria-label="Menu">
                    ☰
                </button>

                <nav className={`nav__links ${open ? "is-open" : ""}`}>
                    <Link to="/" onClick={() => setOpen(false)}>Home</Link>
                    <Link to="/leaderboard" onClick={() => setOpen(false)}>Leaderboard</Link>
                    <Link to="/signin" onClick={() => setOpen(false)}>Sign In</Link>
                    <Link to="/register" onClick={() => setOpen(false)}>Register</Link>
                </nav>
            </div>
        </header>
    );
}
