import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { useTourMock } from "../../../providers/TourMockContext";
import { TOUR_HOST_EVENTS, TOUR_HOST_BOATS } from "../../home/components/tourMockData";
import {categoriesFromIds, getEvent, subscribeToEventBoats, updateEventCategories} from "../api/events";
import "../styles/HostEventManagePage.css";
import CategoriesTab from "../components/tabs/categories/CategoriesTab.tsx";
import OverviewTab from "../components/tabs/overview/OverviewTab";
import RegistrationsTab from "../components/tabs/registrations/RegistrationsTab";
import RaceTab from "../components/tabs/raceTab/RaceTab";
import ContactsTab from "../components/tabs/contacts/ContactsTab.tsx";

type Tab = "overview" | "categories" | "registrations"  | "race" | "contacts";

export default function HostEventManagePage() {

    const { eventId } = useParams();
    const { isTourActive } = useTourMock();
    const [event, setEvent] = useState<any>(null);
    const [tab, setTab] = useState<Tab>("overview");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [boats, setBoats] = useState<any>([])

    const handleSaveCategories = async (addedIds: string[], removedIds: string[]) => {
        if (!eventId || !event) return;

        // 1. Calculate the final list of IDs (Current - Removed + Added)
        const currentIds: string[] = event.categories.map((c: any) => c.id);
        const finalIds = [
            ...currentIds.filter(id => !removedIds.includes(id)),
            ...addedIds
        ];

        // 2. Convert IDs back to full EventCategory objects using your helper
        const nextCategories = categoriesFromIds(finalIds);

        // 3. Persist to Firestore
        await updateEventCategories(eventId, nextCategories, removedIds);

        // 4. Refresh local state
        // We fetch the fresh event from the DB to ensure everything is in sync
        const updatedEvent = await getEvent(eventId);
        setEvent(updatedEvent);
    };

    useEffect(() => {
        if (!eventId) return;

        if (isTourActive) {
            const mock = TOUR_HOST_EVENTS.find(e => e.id === eventId) ?? TOUR_HOST_EVENTS[0];
            setEvent(mock);
            setBoats(TOUR_HOST_BOATS);
            return;
        }

        getEvent(eventId).then(setEvent);

        const unsubscribe = subscribeToEventBoats(eventId, setBoats);
        return unsubscribe;
    }, [eventId, isTourActive]);

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
            case "categories": return <CategoriesTab event={event} boats={boats} onSave={handleSaveCategories} />;
            default: return null;
        }
    };

    const tabs: Tab[] = ["overview","categories","registrations","race","contacts"];

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

                    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`} data-tour="host-manage-tabs">

                        {tabs.map(t => (
                            <button
                                key={t}
                                data-tour={`tab-${t}`}
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

                    <section className="content-area" data-tour="host-manage-content">
                        {renderTab()}
                    </section>

                </div>

            </main>
        </>
    );
}