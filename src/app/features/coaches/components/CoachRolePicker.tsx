import { COACH_ROLES, type CoachRole } from "../constants/coachRoles";
import "../coaches.css";

interface Props {
    selected: CoachRole[];
    onChange: (roles: CoachRole[]) => void;
}

export function CoachRolePicker({ selected, onChange }: Props) {
    function toggle(role: CoachRole) {
        onChange(
            selected.includes(role)
                ? selected.filter(r => r !== role)
                : [...selected, role],
        );
    }

    return (
        <div className="ca-role-picker">
            {COACH_ROLES.map(({ value, label }) => {
                const isSelected = selected.includes(value);
                return (
                    <button
                        key={value}
                        type="button"
                        className={`ca-role-chip${isSelected ? " ca-role-chip--selected" : ""}`}
                        onClick={() => toggle(value)}
                    >
                        <span className="ca-role-chip__check">{isSelected ? "✓" : ""}</span>
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
