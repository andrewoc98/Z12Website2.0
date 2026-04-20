import admin from "firebase-admin";
import serviceAccount from "./z12-website-prod-firebase-adminsdk-fbsvc-cec4dfc942.json" assert { type: "json" };

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const eventUid = "TESTEVENTRUNNING"; // Must be unique
const createdByUid = "kFUbTKUCtZM6iiQLvYUHNAngPsh1"; // Must be real host

// List all 206 categories
const categories = [
    { id: "Men • Junior 14 • 4x+", name: "Men • Junior 14 • 4x+" },
    { id: "Men • Junior 14 • 2x", name: "Men • Junior 14 • 2x" },
    { id: "Women • Junior 14 • 4x+", name: "Women • Junior 14 • 4x+" },
    { id: "Women • Junior 14 • 2x", name: "Women • Junior 14 • 2x" },
    { id: "Men • Junior 15 • 4x+", name: "Men • Junior 15 • 4x+" },
    { id: "Men • Junior 15 • 2x", name: "Men • Junior 15 • 2x" },
    { id: "Women • Junior 15 • 4x+", name: "Women • Junior 15 • 4x+" },
    { id: "Women • Junior 15 • 2x", name: "Women • Junior 15 • 2x" },
    { id: "Men • Junior 16 • 1x", name: "Men • Junior 16 • 1x" },
    { id: "Men • Junior 16 • 2x", name: "Men • Junior 16 • 2x" },
    { id: "Women • Junior 16 • 1x", name: "Women • Junior 16 • 1x" },
    { id: "Women • Junior 16 • 2x", name: "Women • Junior 16 • 2x" },
    { id: "Women • U19 60kg • 1x", name: "Women • U19 60kg • 1x" },
    { id: "Women • U19 60kg • 2-", name: "Women • U19 60kg • 2-" },
    { id: "Men • U19 70kg • 1x", name: "Men • U19 70kg • 1x" },
    { id: "Men • U19 70kg • 2-", name: "Men • U19 70kg • 2-" },
    { id: "Women • U19 70kg • 1x", name: "Women • U19 70kg • 1x" },
    { id: "Women • U19 70kg • 2-", name: "Women • U19 70kg • 2-" },
    { id: "Men • U19 80kg • 1x", name: "Men • U19 80kg • 1x" },
    { id: "Men • U19 80kg • 2-", name: "Men • U19 80kg • 2-" },
    { id: "Men • U19 Open • 1x", name: "Men • U19 Open • 1x" },
    { id: "Men • U19 Open • 2-", name: "Men • U19 Open • 2-" },
    { id: "Women • U19 Open • 1x", name: "Women • U19 Open • 1x" },
    { id: "Women • U19 Open • 2-", name: "Women • U19 Open • 2-" },
    { id: "Women • U21 60kg • 1x", name: "Women • U21 60kg • 1x" },
    { id: "Women • U21 60kg • 2-", name: "Women • U21 60kg • 2-" },
    { id: "Men • U21 70kg • 1x", name: "Men • U21 70kg • 1x" },
    { id: "Men • U21 70kg • 2-", name: "Men • U21 70kg • 2-" },
    { id: "Women • U21 70kg • 1x", name: "Women • U21 70kg • 1x" },
    { id: "Women • U21 70kg • 2-", name: "Women • U21 70kg • 2-" },
    { id: "Men • U21 80kg • 1x", name: "Men • U21 80kg • 1x" },
    { id: "Men • U21 80kg • 2-", name: "Men • U21 80kg • 2-" },
    { id: "Men • U21 Open • 1x", name: "Men • U21 Open • 1x" },
    { id: "Men • U21 Open • 2-", name: "Men • U21 Open • 2-" },
    { id: "Women • U21 Open • 1x", name: "Women • U21 Open • 1x" },
    { id: "Women • U21 Open • 2-", name: "Women • U21 Open • 2-" },
    { id: "Women • U23 60kg • 1x", name: "Women • U23 60kg • 1x" },
    { id: "Women • U23 60kg • 2-", name: "Women • U23 60kg • 2-" },
    { id: "Men • U23 70kg • 1x", name: "Men • U23 70kg • 1x" },
    { id: "Men • U23 70kg • 2-", name: "Men • U23 70kg • 2-" },
    { id: "Women • U23 70kg • 1x", name: "Women • U23 70kg • 1x" },
    { id: "Women • U23 70kg • 2-", name: "Women • U23 70kg • 2-" },
    { id: "Men • U23 80kg • 1x", name: "Men • U23 80kg • 1x" },
    { id: "Men • U23 80kg • 2-", name: "Men • U23 80kg • 2-" },
    { id: "Men • U23 Open • 1x", name: "Men • U23 Open • 1x" },
    { id: "Men • U23 Open • 2-", name: "Men • U23 Open • 2-" },
    { id: "Women • U23 Open • 1x", name: "Women • U23 Open • 1x" },
    { id: "Women • U23 Open • 2-", name: "Women • U23 Open • 2-" },
    { id: "Women • Senior 60kg • 1x", name: "Women • Senior 60kg • 1x" },
    { id: "Women • Senior 60kg • 2-", name: "Women • Senior 60kg • 2-" },
    { id: "Men • Senior 70kg • 1x", name: "Men • Senior 70kg • 1x" },
    { id: "Men • Senior 70kg • 2-", name: "Men • Senior 70kg • 2-" },
    { id: "Women • Senior 70kg • 1x", name: "Women • Senior 70kg • 1x" },
    { id: "Women • Senior 70kg • 2-", name: "Women • Senior 70kg • 2-" },
    { id: "Men • Senior 80kg • 1x", name: "Men • Senior 80kg • 1x" },
    { id: "Men • Senior 80kg • 2-", name: "Men • Senior 80kg • 2-" },
    { id: "Men • Senior Open • 1x", name: "Men • Senior Open • 1x" },
    { id: "Men • Senior Open • 2-", name: "Men • Senior Open • 2-" },
    { id: "Women • Senior Open • 1x", name: "Women • Senior Open • 1x" },
    { id: "Women • Senior Open • 2-", name: "Women • Senior Open • 2-" },
    { id: "Women • Masters A 60kg • 1x", name: "Women • Masters A 60kg • 1x" },
    { id: "Women • Masters A 60kg • 2x", name: "Women • Masters A 60kg • 2x" },
    { id: "Women • Masters A 60kg • 4x+", name: "Women • Masters A 60kg • 4x+" },
    { id: "Women • Masters A 60kg • 2-", name: "Women • Masters A 60kg • 2-" },
    { id: "Men • Masters A 70kg • 1x", name: "Men • Masters A 70kg • 1x" },
    { id: "Men • Masters A 70kg • 2x", name: "Men • Masters A 70kg • 2x" },
    { id: "Men • Masters A 70kg • 4x+", name: "Men • Masters A 70kg • 4x+" },
    { id: "Men • Masters A 70kg • 2-", name: "Men • Masters A 70kg • 2-" },
    { id: "Women • Masters A 70kg • 1x", name: "Women • Masters A 70kg • 1x" },
    { id: "Women • Masters A 70kg • 2x", name: "Women • Masters A 70kg • 2x" },
    { id: "Women • Masters A 70kg • 4x+", name: "Women • Masters A 70kg • 4x+" },
    { id: "Women • Masters A 70kg • 2-", name: "Women • Masters A 70kg • 2-" },
    { id: "Men • Masters A 80kg • 1x", name: "Men • Masters A 80kg • 1x" },
    { id: "Men • Masters A 80kg • 2x", name: "Men • Masters A 80kg • 2x" },
    { id: "Men • Masters A 80kg • 4x+", name: "Men • Masters A 80kg • 4x+" },
    { id: "Men • Masters A 80kg • 2-", name: "Men • Masters A 80kg • 2-" },
    { id: "Men • Masters A Open • 1x", name: "Men • Masters A Open • 1x" },
    { id: "Men • Masters A Open • 2x", name: "Men • Masters A Open • 2x" },
    { id: "Men • Masters A Open • 4x+", name: "Men • Masters A Open • 4x+" },
    { id: "Men • Masters A Open • 2-", name: "Men • Masters A Open • 2-" },
    { id: "Women • Masters A Open • 1x", name: "Women • Masters A Open • 1x" },
    { id: "Women • Masters A Open • 2x", name: "Women • Masters A Open • 2x" },
    { id: "Women • Masters A Open • 4x+", name: "Women • Masters A Open • 4x+" },
    { id: "Women • Masters A Open • 2-", name: "Women • Masters A Open • 2-" },
    { id: "Women • Masters B 60kg • 1x", name: "Women • Masters B 60kg • 1x" },
    { id: "Women • Masters B 60kg • 2x", name: "Women • Masters B 60kg • 2x" },
    { id: "Women • Masters B 60kg • 4x+", name: "Women • Masters B 60kg • 4x+" },
    { id: "Women • Masters B 60kg • 2-", name: "Women • Masters B 60kg • 2-" },
    { id: "Men • Masters B 70kg • 1x", name: "Men • Masters B 70kg • 1x" },
    { id: "Men • Masters B 70kg • 2x", name: "Men • Masters B 70kg • 2x" },
    { id: "Men • Masters B 70kg • 4x+", name: "Men • Masters B 70kg • 4x+" },
    { id: "Men • Masters B 70kg • 2-", name: "Men • Masters B 70kg • 2-" },
    { id: "Women • Masters B 70kg • 1x", name: "Women • Masters B 70kg • 1x" },
    { id: "Women • Masters B 70kg • 2x", name: "Women • Masters B 70kg • 2x" },
    { id: "Women • Masters B 70kg • 4x+", name: "Women • Masters B 70kg • 4x+" },
    { id: "Women • Masters B 70kg • 2-", name: "Women • Masters B 70kg • 2-" },
    { id: "Men • Masters B 80kg • 1x", name: "Men • Masters B 80kg • 1x" },
    { id: "Men • Masters B 80kg • 2x", name: "Men • Masters B 80kg • 2x" },
    { id: "Men • Masters B 80kg • 4x+", name: "Men • Masters B 80kg • 4x+" },
    { id: "Men • Masters B 80kg • 2-", name: "Men • Masters B 80kg • 2-" },
    { id: "Men • Masters B Open • 1x", name: "Men • Masters B Open • 1x" },
    { id: "Men • Masters B Open • 2x", name: "Men • Masters B Open • 2x" },
    { id: "Men • Masters B Open • 4x+", name: "Men • Masters B Open • 4x+" },
    { id: "Men • Masters B Open • 2-", name: "Men • Masters B Open • 2-" },
    { id: "Women • Masters B Open • 1x", name: "Women • Masters B Open • 1x" },
    { id: "Women • Masters B Open • 2x", name: "Women • Masters B Open • 2x" },
    { id: "Women • Masters B Open • 4x+", name: "Women • Masters B Open • 4x+" },
    { id: "Women • Masters B Open • 2-", name: "Women • Masters B Open • 2-" },
    { id: "Women • Masters C 60kg • 1x", name: "Women • Masters C 60kg • 1x" },
    { id: "Women • Masters C 60kg • 2x", name: "Women • Masters C 60kg • 2x" },
    { id: "Mixed • Para • 4x+", name: "Mixed • Para • 4x+" },
    { id: "Mixed • Para • 2x", name: "Mixed • Para • 2x" }
];

