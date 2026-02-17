import { useState, useMemo } from "react";
import RegistrationFilters from "./RegistrationFilters";
import RegistrationList from "./RegistrationList";
import "./registrations.css";

const PAGE_SIZE = 10;

export default function RegistrationsTab({ event, boats = [] }: any) {

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [page, setPage] = useState(1);

    /* ------------------------------------ */
    /* FILTER + SORT */
    /* ------------------------------------ */

    const filteredBoats = useMemo(() => {

        return boats
            .filter((b:any) => {

                if (statusFilter !== "all" && b.status !== statusFilter)
                    return false;

                if (categoryFilter !== "all" && b.categoryId !== categoryFilter)
                    return false;

                if (
                    search &&
                    !b.clubName.toLowerCase().includes(search.toLowerCase())
                )
                    return false;

                return true;
            })
            .sort((a:any, b:any) => {

                const aBow = a.bowNumber ?? Infinity;
                const bBow = b.bowNumber ?? Infinity;

                return aBow - bBow;
            });

    }, [boats, search, statusFilter, categoryFilter]);

    /* ------------------------------------ */
    /* PAGINATION */
    /* ------------------------------------ */

    const totalPages = Math.max(
        1,
        Math.ceil(filteredBoats.length / PAGE_SIZE)
    );

    const paginatedBoats = useMemo(() => {

        const start = (page - 1) * PAGE_SIZE;
        return filteredBoats.slice(start, start + PAGE_SIZE);

    }, [filteredBoats, page]);

    return (
        <div className="registrations-container">

            <RegistrationFilters
                event={event}
                search={search}
                setSearch={(v:any)=>{ setSearch(v); setPage(1); }}
                statusFilter={statusFilter}
                setStatusFilter={(v:any)=>{ setStatusFilter(v); setPage(1); }}
                categoryFilter={categoryFilter}
                setCategoryFilter={(v:any)=>{ setCategoryFilter(v); setPage(1); }}
            />

            <RegistrationList
                boats={paginatedBoats}
                page={page}
                totalPages={totalPages}
                setPage={setPage}
            />

        </div>
    );
}