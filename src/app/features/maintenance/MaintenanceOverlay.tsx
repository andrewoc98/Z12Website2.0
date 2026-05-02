

export default function MaintenanceOverlay() {

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@300;400&family=Barlow+Condensed:wght@600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body, #root {
          height: 100%;
          background: #111110;
        }

        .maint-root {
          min-height: 100vh;
          background: #111110;
          color: #E8E4DC;
          font-family: 'Barlow', sans-serif;
          font-weight: 300;
          position: relative;
          overflow: hidden;
          display: grid;
          grid-template-rows: 1fr auto;
          padding: clamp(2rem, 5vw, 4rem) clamp(1.5rem, 6vw, 5rem);
        }

        .maint-root::before {
          content: '';
          position: fixed;
          top: -20%;
          left: -10%;
          width: 140%;
          height: 3px;
          background: linear-gradient(90deg, transparent 0%, #F5A623 40%, transparent 100%);
          transform: rotate(-8deg);
          opacity: 0.14;
          pointer-events: none;
        }

        .maint-root::after {
          content: '';
          position: fixed;
          bottom: 18%;
          left: -10%;
          width: 140%;
          height: 2px;
          background: linear-gradient(90deg, transparent 0%, #F5A623 50%, transparent 100%);
          transform: rotate(-8deg);
          opacity: 0.06;
          pointer-events: none;
        }

        .fade-up {
          opacity: 0;
          transform: translateY(18px);
          animation: fadeUp 0.7s ease forwards;
        }

        @keyframes fadeUp {
          to { opacity: 1; transform: translateY(0); }
        }

        .tag {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: #F5A623;
        }

        .tag::before {
          content: '';
          display: block;
          width: 28px;
          height: 2px;
          background: #F5A623;
        }

        .logo-text {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(5rem, 18vw, 16rem);
          line-height: 0.85;
          letter-spacing: 0.04em;
          color: #F5A623;
          user-select: none;
        }

        .headline {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(2.8rem, 7vw, 6rem);
          line-height: 0.92;
          letter-spacing: 0.03em;
          color: #E8E4DC;
        }

        .sub {
          max-width: 420px;
          font-size: clamp(0.9rem, 1.4vw, 1rem);
          line-height: 1.75;
          color: #7A7772;
        }

        .divider {
          width: 50px;
          height: 3px;
          background: #F5A623;
          transform-origin: left;
          animation: grow 0.5s ease forwards;
        }

        @keyframes grow {
          from { transform: scaleX(0); opacity: 0; }
          to { transform: scaleX(1); opacity: 1; }
        }

        .status-row {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #1E1E1C;
          border: 1px solid #2E2E2B;
          border-radius: 4px;
          padding: 8px 16px;
          font-size: 0.8rem;
          letter-spacing: 0.04em;
          color: #9A9690;
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #F5A623;
          position: relative;
          flex-shrink: 0;
        }

        .pulse-dot::after {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          border: 1px solid #F5A623;
          animation: pulse 2s ease-in-out infinite;
          opacity: 0;
        }

        @keyframes pulse {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }

        .countdown {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(1.4rem, 3vw, 2.2rem);
          letter-spacing: 0.1em;
          color: #E8E4DC;
        }

        .countdown span {
          color: #F5A623;
        }

        .footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding-top: 2rem;
          border-top: 1px solid #232320;
          flex-wrap: wrap;
        }

        .footer-copy {
          font-size: 0.75rem;
          color: #5A5955;
          letter-spacing: 0.04em;
        }

        .footer-links {
          display: flex;
          gap: 20px;
        }

        .footer-links a {
          font-size: 0.75rem;
          color: #5A5955;
          text-decoration: none;
          letter-spacing: 0.1em;
          font-family: 'Barlow Condensed', sans-serif;
          text-transform: uppercase;
          transition: color 0.2s;
        }

        .footer-links a:hover { color: #F5A623; }
      `}</style>

            <div className="maint-root">
                <main style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'clamp(1.2rem, 2.5vh, 2rem)' }}>

                    {/* Z12 big logo text */}
                    <div
                        className={`logo-text fade-up`}
                        style={{ animationDelay: '0s' }}
                    >
                        Z12
                    </div>

                    <span className="tag fade-up" style={{ animationDelay: '0.1s' }}>
            Maintenance in progress
          </span>

                    <h1 className="headline fade-up" style={{ animationDelay: '0.2s' }}>
                        Back on the<br />water soon.
                    </h1>

                    <div className="divider fade-up" style={{ animationDelay: '0.3s' }} />

                    <p className="sub fade-up" style={{ animationDelay: '0.35s' }}>
                        We're making improvements ahead of the new season. Everything is under control — we'll be back in the water shortly.
                    </p>

                    <div className="status-row fade-up" style={{ animationDelay: '0.4s' }}>
                        <div className="badge">
                            <span className="pulse-dot" />
                            All systems operational (mostly)
                        </div>
                    </div>

                </main>
            </div>
        </>
    )
}