import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { DEV_MODE } from "./app/shared/lib/config";

import { AuthProvider } from "./app/providers/AuthProvider";
import { RoleProvider } from "./app/providers/RoleProvider";

import { MockAuthProvider } from "./app/providers/MockAuthProvider";
import { MockRoleProvider } from "./app/providers/MockRoleProvider";

import "./app/shared/styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        {DEV_MODE ? (
            <MockAuthProvider>
                <MockRoleProvider>
                    <App />
                </MockRoleProvider>
            </MockAuthProvider>
        ) : (
            <AuthProvider>
                <RoleProvider>
                    <App />
                </RoleProvider>
            </AuthProvider>
        )}
    </React.StrictMode>
);
