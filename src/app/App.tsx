import { Suspense } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";

export default function App() {
    return (
        <Suspense fallback={null}>
            <RouterProvider router={router} />
        </Suspense>
    );
}

