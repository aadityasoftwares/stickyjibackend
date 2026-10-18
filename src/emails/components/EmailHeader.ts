// Sticky Ji — Email Header Component
import { emailTheme } from "../config/emailTheme.js";
import { EmailLogo } from "./EmailLogo.js";

export interface EmailHeaderProps {
    showLogo?: boolean;
    logoWidth?: string;
    align?: "left" | "center" | "right";
    paddingTop?: string;
    paddingBottom?: string;
}

export const EmailHeader = ({
    showLogo = true,
    logoWidth = emailTheme.email.logoWidth,
    align = "center",
    paddingTop = emailTheme.spacing.stackLg,
    paddingBottom = emailTheme.spacing.stackMd,
}: EmailHeaderProps = {}): string => {
    if (!showLogo) {
        return "";
    }

    return `
    <tr>
      <td
        align="${align}"
        style="
          padding:
            ${paddingTop}
            ${emailTheme.email.contentPadding}
            ${paddingBottom};
        "
      >
        ${EmailLogo({
        width: logoWidth,
        align,
    })}
      </td>
    </tr>
  `;
};