import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import "../styles/GlobalModal.css";

type Props = {
    open: boolean;
    title?: string;
    children?: React.ReactNode;
    onClose: () => void;
};

export default function GlobalModal({
                                        open,
                                        title,
                                        children,
                                        onClose,
                                    }: Props) {

    const ref = useRef<HTMLDivElement>(null);

    // ESC close
    useEffect(() => {
        function handle(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }

        if (open) document.addEventListener("keydown", handle);

        return () => document.removeEventListener("keydown", handle);
    }, [open]);

    // scroll lock
    useEffect(() => {
        document.body.style.overflow = open ? "hidden" : "";
    }, [open]);

    // focus modal
    useEffect(() => {
        if (open) ref.current?.focus();
    }, [open]);

    return createPortal(
        <AnimatePresence>
            {open && (
                <div className="modal-root">

                    <motion.div
                        className="modal-overlay"
                        onClick={onClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />

                    <motion.div
                        ref={ref}
                        tabIndex={-1}
                        className="modal-window"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2 }}
                    >
                        {title && <h3>{title}</h3>}

                        {children}

                        <button className="btn-primary" onClick={onClose}>
                            Close
                        </button>

                    </motion.div>

                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
