import { createBrowserRouter } from "react-router-dom";
import HomePage from "../app/features/events/pages/HomePage";
import SignInPage from "../app/features/auth/pages/SignInPage";
import RegisterPage from "../app/features/auth/pages/RegisterPage";
import LeaderboardPage from "../app/features/leaderboard/pages/LeaderboardPage";
import RequireRole from "../app/guards/RequireRole";
import EventCreatePage from "../app/features/events/pages/EventCreatePage";
import EventSignupPage from "../app/features/signup/pages/EventSignupPage";
import TimingPage from "../app/features/timing/pages/TimingPage";
import HostEventManagePage from "../app/features/events/pages/HostEventManagePage";


export const router = createBrowserRouter([
    {path: "/host/events/new", element: (
            <RequireRole role="host">
                <EventCreatePage />
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
    { path: "/signin", element: <SignInPage /> },
    { path: "/register", element: <RegisterPage /> },
    { path: "/leaderboard", element: <LeaderboardPage /> },
]);
