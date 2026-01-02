import { createBrowserRouter } from "react-router-dom";
import HomePage from "../app/features/events/pages/HomePage";
import LeaderboardPage from "../app/features/leaderboard/pages/LeaderboardPage";
import RequireRole from "../app/guards/RequireRole";
import EventCreatePage from "../app/features/events/pages/EventCreatePage";
import EventSignupPage from "../app/features/signup/pages/EventSignupPage";
import TimingPage from "../app/features/timing/pages/TimingPage";
import HostEventManagePage from "../app/features/events/pages/HostEventManagePage";
import RowerEventListPage from "./features/signup/pages/RowerEventListPage.tsx";
import EventResultsPage from "./features/signup/pages/EventResultsPage.tsx";
import AuthPage from "./features/auth/pages/AuthPage.tsx";


export const router = createBrowserRouter([
    {path: "/host/events/new", element: (
            <RequireRole role="host">
                <EventCreatePage />
            </RequireRole>
        ),
    },
    {
        path: "/rower/events",
        element: (
            <RequireRole role="rower">
                <RowerEventListPage />
            </RequireRole>
        ),
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
        path: "/rower/events/:eventId/results",
        element: (
            <RequireRole role="rower">
                <EventResultsPage />
            </RequireRole>
        ),
    },
    {
        path: "/host/events/manage",
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
        path: "/admin/timing",
        element: (
            <RequireRole role="admin">
                <TimingPage />
            </RequireRole>
        ),
    },
    { path: "/", element: <HomePage /> },
    { path: "/leaderboard", element: <LeaderboardPage /> },
    { path: "/auth", element: <AuthPage /> },
]);
