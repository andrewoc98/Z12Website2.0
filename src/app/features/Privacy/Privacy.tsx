import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Privacy.css";

const Privacy: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="legal-page">
            <div className="legal-container">
                <h1>Privacy Policy</h1>
                <p className="last-updated">Last updated: March 2026</p>
                <section>
                    <h2>1. Information Collection</h2>
                    <p>We may collect the following types of information:
                        Personal Information: Your name, email address, phone number, mailing address, date of birth, and other similar identifiers.
                        Payment Information: Details such as credit card numbers, billing addresses, and other payment details (via third-party processors like Stripe).
                        Event Participation Information: When you register for events, we collect information regarding your registration, participation, and feedback.
                        Website Usage Data: Information such as your IP address, browser type, device information, and how you interact with our website.</p>
                </section>

                <section>
                    <h2>2. Information Use</h2>
                    <p>We use the collected data for the following purposes:
                        To facilitate registration and participation in Z12 Challenge events.
                        To process payments securely and efficiently.
                        To send event-related communications (e.g., registration confirmations, event updates).
                        To improve our website and the overall user experience.
                        To comply with legal requirements and ensure the safety of our platform.
                        To send marketing communications, newsletters, and updates about future events, where permitted by law.</p>
                </section>

                <section>
                    <h2>3. How We Share Information</h2>
                    <p>We may share your information with:
                        Service Providers: Third-party vendors that assist with website hosting, payment processing, email communications, and event management
                        (e.g., Stripe for payments).
                        Legal Requirements: If required by law, we may disclose your personal information in response to legal processes, investigations, or court
                        orders.

                        Event Partners: In some cases, we may share information with trusted event sponsors and partners to enhance your experience. We will notify
                        you if this occurs and seek consent if necessary.</p>
                </section>

                <section>
                    <h2>4. Third-Party Services</h2>
                    <p>Our website may contain links to third-party websites or services, such as payment processors and social media platforms. Please note that
                        once you leave our website or engage with these third parties, their privacy policies will govern your interactions. We are not responsible for the
                        practices of such third parties.</p>
                </section>

                <section>
                    <h2>5. Cookies and Tracking Technologies</h2>
                    <p>Z12 Challenge uses cookies and similar tracking technologies to:
                        Analyse website traffic and performance.
                        Customise your experience based on your preferences. You can manage cookie preferences through your browser settings.</p>
                </section>

                <section>
                    <h2>6. Data Security</h2>
                    <p>We employ industry-standard security measures to protect your data from unauthorised access, disclosure, or misuse. However, no method of
                        online transmission is 100% secure, and we cannot guarantee the absolute security of your information.</p>
                </section>

                <section>
                    <h2>7. Data Retention</h2>
                    <p>We retain personal information only for as long as necessary to fulfil the purposes outlined in this policy unless a longer retention period is
                        required or permitted by law.</p>
                </section>

                <section>
                    <h2>8. Your Rights</h2>
                    <p>You have the right to:
                        Access and obtain a copy of your personal information.
                        Request correction or deletion of your data.
                        Object to or restrict certain processing activities.
                        Withdraw your consent for marketing communications at any time.
                        To exercise these rights, please contact us at [email address].</p>
                </section>

                <section>
                    <h2>9. Children’s Privacy</h2>
                    <p>Z12 Challenge is not intended for children under 13 years of age. We do not knowingly collect personal data from children. If we become aware
                        that a child’s information has been collected without parental consent, we will take steps to delete it.</p>
                </section>

                <section>
                    <h2>10. Changes to This Privacy Policy</h2>
                    <p>We may update this policy from time to time to reflect changes in our practices or for legal reasons. Any updates will be posted on this page
                        with an updated “Last Revised” date.</p>
                </section>

                <section>
                    <h2>11. Contact Us</h2>
                    <p>If you have any questions or concerns regarding this Privacy Policy, please contact us at:
                        Z12 Challenge Team</p>
                       <p><strong>Email:</strong>support@Z12CHALLENGE,COM</p>
                </section>

                <div className="legal-footer">
                    <button
                        className="return-btn"
                        onClick={() => navigate(-1)}
                    >
                        ← Return
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Privacy;