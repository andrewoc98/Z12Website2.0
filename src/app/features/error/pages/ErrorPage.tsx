import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';

function is404(error: unknown): boolean {
    return isRouteErrorResponse(error) && error.status === 404;
}

export default function ErrorPage() {
    const error    = useRouteError();
    const navigate = useNavigate();
    const notFound = is404(error);

    const title   = notFound ? 'Page Not Found' : 'Something Went Wrong';
    const message = notFound
        ? "The page you're looking for doesn't exist or has been moved."
        : "An unexpected error occurred. We're sorry for the inconvenience — please try reloading the page.";

    return (
        <div style={styles.shell}>
            <div style={styles.card}>
                <div style={styles.code}>{notFound ? '404' : 'ERROR'}</div>
                <h1 style={styles.title}>{title}</h1>
                <p style={styles.message}>{message}</p>

                <div style={styles.actions}>
                    <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => navigate('/')}>
                        Go Home
                    </button>
                    <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => window.location.reload()}>
                        Reload
                    </button>
                </div>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    shell: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1e1e22',
        padding: '24px',
    },
    card: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        maxWidth: '420px',
        width: '100%',
        gap: '16px',
    },
    code: {
        fontFamily: '"DIN Condensed", sans-serif',
        fontSize: '5rem',
        fontWeight: 800,
        letterSpacing: '0.08em',
        color: '#FEB959',
        lineHeight: 1,
    },
    title: {
        fontFamily: '"DIN Condensed", sans-serif',
        fontSize: '1.75rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: '#f3f4f6',
        margin: 0,
    },
    message: {
        fontSize: '0.9375rem',
        color: 'rgba(243,244,246,0.6)',
        lineHeight: 1.6,
        margin: 0,
    },
    actions: {
        display: 'flex',
        gap: '12px',
        marginTop: '8px',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    btn: {
        fontFamily: '"DIN Condensed", sans-serif',
        fontSize: '1rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: '12px 28px',
        borderRadius: '12px',
        border: 'none',
        cursor: 'pointer',
        minWidth: '120px',
    },
    btnPrimary: {
        background: '#ffd400',
        color: '#141414',
    },
    btnSecondary: {
        background: 'rgba(255,255,255,0.06)',
        color: '#f3f4f6',
        border: '1px solid rgba(255,255,255,0.12)',
    },
};
