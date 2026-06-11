import React from "react";

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

const Modal: React.FC<ModalProps> = ({ title, message, onClose, actions = [] }) => {
    return (
        <div
            className="fixed inset-0 bg-black/65 backdrop-blur-[4px] flex justify-center items-center z-[1000] p-[16px]"
            onClick={onClose}
        >
            <div
                className="w-[min(420px,100%)] bg-surface border border-border rounded-DEFAULT shadow-DEFAULT px-[18px] py-5 text-center animate-[modal-in_0.18s_ease-out]"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="mb-2">{title}</h3>
                <p className="mb-[18px] text-muted">{message}</p>

                <div className="flex justify-center gap-[10px] flex-wrap">
                    {actions.map((action, index) => (
                        <button
                            key={index}
                            className={`min-w-[110px] ${action.variant === "primary" ? "btn-primary" : "btn-ghost"}`}
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
