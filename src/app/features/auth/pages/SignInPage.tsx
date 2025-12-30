import { useState } from "react";
import Navbar from "../../../shared/components/Navbar/Navbar";
import { signInEmail, signInGoogle } from "../api/auth";

export default function SignInPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    return (
        <>
            <Navbar />
            <main>
                <h1>Sign In</h1>

                <button onClick={signInGoogle}>Sign in with Google</button>

                <div style={{ marginTop: 16 }}>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
                    <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" />
                    <button onClick={() => signInEmail(email, password)}>Sign In</button>
                </div>
            </main>
        </>
    );
}
