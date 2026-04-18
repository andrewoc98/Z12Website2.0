export function parentConsentTemplate(childName: string, consentLink: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Parental Consent Required</title>
  </head>
  <body style="margin:0; padding:0; background:#1e1e22; font-family:Inter, system-ui, -apple-system, sans-serif;" bgcolor="#1e1e22">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1e1e22; padding:20px 0;" bgcolor="#1e1e22">
      <tr>
        <td align="center">
          <table width="100%" style="max-width:520px; background:#26262b; border-radius:16px; border:1px solid rgba(255,255,255,0.08); box-shadow:0 6px 16px rgba(0,0,0,0.35);" bgcolor="#26262b">
            <tr>
              <td style="padding:24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="text-align:center; padding-bottom:10px;">
                      <h1 style="margin:0; letter-spacing:1px; color:#FEB959;">Z12 CHALLENGE</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="text-align:center; padding:10px 0;">
                      <h2 style="margin:0; color:#f3f4f6; font-size:22px;">Parental Consent Required</h2>
                    </td>
                  </tr>
                  <tr>
                    <td style="text-align:center; padding:10px 0;">
                      <p style="color:rgba(255,255,255,0.65); font-size:14px; line-height:1.6; margin:0;">Hello,</p>
                      <p style="color:rgba(255,255,255,0.65); font-size:14px; line-height:1.6;">
                        <strong style="color:#f3f4f6;">${childName}</strong> has signed up for Z12 Challenge and requires
                        your permission to complete their registration.
                      </p>
                      <p style="color:rgba(255,255,255,0.65); font-size:14px; line-height:1.6;">
                        Please confirm your consent by clicking the button below.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:20px 0;">
                      <a href="${consentLink}" style="display:inline-block; background:#FEB959; color:#141414; text-decoration:none; padding:12px 20px; border-radius:999px; text-transform:uppercase; letter-spacing:1px; font-size:14px;">
                        Give Consent
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <hr style="border:none; border-top:1px solid rgba(255,255,255,0.08); margin:20px 0;" />
                    </td>
                  </tr>
                  <tr>
                    <td style="text-align:center;">
                      <p style="color:rgba(255,255,255,0.65); font-size:12px; line-height:1.5;">
                        If the button doesn't work, copy and paste this link:
                      </p>
                      <p style="word-break:break-all; font-size:12px;">
                        <a href="${consentLink}" style="color:#ffd400;">${consentLink}</a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="text-align:center; padding-top:20px;">
                      <p style="color:rgba(255,255,255,0.5); font-size:11px;">
                        If you did not expect this email, you can safely ignore it.
                      </p>
                      <p style="color:rgba(255,255,255,0.4); font-size:11px; margin-top:10px;">
                        Z12 Challenge Inc.<br />&copy; 2026 All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function verifyEmailTemplate(verificationLink: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify Your Email</title>
  </head>
  <body style="margin:0; padding:0; background:#1e1e22; font-family:Inter, system-ui, -apple-system, sans-serif;" bgcolor="#1e1e22">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1e1e22; padding:20px 0;" bgcolor="#1e1e22">
      <tr>
        <td align="center">
          <table width="100%" style="max-width:520px; background:#26262b; border-radius:16px; border:1px solid rgba(255,255,255,0.08); box-shadow:0 6px 16px rgba(0,0,0,0.35);" bgcolor="#26262b">
            <tr>
              <td style="padding:24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="text-align:center; padding-bottom:10px;">
                      <h1 style="margin:0; letter-spacing:1px; color:#FEB959;">Z12 CHALLENGE</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="text-align:center; padding:10px 0;">
                      <h2 style="margin:0; color:#f3f4f6; font-size:22px;">Verify Your Email</h2>
                    </td>
                  </tr>
                  <tr>
                    <td style="text-align:center; padding:10px 0;">
                      <p style="color:rgba(255,255,255,0.65); font-size:14px; line-height:1.6; margin:0;">
                        Thanks for joining Z12 Challenge. Click the button below to verify your email and start your journey.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:20px 0;">
                      <a href="${verificationLink}" style="display:inline-block; background:#FEB959; color:#141414; text-decoration:none; padding:12px 20px; border-radius:999px; text-transform:uppercase; letter-spacing:1px; font-size:14px;">
                        Verify Email
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <hr style="border:none; border-top:1px solid rgba(255,255,255,0.08); margin:20px 0;" />
                    </td>
                  </tr>
                  <tr>
                    <td style="text-align:center;">
                      <p style="color:rgba(255,255,255,0.65); font-size:12px; line-height:1.5;">
                        If the button doesn't work, copy and paste this link into your browser:
                      </p>
                      <p style="word-break:break-all; font-size:12px;">
                        <a href="${verificationLink}" style="color:#ffd400;">${verificationLink}</a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="text-align:center; padding-top:20px;">
                      <p style="color:rgba(255,255,255,0.5); font-size:11px;">
                        If you didn't create an account, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function resetPasswordTemplate(resetLink: string): string {
    const expiryTime = "1 hour";
    return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset Your Password</title>
  </head>
  <body style="margin:0; padding:0; background:#1e1e22; font-family:Inter, system-ui, -apple-system, sans-serif;" bgcolor="#1e1e22">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1e1e22; padding:20px 0;" bgcolor="#1e1e22">
      <tr>
        <td align="center">
          <table width="100%" style="max-width:520px; background:#26262b; border-radius:16px; border:1px solid rgba(255,255,255,0.08); box-shadow:0 6px 16px rgba(0,0,0,0.35);" bgcolor="#26262b">
            <tr>
              <td style="padding:24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="text-align:center; padding-bottom:10px;">
                      <h1 style="margin:0; letter-spacing:1px; color:#FEB959;">Z12 CHALLENGE</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="text-align:center; padding:10px 0;">
                      <h2 style="margin:0; color:#f3f4f6; font-size:22px;">Reset Your Password</h2>
                    </td>
                  </tr>
                  <tr>
                    <td style="text-align:center; padding:10px 0;">
                      <p style="color:rgba(255,255,255,0.65); font-size:14px; line-height:1.6; margin:0;">
                        We received a request to reset your password. Click the button below to create a new one.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:20px 0;">
                      <a href="${resetLink}" style="display:inline-block; background:#FEB959; color:#141414; text-decoration:none; padding:12px 20px; border-radius:999px; text-transform:uppercase; letter-spacing:1px; font-size:14px;">
                        Reset Password
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style="text-align:center;">
                      <p style="color:#ff4d6d; font-size:12px; margin:10px 0;">This link will expire in ${expiryTime}.</p>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <hr style="border:none; border-top:1px solid rgba(255,255,255,0.08); margin:20px 0;" />
                    </td>
                  </tr>
                  <tr>
                    <td style="text-align:center;">
                      <p style="color:rgba(255,255,255,0.65); font-size:12px; line-height:1.5;">
                        If the button doesn't work, copy and paste this link:
                      </p>
                      <p style="word-break:break-all; font-size:12px;">
                        <a href="${resetLink}" style="color:#ffd400;">${resetLink}</a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="text-align:center; padding-top:20px;">
                      <p style="color:rgba(255,255,255,0.5); font-size:11px;">
                        If you didn't request a password reset, you can ignore this email and your account will remain secure.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}