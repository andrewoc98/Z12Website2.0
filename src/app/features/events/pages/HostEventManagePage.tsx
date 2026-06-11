import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { useTourMock } from "../../../providers/TourMockContext";
import { TOUR_HOST_EVENTS, TOUR_HOST_BOATS } from "../../home/components/tourMockData";
import {categoriesFromIds, getEvent, subscribeToEventBoats, updateEventCategories} from "../api/events";
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

    const STATUS_COLORS: Record<string, string> = {
        open:     "bg-[#22c55e] text-brand-ink",
        running:  "bg-brand-warm text-brand-ink",
        finished: "bg-surface-2 text-muted",
        closed:   "bg-[#ff6b6b] text-brand-ink",
    };

    if (!event) return <div className="loading">Loading…</div>;

    const renderTab = () => {
        switch (tab) {
            case "overview":      return <OverviewTab event={event} boats={boats}/>;
            case "registrations": return <RegistrationsTab event={event} boats={boats} />;
            case "race":          return <RaceTab event={event} boats={boats}/>;
            case "contacts":      return <ContactsTab hostId={event.createdByUid}/>;
            case "categories":    return <CategoriesTab event={event} boats={boats} onSave={handleSaveCategories} />;
            default:              return null;
        }
    };

    const tabs: Tab[] = ["overview","categories","registrations","race","contacts"];

    return (
        <>
            <Navbar />

            <main className="h-screen flex flex-col bg-bg text-text">

                {/* HEADER */}
                <header className="h-[60px] border-b border-border px-5 py-[14px] sticky top-0 z-[20] bg-surface text-text">
                    <div className="flex items-center gap-[14px]">
                        <button
                            className="hidden max-md:block border-0 bg-transparent text-[20px] cursor-pointer text-text min-h-[unset]"
                            onClick={() => setSidebarOpen(true)}
                        >
                            ☰
                        </button>
                        <h1 className="text-[20px] m-0">{event.name}</h1>
                        <span className={`px-[10px] py-1 rounded-full text-[12px] capitalize ${STATUS_COLORS[status] ?? "bg-surface-2 text-muted"}`}>
                            {status}
                        </span>
                    </div>
                </header>

                {/* MOBILE OVERLAY */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/70 z-[15] block"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* WORKSPACE */}
                <div className="flex-1 flex min-h-0">

                    <aside
                        className={`w-[220px] bg-surface border-r border-border flex flex-col p-[10px] gap-[6px] max-md:fixed max-md:top-[120px] max-md:h-[calc(100%-120px)] max-md:z-[30] max-md:transition-[left] max-md:duration-250 ${sidebarOpen ? "max-md:left-0" : "max-md:-left-[260px]"}`}
                        data-tour="host-manage-tabs"
                    >
                        {tabs.map(t => (
                            <button
                                key={t}
                                data-tour={`tab-${t}`}
                                className={`px-3 py-[10px] rounded-lg border-0 text-left cursor-pointer text-text min-h-[44px] transition-[background] duration-100 ${tab === t ? "bg-brand-warm text-brand-ink font-semibold" : "bg-transparent hover:bg-surface-2 hover:shadow-none"}`}
                                onClick={() => { setTab(t); setSidebarOpen(false); }}
                            >
                                {t}
                            </button>
                        ))}
                    </aside>

                    <section className="flex-1 overflow-auto p-6 bg-bg text-text" data-tour="host-manage-content">
                        {renderTab()}
                    </section>

                </div>

            </main>
        </>
    );
}