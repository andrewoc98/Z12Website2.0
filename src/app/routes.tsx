// src/router.tsx
import {createBrowserRouter, Navigate, Outlet, useLocation, useParams} from "react-router-dom";
import {lazy, useMemo} from "react";

function RedirectToResults() {
    const { eventId } = useParams<{ eventId: string }>();
    return <Navigate to={`/events/${eventId}?tab=results`} replace />;
}
function RedirectToEntries() {
    const { eventId } = useParams<{ eventId: string }>();
    return <Navigate to={`/events/${eventId}?tab=entries`} replace />;
}
// Timing has been retired in favour of the Results Editor on the manage-race page.
function RedirectTimingToManage() {
    const { eventId } = useParams<{ eventId: string }>();
    return <Navigate to={`/host/events/${eventId}`} replace />;
}
import HomePage from "./features/home/pages/HomePage";
import AuthPage from "./features/auth/pages/AuthPage.tsx";
import RequireRole from "./guards/RequireRole";
import RequireAnyRole from "./guards/RequireAnyRole";
import RequireAuth from "./guards/RequiredAuth.tsx";
import RequireMaintenance from "./guards/RequireMaintenance.tsx";
import ProfileCompletionModal from "./features/home/components/ProfileCompletionModal.tsx";
import TourController from "./features/home/components/TourController.tsx";
import { TourMockProvider } from "./providers/TourMockContext";

const EventCreatePage         = lazy(() => import("./features/events/pages/EventCreatePage"));
const EventSignupPage         = lazy(() => import("./features/signup/pages/EventSignupPage"));
const EventPage               = lazy(() => import("./features/events/pages/EventPage"));
const HostEventManagePage     = lazy(() => import("./features/events/pages/HostEventManagePage"));
const RowerEventListPage      = lazy(() => import("./features/signup/pages/RowerEventListPage"));
const ProfilePage             = lazy(() => import("./features/profile/pages/ProfilePage"));
const InviteJoinPage          = lazy(() => import("./features/signup/pages/InviteJoinPage"));
const BookingConfirmPage      = lazy(() => import("./features/signup/pages/BookingConfirmPage"));
const MyBookingsPage          = lazy(() => import("./features/signup/pages/MyBookingsPage"));
const StripeConnectComplete   = lazy(() => import("./features/admin/pages/StripeConnectComplete"));
const StripeConnectRefresh    = lazy(() => import("./features/admin/pages/StripeConnectRefresh"));
const HostEventListPage       = lazy(() => import("./features/events/pages/HostEventListPage"));
const ForgotPasswordPage      = lazy(() => import("./features/auth/pages/ForgotPasswordPage"));
const AboutPage               = lazy(() => import("./features/about/pages/AboutPage"));
const Terms                   = lazy(() => import("./features/terms/Terms"));
const Privacy                 = lazy(() => import("./features/privacy/Privacy"));
const ParentConsentPage       = lazy(() => import("./features/auth/pages/ParentConsentPage"));
const ResetPasswordPage       = lazy(() => import("./features/auth/pages/ResetPasswordPage"));
const AcceptInvitePage        = lazy(() => import("./features/admin/pages/AcceptInvitePage"));
const PlatformAdminDashboard  = lazy(() => import("./features/admin/pages/PlatformAdminDashboard"));
const FederationAdminDashboard = lazy(() => import("./features/admin/pages/FederationAdminDashboard"));
const ClubAdminDashboard      = lazy(() => import("./features/admin/pages/ClubAdminDashboard"));
const ClubCreationRequestPage = lazy(() => import("./features/admin/pages/ClubCreationRequestPage"));
import {useAuth} from "./providers/AuthProvider";
import ErrorPage from "./features/error/pages/ErrorPage";

const EXCLUDED_PATHS = [
    "/auth",
    "/parent-consent",
    "/forgot-password",
    "/reset-password",
    "/terms",
    "/privacy",
    "/accept-invite",
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
        return missing;
    }, [user, p]);

    const showModal =
        missingFields.length > 0 &&
        !EXCLUDED_PATHS.some((path) => pathname.startsWith(path));

    return (
        <RequireMaintenance>
            <TourMockProvider>
                {showModal && <ProfileCompletionModal missingFields={missingFields} />}
                <TourController />
                <Outlet />
            </TourMockProvider>
        </RequireMaintenance>
    );
}

export const router = createBrowserRouter([
    {
        element: <RootLayout />,
        errorElement: <ErrorPage />,
        children: [
            {
                path: "/host/events/new",
                element: (
                    <RequireRole role="clubAdmin">
                        <EventCreatePage />
                    </RequireRole>
                ),
            },
            {
                path: "/events/:eventId",
                element: <EventPage />,
            },
            {
                path: "/rower/events/:eventId/results",
                element: <RedirectToResults />,
            },
            {
                path: "/rower/events/:eventId/signup",
                element: <RedirectToEntries />,
            },
            {
                path: "/host/events",
                element: (
                    <RequireRole role="clubAdmin">
                        <HostEventListPage />
                    </RequireRole>
                ),
            },
            {
                path: "/host/events/:eventId",
                element: (
                    <RequireRole role="clubAdmin">
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
            // Training sessions disabled — redirect old links home.
            {
                path: "/coach/sessions/*",
                element: <Navigate to="/" replace />,
            },
            {
                path: "/rower/my-sessions/*",
                element: <Navigate to="/" replace />,
            },
            {
                path: "/session/:sessionId/run",
                element: <Navigate to="/" replace />,
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
            { path: "/events/:eventId/view", element: <RedirectToEntries /> },
            { path: "/booking/confirm", element: <BookingConfirmPage /> },
            { path: "/admin/stripe/complete", element: <StripeConnectComplete /> },
            { path: "/admin/stripe/refresh",  element: <StripeConnectRefresh /> },
            {
                path: "/my-bookings",
                element: (
                    <RequireAnyRole roles={["rower", "coach"]}>
                        <MyBookingsPage />
                    </RequireAnyRole>
                ),
            },
            {
                path: "/accept-invite",
                element: (
                    <RequireAuth>
                        <AcceptInvitePage />
                    </RequireAuth>
                ),
            },
            {
                path: "/admin/platform",
                element: <PlatformAdminDashboard />,
            },
            {
                path: "/admin/federation",
                element: <FederationAdminDashboard />,
            },
            {
                path: "/admin/club",
                element: <ClubAdminDashboard />,
            },
            {
                path: "/club/request",
                element: <ClubCreationRequestPage />,
            },
            // Timing retired — redirect old links to the Results Editor on the manage-race page.
            {
                path: "/timing",
                element: <Navigate to="/host/events" replace />,
            },
            {
                path: "/timing/:eventId",
                element: <RedirectTimingToManage />,
            },
        ],
    },
]);