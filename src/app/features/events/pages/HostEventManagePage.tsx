import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import {getEvent, subscribeToEventBoats} from "../api/events";
import "../styles/HostEventManagePage.css";

import OverviewTab from "../components/tabs/overview/OverviewTab";
import RegistrationsTab from "../components/tabs/registrations/RegistrationsTab";
import RaceTab from "../components/tabs/raceTab/RaceTab";
import ContactsTab from "../components/tabs/contacts/ContactsTab.tsx";

type Tab = "overview" | "registrations"  | "race" | "contacts";

export default function HostEventManagePage() {

    const { eventId } = useParams();
    const [event, setEvent] = useState<any>(null);
    const [tab, setTab] = useState<Tab>("overview");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [boats, setBoats] = useState<any>([])

    useEffect(() => {

        if (!eventId) return;

        getEvent(eventId).then(setEvent);

        const unsubscribe = subscribeToEventBoats(
            eventId,
            setBoats
        );

        return unsubscribe;

    }, [eventId]);

    const status = useMemo(() => {
        if (!event) return "—";

        const now = Date.now();
        const start = event.startDate ? new Date(event.startDate).getTime() : null;
        const end = event.endDate ? new Date(event.endDate).getTime() : null;
        const close = event.closingDate ? new Date(event.closingDate).getTime() : null;

        if (end && now > end) return "finished";
        if (start && now >= start) return "running";
        if (close && now > close) return "closed";

        return "open";
    }, [event]);

    if (!event) return <div className="loading">Loading…</div>;

    const renderTab = () => {

        switch (tab) {
            case "overview": return <OverviewTab event={event} boats = {boats}/>;
            case "registrations": return <RegistrationsTab event={event} boats={boats} />;
            case "race": return <RaceTab event={event} boats={boats}/>;
            case "contacts": return <ContactsTab hostId={event.createdByUid}/>;
            default: return null;
        }
    };

    const tabs: Tab[] = ["overview","registrations","race","contacts"];

    return (
        <>
            <Navbar />

            <main className="host-dashboard">

                {/* HEADER */}
                <header className="event-header">

                    <div className="event-title">
                        <button
                            className="menu-toggle"
                            onClick={() => setSidebarOpen(true)}
                        >
                            ☰
                        </button>

                        <h1>{event.name}</h1>

                        <span className={`status-badge ${status}`}>
                            {status}
                        </span>
                    </div>

                </header>


                {/* MOBILE OVERLAY */}
                <div
                    className={`overlay ${sidebarOpen ? "show" : ""}`}
                    onClick={() => setSidebarOpen(false)}
                />


                {/* WORKSPACE */}
                <div className="workspace">

                    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>

                        {tabs.map(t => (
                            <button
                                key={t}
                                className={`nav-item ${tab === t ? "active" : ""}`}
                                onClick={() => {
                                    setTab(t);
                                    setSidebarOpen(false);
                                }}
                            >
                                {t}
                            </button>
                        ))}

                    </aside>

                    <section className="content-area">
                        {renderTab()}
                    </section>

                </div>

            </main>
        </>
    );
}