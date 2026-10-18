// Sticky Ji — Email Logo Component

import { emailAssets } from "../config/emailAssets.js";
import { emailStyles } from "../config/emailStyles.js";
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
    const logo = `
    <img
      src="${emailAssets.logo.primary}"
      alt="${emailTheme.brand.name}"
      width="${width.replace("px", "")}"
      style="
        ${emailStyles.logo}
        width: ${width};
      "
    />
  `;

    if (!href) {
        return `
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
      >
        <tr>
          <td align="${align}">
            ${logo}
          </td>
        </tr>
      </table>
    `;
    }

    return `
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
    >
      <tr>
        <td align="${align}">
          <a
            href="${href}"
            target="_blank"
            style="
              display: inline-block;
              text-decoration: none;
            "
          >
            ${logo}
          </a>
        </td>
      </tr>
    </table>
  `;
};