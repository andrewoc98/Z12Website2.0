import { createBrowserRouter } from "react-router-dom";
import HomePage from "../app/features/home/pages/HomePage";
import RequireRole from "../app/guards/RequireRole";
import EventCreatePage from "../app/features/events/pages/EventCreatePage";
import EventSignupPage from "../app/features/signup/pages/EventSignupPage";
import HostEventManagePage from "../app/features/events/pages/HostEventManagePage";
import RowerEventListPage from "./features/signup/pages/RowerEventListPage.tsx";
import EventResultsPage from "./features/results/pages/EventResultsPage.tsx";
import AuthPage from "./features/auth/pages/AuthPage.tsx";
import RequireAuth from "./guards/RequiredAuth.tsx";
import ProfilePage from "./features/profile/pages/ProfilePage.tsx";
import InviteJoinPage from "./features/signup/pages/InviteJoinPage.tsx";
import HostEventListPage from "./features/events/pages/HostEventListPage.tsx";
import CommunityPage from "./features/community/pages/CommunityPage.tsx";
import PublicProfilePage from "./features/community/pages/PublicProfilePage.tsx";
import ForgotPasswordPage from "./features/auth/pages/ForgotPasswordPage.tsx";
import AboutPage from "./features/about/pages/AboutPage.tsx";
import Terms from "./features/Terms/Terms.tsx";
import Privacy from "./features/Privacy/Privacy.tsx";
import ParentConsentPage from "./features/auth/pages/ParentConsentPage.tsx";
import ResetPasswordPage from "./features/auth/pages/ResetPasswordPage.tsx";

export const router = createBrowserRouter([
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
]);