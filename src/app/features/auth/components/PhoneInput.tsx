import { useEffect, useRef, useState } from "react";
import "../styles/phoneInput.css";

const COUNTRY_CODES = [
    { code: "+353", flag: "🇮🇪", label: "Ireland" },
    { code: "+354", flag: "🇮🇸", label: "Iceland" },
    { code: "+358", flag: "🇫🇮", label: "Finland" },
    { code: "+359", flag: "🇧🇬", label: "Bulgaria" },
    { code: "+44",  flag: "🇬🇧", label: "UK" },
    { code: "+49",  flag: "🇩🇪", label: "Germany" },
    { code: "+33",  flag: "🇫🇷", label: "France" },
    { code: "+34",  flag: "🇪🇸", label: "Spain" },
    { code: "+39",  flag: "🇮🇹", label: "Italy" },
    { code: "+31",  flag: "🇳🇱", label: "Netherlands" },
    { code: "+32",  flag: "🇧🇪", label: "Belgium" },
    { code: "+41",  flag: "🇨🇭", label: "Switzerland" },
    { code: "+43",  flag: "🇦🇹", label: "Austria" },
    { code: "+61",  flag: "🇦🇺", label: "Australia" },
    { code: "+64",  flag: "🇳🇿", label: "New Zealand" },
    { code: "+27",  flag: "🇿🇦", label: "South Africa" },
    { code: "+91",  flag: "🇮🇳", label: "India" },
    { code: "+86",  flag: "🇨🇳", label: "China" },
    { code: "+81",  flag: "🇯🇵", label: "Japan" },
    { code: "+82",  flag: "🇰🇷", label: "South Korea" },
    { code: "+55",  flag: "🇧🇷", label: "Brazil" },
    { code: "+52",  flag: "🇲🇽", label: "Mexico" },
    { code: "+1",   flag: "🇺🇸", label: "US / Canada" },
];

const SORTED_CODES = [...COUNTRY_CODES].sort(
    (a, b) => b.code.length - a.code.length
);

function parsePhoneValue(v: string): { dialCode: string; local: string } {
    if (!v) return { dialCode: "+353", local: "" };
    const match = SORTED_CODES.find(c => v.startsWith(c.code));
    if (match) return { dialCode: match.code, local: v.slice(match.code.length).trimStart() };
    return { dialCode: "+353", local: v };
}

interface PhoneInputProps {
    value: string;
    onChange: (value: string, isValid: boolean) => void;
    placeholder?: string;
}

export function PhoneInput({ value, onChange, placeholder = "87 123 4567" }: PhoneInputProps) {
    const [dialCode, setDialCode] = useState(() => parsePhoneValue(value).dialCode);
    const [local, setLocal] = useState(() => parsePhoneValue(value).local);
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const parsed = parsePhoneValue(value);
        setDialCode(parsed.dialCode);
        setLocal(parsed.local);
    }, [value]);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    function emit(dial: string, loc: string) {
        const digits = loc.replace(/\s/g, "");
        const isValid = digits.length >= 7 && digits.length <= 15;
        onChange(dial + " " + loc.trim(), isValid);
    }

    function handleSelect(code: string) {
        setDialCode(code);
        setOpen(false);
        emit(code, local);
    }

    function handleLocalChange(e: React.ChangeEvent<HTMLInputElement>) {
        const cleaned = e.target.value.replace(/[^\d\s]/g, "").slice(0, 20);
        setLocal(cleaned);
        emit(dialCode, cleaned);
    }

    const selected = COUNTRY_CODES.find(c => c.code === dialCode) ?? COUNTRY_CODES[0];
    const digits = local.replace(/\s/g, "");
    const isValid = digits.length >= 7 && digits.length <= 15;
    const showError = local.length > 0 && !isValid;

    return (
        <div className="phone-input-wrapper" ref={wrapperRef}>
            <div className="phone-input-row">

                {/* Custom dial-code picker */}
                <div className="phone-dial-wrapper">
                    <button
                        type="button"
                        className="phone-dial-trigger"
                        onClick={() => setOpen(v => !v)}
                        aria-haspopup="listbox"
                        aria-expanded={open}
                    >
                        <span className="phone-dial-flag">{selected.flag}</span>
                        <span className="phone-dial-code">{selected.code}</span>
                        <span className="phone-dial-caret" aria-hidden="true">▾</span>
                    </button>

                    {open && (
                        <ul className="phone-dial-dropdown" role="listbox">
                            {COUNTRY_CODES.map(c => (
                                <li
                                    key={c.code + c.label}
                                    role="option"
                                    aria-selected={c.code === dialCode}
                                    className={`phone-dial-option ${c.code === dialCode ? "selected" : ""}`}
                                    onMouseDown={() => handleSelect(c.code)}
                                >
                                    <span className="phone-dial-flag">{c.flag}</span>
                                    <span className="phone-dial-option-label">{c.label}</span>
                                    <span className="phone-dial-option-code">{c.code}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <input
                    className={`phone-local-input ${showError ? "input-error" : ""}`}
                    type="tel"
                    inputMode="numeric"
                    value={local}
                    onChange={handleLocalChange}
                    placeholder={placeholder}
                />
            </div>

            {showError && (
                <p className="field-error">Please enter a valid phone number (7–15 digits).</p>
            )}
        </div>
    );
}