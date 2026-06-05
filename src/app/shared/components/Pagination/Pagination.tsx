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
            <span className="pg-label">{page} / {totalPages}</span>
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