console.log("Creating event document...");

async function createEvent() {
    const eventRef = db.collection("events").doc(eventUid);

    const eventStart = new Date("2026-02-01T12:00:00Z");

    console.log("Creating event document...");

    await eventRef.set({
        name: "Running Test Event",
        location: "Dublin",
        startAt: admin.firestore.Timestamp.fromDate(eventStart),
        endAt: admin.firestore.Timestamp.fromDate(new Date("2027-02-28T12:00:00Z")),
        closeAt: admin.firestore.Timestamp.fromDate(new Date("2026-02-27T12:00:00Z")),
        categories: categories.map(c => ({ id: c.id, name: c.name })),
        createdByUid,
        createdByName: "andrewdarraghoconnor@gmail.com",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        status: "running",
        statusUpdatedAt: admin.firestore.Timestamp.now(),
        lengthMeters: 3000
    });

    console.log("Generating boats and rowers...");

    // 🔑 Helper: determine crew size
    function getCrewSize(categoryName) {
        if (categoryName.includes("1x")) return 1;
        if (categoryName.includes("2x") || categoryName.includes("2-")) return 2;
        if (categoryName.includes("4x+")) return 4;
        return 1;
    }

    // 🔑 Helper: generate invite code
    function generateInviteCode(length = 12) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let code = "";
        for (let i = 0; i < length; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    for (const category of categories) {
        console.log("Processing category:", category.name);

        for (let i = 1; i <= 20; i++) {
            const boatRef = eventRef.collection("boats").doc();
            const boatId = boatRef.id;

            const crewSize = getCrewSize(category.name);

            // Decide status
            let status = Math.random() < 0.35 ? "pending_crew" : "registered";

            // 🚨 1x boats cannot be pending
            if (crewSize === 1) {
                status = "registered";
            }

            // Decide actual crew count
            let actualCrewSize;
            if (status === "registered") {
                actualCrewSize = crewSize;
            } else {
                actualCrewSize = Math.floor(Math.random() * (crewSize - 1)) + 1;
            }

            const rowerUids = [];

            for (let j = 0; j < actualCrewSize; j++) {
                const rowerUid = `rower_${category.id}_${i}_${j}`;
                rowerUids.push(rowerUid);

                await eventRef.collection("rowerCategorySignups").doc(rowerUid).set({
                    boatId,
                    categoryId: category.id,
                    uid: rowerUid,
                    status,
                    createdAt: admin.firestore.Timestamp.now()
                });
            }

            // ✅ Validation (important safety)
            if (
                (status === "registered" && rowerUids.length !== crewSize) ||
                (status === "pending_crew" && rowerUids.length >= crewSize)
            ) {
                throw new Error(`Invalid crew size for ${category.name}`);
            }

            // Create boat document (matching prod)
            const boatData = {
                id: boatId,
                eventId: eventUid,
                category: category.name,
                categoryId: category.id,
                categoryName: category.name,
                clubName: "Neptune",
                boatSize: crewSize,
                rowerUids,
                status,
                inviteCode: generateInviteCode(),
                invitedEmails: [],
                adjustmentMs: 0,
                createdAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now()
            };

            await boatRef.set(boatData);
        }
    }

    console.log("✅ Event, boats, and rowers created successfully!");
    process.exit(0);
}

createEvent().catch(error => {
    console.error("❌ Error creating test event:", error);
    process.exit(1);
});