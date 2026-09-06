/**
 * Push registration for the native app shell (Z12-app), which loads this site in a WebView.
 *
 * The shell subscribes itself to the broadcast `events` topic, but topics can't be
 * filtered — to send a push to some people and not others (the 24-hour closing reminder
 * skips anyone already in a boat) the backend needs to know which user is on which device.
 * That's what this does: hand the FCM token to `registerDevice` whenever someone signs in,
 * and drop it again on sign-out.
 *
 * In a normal browser `Capacitor.isNativePlatform()` is false and every call here is a no-op.
 */

import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

const call = <Req, Res>(name: string) =>
    async (data: Req): Promise<Res> => {
        const fn = httpsCallable<Req, Res>(functions, name);
        return (await fn(data)).data;
    };

const registerDevice = call<{ token: string; platform: string }, { success: true }>("registerDevice");
const unregisterDevice = call<{ token: string }, { success: true }>("unregisterDevice");

let activeUid: string | null = null;
let currentToken: string | null = null;
let listeners: PluginListenerHandle[] = [];

/**
 * Point the device's push token at `uid`, or release it when `uid` is null.
 * Safe to call on every auth state change — repeat calls for the same uid do nothing.
 */
export function syncNativePush(uid: string | null): void {
    if (!Capacitor.isNativePlatform()) return;
    if (uid === activeUid) return;

    const previousUid = activeUid;
    activeUid = uid;

    if (!uid) {
        void releaseToken();
        return;
    }

    // Signed in as somebody new on the same device: the token moves with the new user, and
    // registerDevice detaches it from the old one server-side.
    if (previousUid && currentToken) {
        void registerDevice({ token: currentToken, platform: Capacitor.getPlatform() })
            .catch((e) => console.error("Failed to move device registration", e));
        return;
    }

    void attach();
}

async function attach(): Promise<void> {
    try {
        let permission = await PushNotifications.checkPermissions();
        if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
            permission = await PushNotifications.requestPermissions();
        }
        if (permission.receive !== "granted") {
            console.warn("Push permission not granted");
            return;
        }

        if (listeners.length === 0) {
            listeners = await Promise.all([
                PushNotifications.addListener("registration", (token) => {
                    currentToken = token.value;
                    if (!activeUid) return;
                    void registerDevice({ token: token.value, platform: Capacitor.getPlatform() })
                        .catch((e) => console.error("Failed to register device for push", e));
                }),
                PushNotifications.addListener("registrationError", (err) => {
                    console.error("Push registration error:", err);
                }),
                PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
                    const url = action.notification.data?.url;
                    if (typeof url === "string" && url) window.location.href = url;
                }),
            ]);
        }

        await PushNotifications.register();
    } catch (e) {
        console.error("Failed to set up push notifications", e);
    }
}

async function releaseToken(): Promise<void> {
    const token = currentToken;
    if (!token) return;
    try {
        await unregisterDevice({ token });
    } catch (e) {
        console.error("Failed to unregister device for push", e);
    }
}
