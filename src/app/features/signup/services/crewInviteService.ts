import { httpsCallable } from "firebase/functions";
import { functions } from "../../../shared/lib/firebase";

type ClubRower = { uid: string; displayName: string; clubName: string };

const call = <Req, Res>(name: string) =>
    async (data: Req): Promise<Res> => {
        const fn = httpsCallable<Req, Res>(functions, name);
        return (await fn(data)).data;
    };

export const listClubRowers = call<
    { eventId: string; boatId?: string; categoryId?: string; categoryName: string },
    { rowers: ClubRower[] }
>("listClubRowers");

export const addClubAthleteToBoat = call<
    { eventId: string; boatId: string; athleteUid: string },
    { success: boolean }
>("addClubAthleteToBoat");

export const removeCrewMemberAsCreator = call<
    { eventId: string; boatId: string; targetUid: string },
    { success: boolean }
>("removeCrewMemberAsCreator");
