import { useState, useEffect } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { searchUsersByName } from "../api/community";
import { useNavigate } from "react-router-dom";
import type { UserProfile } from "../../auth/types";

import "../styles/Community.css";

export default function CommunityPage() {

    const [query, setQuery] = useState("");
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {

        const timer = setTimeout(async () => {

            setLoading(true);

            const results = await searchUsersByName(query);
            setUsers(results);

            setLoading(false);

        }, 300);

        return () => clearTimeout(timer);

    }, [query]);

    return (
        <>
            <Navbar />

            <main className="community-page">

                <h2>Community</h2>

                <input
                    className="community-search"
                    placeholder="Search rowers, hosts..."
                    value={query}
                    onChange={(e)=>setQuery(e.target.value)}
                />

                {loading && <p className="searching">Searching…</p>}

                <div className="community-grid">

                    {users.map(u => (
                        <div
                            key={u.uid}
                            className="user-card"
                            onClick={() => navigate(`/community/${u.uid}`)}
                        >

                            <div className="user-avatar">
                                {u.displayName?.charAt(0)}
                            </div>

                            <div className="user-name">
                                {u.displayName || u.fullName}
                            </div>

                        </div>
                    ))}

                </div>

            </main>
        </>
    );
}
