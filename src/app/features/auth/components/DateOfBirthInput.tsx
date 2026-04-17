import { useState, useEffect } from "react";

type DateOfBirthInputProps = {
    value: string; // expected format: YYYY-MM-DD
    onChange: (date: string) => void;
};

export default function DateOfBirthInput({ value, onChange }: DateOfBirthInputProps) {
    const [day, setDay] = useState<string>("");
    const [month, setMonth] = useState<string>("");
    const [year, setYear] = useState<string>("");

    useEffect(() => {
        if (value) {
            const [y, m, d] = value.split("-");
            setDay(d || "");
            setMonth(m || "");
            setYear(y || "");
        }
    }, [value]);

    const updateDOB = (d: string, m: string, y: string) => {
        setDay(d);
        setMonth(m);
        setYear(y);

        if (!d || !m || !y) return;

        const formatted = `${y}-${m}-${d}`;
        onChange(formatted);
    };

    return (
        <div className="dob-wrapper">
            <label className="dob-label">Date of Birth</label>

            <div className="dob-container">
                <select value={day} onChange={(e) => updateDOB(e.target.value, month, year)}>
                    <option value="">DD</option>
                    {[...Array(31)].map((_, i) => {
                        const val = String(i + 1).padStart(2, "0");
                        return <option key={val} value={val}>{i + 1}</option>;
                    })}
                </select>

                <span className="dob-separator">/</span>

                <select value={month} onChange={(e) => updateDOB(day, e.target.value, year)}>
                    <option value="">MM</option>
                    {[...Array(12)].map((_, i) => {
                        const val = String(i + 1).padStart(2, "0");
                        return <option key={val} value={val}>{i + 1}</option>;
                    })}
                </select>

                <span className="dob-separator">/</span>

                <select value={year} onChange={(e) => updateDOB(day, month, e.target.value)}>
                    <option value="">YYYY</option>
                    {Array.from({ length: 100 }, (_, i) => {
                        const y = new Date().getFullYear() - i;
                        return <option key={y} value={y}>{y}</option>;
                    })}
                </select>
            </div>
        </div>
    );
}