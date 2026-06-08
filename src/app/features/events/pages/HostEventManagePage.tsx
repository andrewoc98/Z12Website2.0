import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { useTourMock } from "../../../providers/TourMockContext";
import { TOUR_HOST_EVENTS, TOUR_HOST_BOATS } from "../../home/components/tourMockData";
import { getEvent, subscribeToEventBoats, updateEvent, updateEventCategories } from "../api/events";
import "../styles/HostEventManagePage.css";
import CategoriesTab from "../components/tabs/categories/CategoriesTab.tsx";
import OverviewTab from "../components/tabs/overview/OverviewTab";
import RegistrationsTab from "../components/tabs/registrations/RegistrationsTab";
import RaceTab from "../components/tabs/raceTab/RaceTab";
import ContactsTab from "../components/tabs/contacts/ContactsTab.tsx";
import PaymentsTab from "../components/tabs/payments/PaymentsTab";

type Tab = "overview" | "categories" | "registrations" | "race" | "contacts" | "payments";

export default function HostEventManagePage() {

    const { eventId } = useParams();
    const { isTourActive } = useTourMock();
    const [event, setEvent] = useState<any>(null);
    const [tab, setTab] = useState<Tab>("overview");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [boats, setBoats] = useState<any>([])

    const handleSaveCategories = async (addedIds: string[], removedIds: string[]) => {
        if (!eventId || !event) return;

        const currentCategories: any[] = event.categories ?? [];
        const currentIds: string[] = currentCategories.map((c: any) => c.id);
        const finalIds = [
            ...currentIds.filter(id => !removedIds.includes(id)),
            ...addedIds
        ];

        // Preserve feeCents for existing categories; new ones start without a fee
        const existingById = new Map(currentCategories.map((c: any) => [c.id, c]));
        const nextCategories = finalIds.map(id => {
            const existing = existingById.get(id);
            return existing ? existing : { id, name: id };
        });

        await updateEventCategories(eventId, nextCategories, removedIds);

        const updatedEvent = await getEvent(eventId);
        setEvent(updatedEvent);
    };

    const handleSaveFees = async (feesMap: Map<string, number>) => {
        if (!eventId || !event) return;
        const nextCategories = (event.categories ?? []).map((c: any) => ({
            ...c,
            feeCents: feesMap.has(c.id) ? feesMap.get(c.id) : c.feeCents,
        }));
        await updateEvent(eventId, { categories: nextCategories });
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
            case "categories": return <CategoriesTab event={event} boats={boats} onSave={handleSaveCategories} onSaveFees={handleSaveFees} />;
            case "payments": return <PaymentsTab event={event} />;
            default: return null;
        }
    };

    const tabs: Tab[] = ["overview", "categories", "registrations", "race", "contacts", "payments"];

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