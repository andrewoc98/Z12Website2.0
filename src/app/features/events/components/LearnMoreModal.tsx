import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

import "../styles/HomePage.css";

type Props = {
    open: boolean;
    title: string;
    content: string;
    onClose: () => void;
};

export default function LearnMoreModal({
                                           open,
                                           title,
                                           content,
                                           onClose,
                                       }: Props) {

    const ref = useRef<HTMLDivElement>(null);

    // ESC key close
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }

        if (open) document.addEventListener("keydown", onKey);

        return () => document.removeEventListener("keydown", onKey);
    }, [open]);

    // BODY SCROLL LOCK
    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
    }, [open]);

    // focus modal when opened
    useEffect(() => {
        if (open) ref.current?.focus();
    }, [open]);

    const modal = (
        <AnimatePresence>
            {open && (
                <div className="modal-root">

                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    <motion.div
                        ref={ref}
                        tabIndex={-1}
                        className="modal-window"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.18 }}
                    >
                        <h3>{title}</h3>

                        <p>{content}</p>

                        <button className="btn-primary" onClick={onClose}>
                            Close
                        </button>
                    </motion.div>

                </div>
            )}
        </AnimatePresence>
    );

    return createPortal(modal, document.body);
}
