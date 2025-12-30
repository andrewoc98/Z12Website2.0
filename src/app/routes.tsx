import { createBrowserRouter } from "react-router-dom";
import HomePage from "../app/features/events/pages/HomePage";
import SignInPage from "../app/features/auth/pages/SignInPage";
import RegisterPage from "../app/features/auth/pages/RegisterPage";
import LeaderboardPage from "../app/features/leaderboard/pages/LeaderboardPage";

export const router = createBrowserRouter([
    { path: "/", element: <HomePage /> },
    { path: "/signin", element: <SignInPage /> },
    { path: "/register", element: <RegisterPage /> },
    { path: "/leaderboard", element: <LeaderboardPage /> },
]);
