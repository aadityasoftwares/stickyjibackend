// Sticky Ji — Email Button Component

import { getButtonStyle } from "../config/emailStyles.js";
import { emailTheme } from "../config/emailTheme.js";

export type EmailButtonVariant = "primary" | "secondary" | "success" | "error" | "custom";

export interface EmailButtonProps {
    text: string;
    href: string;
    variant?: EmailButtonVariant;
    backgroundColor?: string;
    textColor?: string;
    fullWidth?: boolean;
    align?: "left" | "center" | "right";
    padding?: string;
    borderRadius?: string;
}

export const EmailButton = ({
    text,
    href,
    variant = "primary",
    backgroundColor,
    textColor,
    fullWidth = false,
    align = "center",
    padding = "13px 24px",
    borderRadius = emailTheme.radius.full,
}: EmailButtonProps): string => {
    let bgColor: any = emailTheme.colors.primary;
    let color: any = emailTheme.colors.onPrimary;

    switch (variant) {
        case "secondary":
            bgColor = emailTheme.colors.surfaceContainer;
            color = emailTheme.colors.onSurface;
            break;

        case "success":
            bgColor = emailTheme.colors.notes.green.green;
            color = emailTheme.colors.white;
            break;

        case "error":
            bgColor = emailTheme.colors.error;
            color = emailTheme.colors.onError;
            break;

        case "custom":
            bgColor = backgroundColor ?? emailTheme.colors.primary;
            color = textColor ?? emailTheme.colors.onPrimary;
            break;

        case "primary":
        default:
            bgColor = emailTheme.colors.primary;
            color = emailTheme.colors.onPrimary;
            break;
    }

    const buttonStyle = getButtonStyle(bgColor, color)
        .replace("padding: 13px 24px;", `padding: ${padding};`)
        .replace(`border-radius: ${emailTheme.radius.full};`, `border-radius: ${borderRadius};`);

    return `
    <table
      role="presentation"
      cellspacing="0"
      cellpadding="0"
      border="0"
      width="${fullWidth ? "100%" : "auto"}"
    >
      <tr>
        <td
          align="${align}"
          style="
            padding: 0;
          "
        >
          <a
            href="${href}"
            target="_blank"
            style="
              ${buttonStyle}
              ${fullWidth ? "display: block;" : ""}
            "
          >
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;
};
