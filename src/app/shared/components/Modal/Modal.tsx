// Modal.tsx
import React from "react";
import "./Modal.css";

type ModalAction = {
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary";
};

type ModalProps = {
    title: string;
    message: string;
    onClose: () => void;
    actions?: ModalAction[];
};

const Modal: React.FC<ModalProps> = ({
                                         title,
                                         message,
                                         onClose,
                                         actions = [],
                                     }) => {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
            >
                <h3 className="modal-title">{title}</h3>
                <p className="modal-message">{message}</p>

                <div className="modal-actions">
                    {actions.map((action, index) => (
                        <button
                            key={index}
                            className={`modal-btn ${action.variant || "secondary"}`}
                            onClick={action.onClick}
                        >
                            {action.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Modal;