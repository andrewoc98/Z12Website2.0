import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";

// When a new deploy changes chunk hashes, old cached HTML references chunks
// that no longer exist. Vite fires this event instead of throwing; we reload
// so the browser fetches fresh HTML with the correct chunk URLs.
window.addEventListener('vite:preloadError', () => {
    window.location.reload();
});

import { AuthProvider } from "./app/providers/AuthProvider";
import { RoleProvider } from "./app/providers/RoleProvider";

import "./app/shared/styles/tailwind.css";
import "./app/shared/styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
            <AuthProvider>
                <RoleProvider>
                    <App />
                </RoleProvider>
            </AuthProvider>
    </React.StrictMode>
);
