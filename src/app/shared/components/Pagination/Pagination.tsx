type Props = {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
};

const btnBase =
    "min-w-8 h-8 px-[6px] rounded-sm border border-border bg-surface-2 text-muted " +
    "text-[0.85rem] font-sans cursor-pointer leading-none flex items-center justify-center " +
    "transition-[background,color,border-color] duration-150 " +
    "disabled:opacity-35 disabled:cursor-not-allowed " +
    "[&:hover:not(:disabled)]:bg-surface [&:hover:not(:disabled)]:text-text [&:hover:not(:disabled)]:border-white/15";

export default function Pagination({ page, totalPages, onPageChange }: Props) {
    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-center gap-1 mt-md">
            <button
                className={btnBase}
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1}
                aria-label="Previous page"
            >
                ‹
            </button>
            <span className="text-[0.85rem] text-muted font-sans min-w-[52px] text-center tracking-[0.02em]">
                {page} / {totalPages}
            </span>
            <button
                className={btnBase}
                onClick={() => onPageChange(page + 1)}
                disabled={page === totalPages}
                aria-label="Next page"
            >
                ›
            </button>
        </div>
    );
}
