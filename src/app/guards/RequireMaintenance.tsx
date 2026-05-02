// src/guards/RequireMaintenance.tsx
import { Navigate, useLocation } from "react-router-dom";
import { useMaintenanceMode } from "../hooks/useMaintenanceMode";
import MaintenanceOverlay from "../features/maintenance/MaintenanceOverlay.tsx";

const PUBLIC_ONLY_PATHS = ["/", "/about", "/terms", "/privacy"];

export default function RequireMaintenance({ children }: { children: React.ReactNode }) {
    const isMaintenance = useMaintenanceMode();
    const { pathname } = useLocation();

    if (!isMaintenance) return <>{children}</>;

    // Allow homepage through — it will show the overlay
    if (!PUBLIC_ONLY_PATHS.includes(pathname)) {
        return <Navigate to="/" replace />;
    }

    return (
        <>
            <MaintenanceOverlay />
            {children} {/* home page renders underneath, dimmed by overlay */}
        </>
    );
}