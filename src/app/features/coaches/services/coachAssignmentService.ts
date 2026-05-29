import { httpsCallable } from "firebase/functions";
import { functions } from "../../../shared/lib/firebase";
import type { CoachRole } from "../constants/coachRoles";

type AssignResult = { assignmentId: string; status: "active" | "pending" };

const call = <Req, Res>(name: string) =>
    async (data: Req): Promise<Res> => {
        const fn = httpsCallable<Req, Res>(functions, name);
        return (await fn(data)).data;
    };

export const assignCoach = call<
    { coachId: string; clubId: string; roles: CoachRole[] },
    AssignResult
>("assignCoach");

export const approveAssignment = call<
    { rowerId: string; assignmentId: string },
    { success: true }
>("approveCoachAssignment");

export const declineAssignment = call<
    { rowerId: string; assignmentId: string },
    { success: true }
>("declineCoachAssignment");

export const removeAssignment = call<
    { assignmentId: string },
    { success: true }
>("removeCoachAssignment");

export const updateRoles = call<
    { assignmentId: string; roles: CoachRole[] },
    { success: true }
>("updateAssignmentRoles");

export const setOpenAssignment = call<
    { openAssignment: boolean },
    { success: true }
>("setOpenAssignment");
