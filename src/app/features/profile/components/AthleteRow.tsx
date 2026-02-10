import { useNavigate } from "react-router-dom";

type Props = {
    athlete: any;
    onApprove?: () => void;
    onReject?: () => void;
};

export default function AthleteRow({
                                       athlete,
                                       onApprove,
                                       onReject
                                   }: Props) {

    const navigate = useNavigate();

    const name =
        athlete.displayName ??
        athlete.fullName ??
        athlete.rowerId;

    return (
        <div className="athlete-row">

            {/* CLICKABLE PROFILE AREA */}
            <div
                className="athlete-main"
                onClick={() => navigate(`/community/${athlete.uid ?? athlete.rowerId}`)}
            >
                <div className="avatar">
                    {name?.[0]?.toUpperCase()}
                </div>

                <div className="athlete-info">
                    <div className="athlete-name">{name}</div>

                    <div className="muted">
                        {athlete.roles?.rower?.club ?? "No club info"}
                    </div>
                </div>
            </div>

            {/* ACTION BUTTONS */}
            <div
                className="athlete-actions"
                onClick={(e) => e.stopPropagation()}
            >
                {onApprove && (
                    <button className="btn btn--ok" onClick={onApprove}>
                        Approve
                    </button>
                )}

                {onReject && (
                    <button className="btn btn--danger" onClick={onReject}>
                        Reject
                    </button>
                )}
            </div>

        </div>
    );
}
