export const COACH_ROLES = [
    { value: 'head_coach',          label: 'Head Coach' },
    { value: 'assistant_coach',     label: 'Assistant Coach' },
    { value: 'sc_coach',            label: 'S&C Coach' },
    { value: 'nutritionist',        label: 'Nutritionist' },
    { value: 'physiotherapist',     label: 'Physiotherapist' },
    { value: 'sports_psychologist', label: 'Sports Psychologist' },
    { value: 'rowing_technician',   label: 'Rowing Technician' },
    { value: 'video_analyst',       label: 'Video Analyst' },
    { value: 'medical_officer',     label: 'Medical Officer' },
    { value: 'team_manager',        label: 'Team Manager' },
] as const;

export type CoachRole = typeof COACH_ROLES[number]['value'];

export const COACH_ROLE_LABELS: Record<CoachRole, string> = Object.fromEntries(
    COACH_ROLES.map(r => [r.value, r.label]),
) as Record<CoachRole, string>;
