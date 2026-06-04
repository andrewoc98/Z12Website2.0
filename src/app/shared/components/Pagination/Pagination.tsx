import "./Pagination.css";

type Props = {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
};

export default function Pagination({ page, totalPages, onPageChange }: Props) {
    if (totalPages <= 1) return null;

    return (
        <div className="pg-root">
            <button
                className="pg-btn"
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1}
                aria-label="Previous page"
            >
                ‹
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                    key={p}
                    className={`pg-btn${p === page ? " pg-btn--active" : ""}`}
                    onClick={() => onPageChange(p)}
                    aria-current={p === page ? "page" : undefined}
                >
                    {p}
                </button>
            ))}

            <button
                className="pg-btn"
                onClick={() => onPageChange(page + 1)}
                disabled={page === totalPages}
                aria-label="Next page"
            >
                ›
            </button>
        </div>
    );
}
