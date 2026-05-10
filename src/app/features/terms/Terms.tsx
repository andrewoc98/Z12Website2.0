import React, { useEffect } from "react";
import {useLocation, useNavigate} from "react-router-dom";
import "./Terms.css";

const Terms: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const formState = location.state;
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="legal-page">
            <div className="legal-container">
                <h1>Terms & Conditions</h1>

                <section>
                    <h2>1. Terms & Conditions</h2>
                    <p>
                        In consideration of the acceptance of my application and the permission to participate as an entrant or competitor in Z12 Challenge, I hereby
                        confirm that I am physically prepared to participate in the event(s) I have chosen.
                    </p>
                    <p>
                        I acknowledge that there are inherent risks associated with an event of this type, as the course is on public roads, some of which may be fully
                        open to normal traffic, and due care should be taken. I understand that my personal belongings are always my responsibility.
                    </p>
                    <p>
                        I, for myself, my heirs, executors, administrators, successors, and assigns, hereby release, waive, and forever discharge Z12 Challenge
                        organisers, their affiliates, and any organisations associated with the event from all claims, demands, damages, costs, expenses, actions, and
                        causes of action, whether in law or equity, in respect of death, injury, loss, or damage to my person or property, however caused, arising or to
                        arise by reason of my participation in the event, whether as a spectator, participant, competitor, or otherwise, whether prior to, during, or
                        subsequent to the event, and notwithstanding that same may have been contributed to or occasioned by the negligence of the aforesaid. I
                        further undertake to hold harmless and agree to indemnify all of the aforesaid from and against any and all liability incurred by any or all of them
                        arising as a result of, or in any way connected with, my participation in the event.
                    </p>
                    <p>
                        I agree to indemnify and hold harmless all organisers from any
                        liability connected to my participation.
                    </p>
                    <p>
                        Personal information collected by Z12 Challenge is for registration and results purposes only and will not be shared with other companies or
                        organisations without my consent. Additionally, I hereby grant full permission to Z12 Challenge organisers to use any photography, video,
                        motion pictures, recordings, or any other record of this event, including my image, for promotional purposes.
                    </p>
                    <p>
                        I hereby consent to receive medical treatment in the event of injury, accident, and/or illness during the event.
                    </p>
                    <p>
                        I agree to the event policy on refunds, deferrals, and transfers (for more information, please click here).
                    </p>
                </section>

                <section>
                    <h2>2. Refunds, Deferrals, and Transfers</h2>
                    <p>
                        Once you enter Z12 Challenge, we cannot offer a refund due to injury or any other reason, including race postponement for circumstances
                        beyond our control (e.g., Covid or weather-related events). In the event of a race postponement or cancellation, your entry will automatically be
                        deferred to the next event.
                    </p>
                    <p>
                        However, we understand it can be frustrating if you have a valid reason for not being able to participate, so we offer two options: a deferral of
                        your entry to the following year or the option to transfer your place to another participant for the current year.
                    </p>
                    <h3>Required Information</h3>
                    <ul>
                        <li>Full Name</li>
                        <li>Date of Birth</li>
                        <li>Email Address</li>
                        <li>Selected Race Distance (3K / 6K)</li>
                    </ul>
                </section>

                <section>
                    <h2>3. Terms of Service</h2>

                    <h3>1. Agreement to Terms</h3>
                    <p>
                        By registering for and/or participating in Z12 Challenge (the “Event”), you agree to these Terms of Service and any other rules or policies
                        referred to within. This includes all guidance provided by the event organizers, including safety guidelines and race rules. Your participation
                        also signifies that you meet all eligibility requirements.
                    </p>

                    <h3>2. Eligibility</h3>
                    <p>
                        Participation in Z12 Challenge is open to individuals of all fitness levels. However, it is recommended that participants consult with a physician
                        prior to the event to ensure they are medically fit to participate.
                    </p>

                    <h3>3. Participant Waiver</h3>
                    <p>
                        By participating in Z12 Challenge, you acknowledge and agree to assume all inherent risks associated with the Event. You release Z12
                        Challenge organizers, sponsors, and partners from liability for any injury, loss, or damage, except in cases of gross negligence or intentional
                        misconduct.
                    </p>

                    <h3>4. Registration and Fees</h3>
                    <p>
                        All registration fees are final and non-refundable except under specific conditions outlined in the Refunds, Deferrals, and Transfers policy. You
                        agree to pay all charges associated with your participation. In cases of postponement, your registration may be automatically deferred to the
                        following year’s event.
                    </p>

                    <h3>5. Code of Conduct</h3>
                    <p>
                        All participants are expected to maintain respectful and appropriate behaviour throughout the Event. Disruptive, offensive, or unsafe actions are
                        grounds for disqualification and removal without refund.
                    </p>

                    <h3>6. Media Release</h3>
                    <p>
                        By participating in the Event, you grant permission for Z12 Challenge to use any photos, videos, or recordings of you taken during the Event for
                        promotional or marketing purposes without compensation.
                    </p>

                    <h3>7. Health and Safety</h3>
                    <p>
                        Participants must follow all Event safety protocols. The course may involve interaction with public roadways, so due caution is advised. Z12
                        Challenge reserves the right to modify or cancel the event in the interest of participant safety.
                    </p>

                    <h3>8. Limitation of Liability</h3>
                    <p>
                        Z12 Challenge, its affiliates, and partners are not liable for any incidental, consequential, or indirect damages arising from your participation in
                        the Event, to the extent permitted by law.
                    </p>

                    <h3>9. Event Changes</h3>
                    <p>
                        Z12 Challenge reserves the right to modify the Event route, date, or other aspects in response to factors outside its control, such as weather
                        conditions or public health issues. In such cases, the event will make every effort to communicate these changes to participants promptly.
                    </p>
                </section>

                <section>
                    <h2>Refunds, Deferrals, and Transfers Policy</h2>
                    <ul>
                        <li>
                            <strong>Transfers:</strong>Participants may transfer their registration to another person for the current event. Transfers must be done by the deadline and are
                            free of charge.
                        </li>
                        <li>
                            <strong>Refunds:</strong> All registration fees are final and non-refundable.
                        </li>
                        <li>
                            <strong>Deferrals:</strong>Participants can defer their registration to the following year for a nominal fee, provided they request this by the specified deadline.
                        </li>
                    </ul>
                </section>

                <div className="legal-footer">
                    <button
                        className="return-btn"
                        onClick={() =>
                            navigate("/auth", { state: formState })
                        }
                    >
                        ← Return
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Terms;