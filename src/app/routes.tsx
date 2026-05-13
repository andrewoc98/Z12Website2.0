// src/router.tsx
import {createBrowserRouter, Outlet, useLocation} from "react-router-dom";
import HomePage from "./features/home/pages/HomePage";
import RequireRole from "./guards/RequireRole";
import EventCreatePage from "./features/events/pages/EventCreatePage";
import EventSignupPage from "./features/signup/pages/EventSignupPage";
import HostEventManagePage from "./features/events/pages/HostEventManagePage";
import RowerEventListPage from "./features/signup/pages/RowerEventListPage.tsx";
import EventResultsPage from "./features/results/pages/EventResultsPage.tsx";
import AuthPage from "./features/auth/pages/AuthPage.tsx";
import RequireAuth from "./guards/RequiredAuth.tsx";
import RequireTimingAccess from "./guards/RequireTimingAccess.tsx";
import ProfilePage from "./features/profile/pages/ProfilePage.tsx";
import InviteJoinPage from "./features/signup/pages/InviteJoinPage.tsx";
import HostEventListPage from "./features/events/pages/HostEventListPage.tsx";
import CommunityPage from "./features/community/pages/CommunityPage.tsx";
import PublicProfilePage from "./features/community/pages/PublicProfilePage.tsx";
import ForgotPasswordPage from "./features/auth/pages/ForgotPasswordPage.tsx";
import AboutPage from "./features/about/pages/AboutPage.tsx";
import Terms from "./features/terms/Terms.tsx";
import Privacy from "./features/privacy/Privacy.tsx";
import ParentConsentPage from "./features/auth/pages/ParentConsentPage.tsx";
import ResetPasswordPage from "./features/auth/pages/ResetPasswordPage.tsx";
import TimingPage from "./features/timing/pages/TimingPage.tsx";
import TimingEventSelectPage from "./features/timing/pages/TimingEventSelectPage.tsx";
import RequireMaintenance from "./guards/RequireMaintenance.tsx";
import EventPageView from "./features/signup/pages/EventPageView.tsx";
import ProfileCompletionModal from "./features/home/components/ProfileCompletionModal.tsx";
import {useMemo} from "react";
import {useAuth} from "./providers/AuthProvider.tsx";

const EXCLUDED_PATHS = [
    "/auth",
    "/parent-consent",
    "/forgot-password",
    "/reset-password",
    "/terms",
    "/privacy",
];

function RootLayout() {
    const { user, profile } = useAuth() as any;
    const { pathname } = useLocation();
    const p = profile ?? null;

    const missingFields = useMemo(() => {
        if (!user || !p || !p.roles?.rower) return [];
        const missing: string[] = [];
        if (!p.gender || p.gender === "unknown") missing.push("gender");
        if (!p.dateOfBirth) missing.push("dateOfBirth");
        if (!(p.roles?.rower?.club ?? "").trim()) missing.push("club");
        return missing;
    }, [user, p]);

    const showModal =
        missingFields.length > 0 &&
        !EXCLUDED_PATHS.some((path) => pathname.startsWith(path));

    return (
        <RequireMaintenance>
            {showModal && <ProfileCompletionModal missingFields={missingFields} />}
            <Outlet />
        </RequireMaintenance>
    );
}

export const router = createBrowserRouter([
    {
        element: <RootLayout />,
        children: [
            {
                path: "/host/events/new",
                element: (
                    <RequireRole role="host">
                        <EventCreatePage />
                    </RequireRole>
                ),
            },
            {
                path: "/rower/events/:eventId/results",
                element: <EventResultsPage />,
            },
            {
                path: "/rower/events/:eventId/signup",
                element: (
                    <RequireRole role="rower">
                        <EventSignupPage />
                    </RequireRole>
                ),
            },
            {
                path: "/host/events",
                element: (
                    <RequireRole role="host">
                        <HostEventListPage />
                    </RequireRole>
                ),
            },
            {
                path: "/host/events/:eventId",
                element: (
                    <RequireRole role="host">
                        <HostEventManagePage />
                    </RequireRole>
                ),
            },
            {
                path: "/rower/signup",
                element: (
                    <RequireRole role="rower">
                        <EventSignupPage />
                    </RequireRole>
                ),
            },
            {
                path: "/profile",
                element: (
                    <RequireAuth>
                        <ProfilePage />
                    </RequireAuth>
                ),
            },
            {
                path: "/invite/:eventId/:code",
                element: (
                    <RequireRole role="rower">
                        <InviteJoinPage />
                    </RequireRole>
                ),
            },
            { path: "/", element: <HomePage /> },
            { path: "/events", element: <RowerEventListPage /> },
            { path: "/about", element: <AboutPage /> },
            { path: "/auth", element: <AuthPage /> },
            { path: "/parent-consent", element: <ParentConsentPage /> },
            { path: "/forgot-password", element: <ForgotPasswordPage /> },
            { path: "/terms", element: <Terms /> },
            { path: "/privacy", element: <Privacy /> },
            { path: "/reset-password", element: <ResetPasswordPage /> },
            {path: "/events/:eventId/view", element:<EventPageView/>},
            {
                path: "/community",
                element: (
                    <RequireAuth>
                        <CommunityPage />
                    </RequireAuth>
                ),
            },
            {
                path: "/community/:uid",
                element: (
                    <RequireAuth>
                        <PublicProfilePage />
                    </RequireAuth>
                ),
            },
            {
                path: "/timing",
                element: (
                    <RequireTimingAccess>
                        <TimingEventSelectPage />
                    </RequireTimingAccess>
                ),
            },
            {
                path: "/timing/:eventId",
                element: (
                    <RequireTimingAccess>
                        <TimingPage />
                    </RequireTimingAccess>
                ),
            },
        ],
    },
]);