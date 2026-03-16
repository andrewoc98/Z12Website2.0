import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";

import { AuthProvider } from "./app/providers/AuthProvider";
import { RoleProvider } from "./app/providers/RoleProvider";

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
