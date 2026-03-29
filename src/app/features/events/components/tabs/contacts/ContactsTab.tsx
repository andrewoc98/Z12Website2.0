import React, { useEffect, useState } from "react";
import { fetchAdminsByHost } from "../../../api/events.ts";

interface Admin {
    uid: string;
    email: string;
    fullName: string;
    displayName: string;
}

interface ContactsTabProps {
    hostId: string;
}

const ContactsTab: React.FC<ContactsTabProps> = ({ hostId }) => {
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadAdmins = async () => {
            const adminsData = await fetchAdminsByHost(hostId);
            setAdmins(adminsData);
            setLoading(false);
        };

        loadAdmins();
    }, [hostId]);

    if (loading) return <p>Loading admins...</p>;
    if (!admins.length) return <p>No admins found for this host.</p>;

    return (
        <div className="contacts-tab">
            <h2>Admins for this Host</h2>

            <div className="admin-grid">
                {admins.map(admin => (
                    <div key={admin.uid} className="card card--hover admin-card">
                        <h3>{admin.fullName || admin.displayName}</h3>
                        <p className="admin-email">{admin.email}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ContactsTab;