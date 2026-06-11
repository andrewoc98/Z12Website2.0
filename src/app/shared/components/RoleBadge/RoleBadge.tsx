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

const COLORS: Record<UserRole, string> = {
    rower:           "bg-brand/15 text-brand border-brand/35",
    coach:           "bg-[#60a5fa]/15 text-[#60a5fa] border-[#60a5fa]/35",
    clubAdmin:       "bg-[#34d399]/15 text-[#34d399] border-[#34d399]/35",
    federationAdmin: "bg-[#a78bfa]/15 text-[#a78bfa] border-[#a78bfa]/35",
    platformAdmin:   "bg-brand-warm/15 text-brand-warm border-brand-warm/35",
    host:            "bg-[#2dd4bf]/15 text-[#2dd4bf] border-[#2dd4bf]/35",
    admin:           "bg-white/7 text-white/55 border-white/12",
    guardian:        "bg-white/7 text-white/55 border-white/12",
};

type Props = {
    role: UserRole;
};

export default function RoleBadge({ role }: Props) {
    return (
        <span className={`inline-flex items-center text-[11px] font-bold tracking-[0.6px] uppercase px-[9px] py-[3px] rounded-full border whitespace-nowrap leading-[1.4] ${COLORS[role]}`}>
            {LABELS[role] ?? role}
        </span>
    );
}
