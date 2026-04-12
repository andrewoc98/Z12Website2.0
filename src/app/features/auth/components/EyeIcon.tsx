export function EyeIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FEB959"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path className="eye" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle className="pupil" cx="12" cy="12" r="3" />
            <line className="slash" x1="1" y1="1" x2="23" y2="23" />
        </svg>
    );
}