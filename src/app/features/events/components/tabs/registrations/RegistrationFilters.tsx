export default function RegistrationFilters({
                                                event,
                                                search,
                                                setSearch,
                                                statusFilter,
                                                setStatusFilter,
                                                categoryFilter,
                                                setCategoryFilter
                                            }: any) {

    return (
        <div className="card filter-bar">

            <input
                placeholder="Search club..."
                value={search}
                onChange={e => setSearch(e.target.value)}
            />

            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="registered">Registered</option>
                <option value="pending_crew">Pending Crew</option>
            </select>

            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>

                {event.categories.map((c:any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                ))}

            </select>

        </div>
    );
}