// Format rower names according to rowing norms
export function formatRowerNames(rowerUids: string[], userProfiles: Record<string, any>, boatSize: number): string {
    if (rowerUids.length === 0) return "Unknown";

    const names = rowerUids.map(uid => {
        const profile = userProfiles[uid];
        if (!profile) return "Unknown";
        const firstInitial = profile.displayName?.charAt(0) || "?";
        const lastName = profile.displayName?.split(" ").slice(-1)[0] || "Unknown";
        return `${firstInitial}. ${lastName}`;
    });

    if (boatSize === 1) {
        return names[0] || "Unknown";
    } else if (boatSize === 2) {
        return names.length >= 2 ? `${names[0]} / ${names[1]}` : names[0] || "Unknown";
    } else if (boatSize === 4) {
        return names.slice(0, 4).join(" / ");
    } else {
        // For 8, but user said no eights, but display club name + bow number
        return "Club Name + Bow"; // Placeholder
    }
}

// Format elapsed time
export function formatElapsedTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

// Get live elapsed time
export function getLiveElapsed(startedAt: number): number {
    return Date.now() - startedAt;
}

// Sort boats by bow number
export function sortBoatsByBowNumber(boats: any[]): any[] {
    return boats.slice().sort((a, b) => (a.bowNumber || 0) - (b.bowNumber || 0));
}

// Group boats by category
export function groupBoatsByCategory(boats: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {};
    boats.forEach(boat => {
        const catId = boat.categoryId;
        if (!groups[catId]) groups[catId] = [];
        groups[catId].push(boat);
    });
    return groups;
}