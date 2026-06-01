import "./RoleBadge.css";

type UserRole =
    | "rower"
    | "coach"
    | "clubAdmin"
    | "federationAdmin"
    | "platformAdmin"
    | "host"
    | "admin"
    | "guardian";

const LABELS: Record<UserRole, string> = {
    rower:           "Rower",
    coach:           "Coach",
    clubAdmin:       "Club Admin",
    federationAdmin: "Fed Admin",
    platformAdmin:   "Platform Admin",
    host:            "Host",
    admin:           "Admin",
    guardian:        "Guardian",
};

type Props = {
    role: UserRole;
};

export default function RoleBadge({ role }: Props) {
    return (
        <span className={`role-badge role-badge--${role}`}>
            {LABELS[role] ?? role}
        </span>
    );
}
