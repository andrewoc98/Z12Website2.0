import { useMemo, useState } from "react";

const PAGE_SIZE = 10;

export default function CategoryBreakdown({ boats, categories }: any) {

    function parseCategory(cat: any) {
        const parts = cat.name.split(" • ");
        return {
            ...cat,
            gender: parts[0] || "",
            division: parts[1] || "",
            boatType: parts[2] || ""
        };
    }

    const data = useMemo(() => {

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

    const [genderFilter, setGenderFilter] = useState("all");
    const [divisionFilter, setDivisionFilter] = useState("all");
    const [hideEmpty, setHideEmpty] = useState(true);
    const [page, setPage] = useState(1);

    const filtered = useMemo(() => {

        return data.filter((cat: any) => {

            if (genderFilter !== "all" && cat.gender !== genderFilter) {
                return false;
            }

            if (divisionFilter !== "all" && !cat.division.includes(divisionFilter)) {
                return false;
            }

            if (hideEmpty && cat.total === 0 && cat.registered === 0 && cat.pending === 0) {
                return false;
            }

            return true;

        });

    }, [data, genderFilter, divisionFilter, hideEmpty]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

    const paginated = useMemo(() => {

        const start = (page - 1) * PAGE_SIZE;
        return filtered.slice(start, start + PAGE_SIZE);

    }, [filtered, page]);

    const inputCls = "h-[38px] px-3 rounded-[6px] border border-border text-[14px] bg-surface-2 text-text transition-[border-color] focus:border-brand-warm focus:outline-none max-[700px]:flex-1";

    return (
        <section className="card">

            <h2>Category Breakdown</h2>

            <div className="flex flex-wrap gap-[10px] mb-4 items-center">

                <select
                    className={inputCls}
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
                    type="text"
                    className={inputCls}
                    placeholder="Filter division (e.g. Junior, U19, Masters)"
                    value={divisionFilter === "all" ? "" : divisionFilter}
                    onChange={(e) => {
                        const val = e.target.value;
                        setDivisionFilter(val || "all");
                        setPage(1);
                    }}
                />

                <label className="flex items-center gap-[7px] h-[38px] px-3 bg-surface-2 border border-border rounded-[6px] text-[14px] text-muted cursor-pointer select-none whitespace-nowrap transition-[border-color,color] hover:border-brand-warm hover:text-text shrink-0 max-[700px]:w-full max-[700px]:justify-center">
                    <input
                        type="checkbox"
                        className="w-[14px] h-[14px] min-w-[14px] shrink-0 cursor-pointer accent-brand-warm"
                        checked={hideEmpty}
                        onChange={(e) => {
                            setHideEmpty(e.target.checked);
                            setPage(1);
                        }}
                    />
                    Hide empty categories
                </label>

            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[14px]">
                {paginated.map((category: any) => (
                    <CategoryRow key={category.id} category={category} />
                ))}
            </div>

            <div className="flex justify-center items-center gap-3 mt-5">

                <button
                    className="bg-surface-2 border-none rounded-[6px] px-3 py-[6px] cursor-pointer text-[14px] text-text min-h-[unset] transition-[background] hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                >
                    Prev
                </button>

                <span className="text-[14px] text-muted">Page {page} / {totalPages}</span>

                <button
                    className="bg-surface-2 border-none rounded-[6px] px-3 py-[6px] cursor-pointer text-[14px] text-text min-h-[unset] transition-[background] hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                >
                    Next
                </button>

            </div>

        </section>
    );
}

function CategoryRow({ category }: any) {
    return (
        <div className="bg-surface rounded-[12px] p-[14px] flex flex-col gap-[10px] border border-border transition-[transform,box-shadow] hover:-translate-y-[2px] hover:shadow-[0_3px_10px_rgba(255,185,89,0.2)]">

            <div className="font-semibold text-[14px] text-text">
                {category.name}
            </div>

            <div className="flex gap-[10px]">
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
        <div className={`rounded-[8px] px-[10px] py-[6px] flex flex-col items-center min-w-[70px] ${alert ? "bg-[rgba(255,107,107,0.08)] text-[#ff6b6b]" : "bg-surface-2 text-text"}`}>
            <span className="text-[16px] font-semibold">{value}</span>
            <span className="text-[11px] text-muted">{label}</span>
        </div>
    );
}
