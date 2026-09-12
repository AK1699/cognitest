// Branded HTML emails mirroring the web app's auth card (cream page, white
// card, teal wordmark, magenta CTA). All styles inline — mail clients strip
// stylesheets — and fonts are a stack: most inboxes block webfont loading, so
// Space Grotesk/Karla apply where installed and fall back to system fonts.

const COLORS = {
  cream: '#faf5ea',
  ink: '#22302d',
  muted: '#6b7873',
  line: '#e1dcca',
  primaryDeep: '#0a5f5b',
  accent: '#d3407f',
};

const BODY_FONT = "'Karla', ui-sans-serif, system-ui, -apple-system, sans-serif";
const DISPLAY_FONT = "'Space Grotesk', ui-sans-serif, system-ui, -apple-system, sans-serif";

export interface BrandedEmail {
  heading: string;
  /** Paragraphs above the button. */
  bodyLines: string[];
  cta: { label: string; url: string };
  /** Small print under the button, e.g. validity + ignore note. */
  footnote: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderBrandedEmail(email: BrandedEmail): string {
  const paragraphs = email.bodyLines
    .map(
      (line) =>
        `<p style="margin:0 0 14px;font-family:${BODY_FONT};font-size:15px;line-height:1.6;color:${COLORS.ink};">${escapeHtml(line)}</p>`,
    )
    .join('\n');

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:${COLORS.cream};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.cream};padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <span style="font-family:${DISPLAY_FONT};font-size:26px;font-weight:700;letter-spacing:-0.5px;color:${COLORS.primaryDeep};">Cognitest</span>
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff;border:1px solid ${COLORS.line};border-radius:16px;padding:32px;">
                <h1 style="margin:0 0 16px;font-family:${DISPLAY_FONT};font-size:20px;font-weight:700;color:${COLORS.primaryDeep};">${escapeHtml(email.heading)}</h1>
                ${paragraphs}
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                  <tr>
                    <td style="border-radius:10px;background-color:${COLORS.accent};">
                      <a href="${email.cta.url}" style="display:inline-block;padding:12px 24px;font-family:${BODY_FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(email.cta.label)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0;font-family:${BODY_FONT};font-size:13px;line-height:1.6;color:${COLORS.muted};">${escapeHtml(email.footnote)}</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:20px;">
                <p style="margin:0;font-family:${BODY_FONT};font-size:12px;line-height:1.6;color:${COLORS.muted};">
                  If the button doesn't work, copy this link into your browser:<br />
                  <a href="${email.cta.url}" style="color:${COLORS.primaryDeep};word-break:break-all;">${email.cta.url}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
