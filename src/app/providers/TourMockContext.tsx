import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

type TourMockCtx = {
    isTourActive: boolean;
    setTourActive: (v: boolean) => void;
};

const Ctx = createContext<TourMockCtx>({ isTourActive: false, setTourActive: () => {} });

export function TourMockProvider({ children }: { children: ReactNode }) {
    const [isTourActive, setTourActive] = useState(false);
    return <Ctx.Provider value={{ isTourActive, setTourActive }}>{children}</Ctx.Provider>;
}

export const useTourMock = () => useContext(Ctx);
