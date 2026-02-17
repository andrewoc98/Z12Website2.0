import { useMemo, useState } from "react";

const PAGE_SIZE = 10;

export default function CategoryBreakdown({ boats, categories }: any) {

    /* -------------------------------------------------- */
    /* PARSE CATEGORY STRUCTURE */
    /* -------------------------------------------------- */

    function parseCategory(cat: any) {
        const parts = cat.name.split(" • ");

        return {
            ...cat,
            gender: parts[0] || "",
            division: parts[1] || "",
            boatType: parts[2] || ""
        };
    }

    /* -------------------------------------------------- */
    /* BUILD DATA (FAST VERSION) */
    /* -------------------------------------------------- */

    const data = useMemo(() => {

        // Pre-group boats by categoryId (O(n) instead of repeated filters)
        const boatMap = new Map();

        boats.forEach((b: any) => {
            if (!boatMap.has(b.categoryId)) {
                boatMap.set(b.categoryId, []);
            }
            boatMap.get(b.categoryId).push(b);
        });

        return categories.map((cat: any) => {

            const parsed = parseCategory(cat);
            const catBoats = boatMap.get(cat.id) || [];

            let registered = 0;
            let pending = 0;

            catBoats.forEach((b: any) => {
                if (b.status === "registered" || b.status === "finished") {
                    registered++;
                }
                if (b.status === "pending_crew") {
                    pending++;
                }
            });

            return {
                id: cat.id,
                name: cat.name,
                gender: parsed.gender,
                division: parsed.division,
                boatType: parsed.boatType,
                total: catBoats.length,
                registered,
                pending
            };

        });

    }, [boats, categories]);

    /* -------------------------------------------------- */
    /* FILTER STATE */
    /* -------------------------------------------------- */

    const [genderFilter, setGenderFilter] = useState("all");
    const [divisionFilter, setDivisionFilter] = useState("all");
    const [page, setPage] = useState(1);

    /* -------------------------------------------------- */
    /* FILTERED DATA */
    /* -------------------------------------------------- */

    const filtered = useMemo(() => {

        return data.filter((cat: any) => {

            if (genderFilter !== "all" && cat.gender !== genderFilter) {
                return false;
            }

            if (
                divisionFilter !== "all" &&
                !cat.division.includes(divisionFilter)
            ) {
                return false;
            }

            return true;

        });

    }, [data, genderFilter, divisionFilter]);

    /* -------------------------------------------------- */
    /* PAGINATION */
    /* -------------------------------------------------- */

    const totalPages = Math.max(
        1,
        Math.ceil(filtered.length / PAGE_SIZE)
    );

    const paginated = useMemo(() => {

        const start = (page - 1) * PAGE_SIZE;
        return filtered.slice(start, start + PAGE_SIZE);

    }, [filtered, page]);

    /* -------------------------------------------------- */
    /* UI */
    /* -------------------------------------------------- */

    return (
        <section className="card">

            <h2>Category Breakdown</h2>

            {/* FILTERS */}

            <div className="category-filters">

                <select
                    value={genderFilter}
                    onChange={(e) => {
                        setGenderFilter(e.target.value);
                        setPage(1);
                    }}
                >
                    <option value="all">All Genders</option>
                    <option value="Men">Men</option>
                    <option value="Women">Women</option>
                    <option value="Mixed">Mixed</option>
                </select>

                <input
                    placeholder="Filter division (e.g. Junior, U19, Masters)"
                    value={divisionFilter === "all" ? "" : divisionFilter}
                    onChange={(e) => {
                        const val = e.target.value;
                        setDivisionFilter(val || "all");
                        setPage(1);
                    }}
                />

            </div>

            {/* CATEGORY LIST */}

            <div className="category-list">

                {paginated.map((category: any) => (
                    <CategoryRow key={category.id} category={category} />
                ))}

            </div>

            {/* PAGINATION */}

            <div className="pagination">

                <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                >
                    Prev
                </button>

                <span>
          Page {page} / {totalPages}
        </span>

                <button
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                >
                    Next
                </button>

            </div>

        </section>
    );
}

/* -------------------------------------------------- */

function CategoryRow({ category }: any) {
    return (
        <div className="category-card">

            <div className="category-name">
                {category.name}
            </div>

            <div className="category-stats">
                <Stat label="Total" value={category.total} />
                <Stat label="Registered" value={category.registered} />
                <Stat
                    label="Pending"
                    value={category.pending}
                    alert={category.pending > 0}
                />
            </div>

        </div>
    );
}

function Stat({ label, value, alert }: any) {
    return (
        <div className={`category-stat ${alert ? "alert" : ""}`}>
            <span className="stat-number">{value}</span>
            <span className="stat-label">{label}</span>
        </div>
    );
}