// Sticky Ji — Email Logo Component

import { emailAssets } from "../config/emailAssets.js";
import { emailTheme } from "../config/emailTheme.js";

export interface EmailLogoProps {
    width?: string;
    align?: "left" | "center" | "right";
    href?: string;
}

export const EmailLogo = ({
    width = emailTheme.email.logoWidth,
    align = "center",
    href = emailAssets.links.website,
}: EmailLogoProps = {}): string => {
    const numericWidth = width.replace("px", "");
    const logoImg = `<img src="${emailAssets.logo.primary}" alt="${emailTheme.brand.name}" width="${numericWidth}" style="display:block;width:${width};max-width:100%;height:auto;margin:0 auto;border:0;outline:none;text-decoration:none;" />`;

    if (!href) {
        return `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="${align}">
            ${logoImg}
          </td>
        </tr>
      </table>
    `;
    }

    return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="${align}">
          <a href="${href}" target="_blank" style="display:inline-block;text-decoration:none;">
            ${logoImg}
          </a>
        </td>
      </tr>
    </table>
  `;
};
