import { useNavigate } from "react-router-dom";
import "../style/profile.css"

type Props = {
    user: any;
    relationship?: any;
    currentUser?: any;
    onApprove?: (rel:any)=>void;
    onReject?: (rel:any)=>void;
};

export default function RelationshipCard({
                                             user,
                                             relationship,
                                             currentUser,
                                             onApprove,
                                             onReject
                                         }: Props) {

    const navigate = useNavigate();

    const name =
        user.displayName ??
        user.fullName ??
        user.uid;

    const status = relationship?.status;

    const isPending =
        status === "pending";

    const showActions =
        isPending &&
        relationship?.coachId === currentUser?.uid;

    return (
        <div className="relationship-card">

            <div
                className="relationship-main"
                onClick={() => navigate(`/community/${user.uid}`)}
            >
                <div className="avatar">
                    {name?.[0]?.toUpperCase()}
                </div>

                <div>
                    <div className="relationship-name">{name}</div>
                    <div className="muted">
                        {user.roles?.rower?.club ||
                            user.roles?.coach?.club ||
                            "—"}
                    </div>
                </div>
            </div>

            <div className="relationship-actions">

                {status === "approved" && (
                    <span className="chip chip--green">Connected</span>
                )}

                {isPending && !showActions && (
                    <span className="chip chip--soft">Pending</span>
                )}

                {showActions && (
                    <>
                        <button
                            className="btn btn--primary"
                            onClick={() => onApprove?.(relationship)}
                        >
                            Accept
                        </button>

                        <button
                            className="btn btn--ghost"
                            onClick={() => onReject?.(relationship)}
                        >
                            Reject
                        </button>
                    </>
                )}

            </div>

        </div>
    );
}
