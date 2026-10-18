// Sticky Ji — Email Card Component

import { emailTheme } from "../config/emailTheme.js";

export type EmailCardVariant =
    "default" | "subtle" | "yellow" | "blue" | "green" | "pink" | "orange" | "purple" | "custom";

export interface EmailCardProps {
    content: string;
    variant?: EmailCardVariant;
    backgroundColor?: string;
    padding?: string;
    borderRadius?: string;
    shadow?: string;
    width?: string;
    align?: "left" | "center" | "right";
}

export const EmailCard = ({
    content,
    variant = "default",
    backgroundColor,
    padding = emailTheme.spacing.cardPadding,
    borderRadius = emailTheme.radius.md,
    shadow = emailTheme.shadows.level1,
    width = "100%",
    align = "left",
}: EmailCardProps): string => {
    let background: any = emailTheme.colors.surfaceContainerLowest;
    let textColor: any = emailTheme.colors.onSurface;

    switch (variant) {
        case "subtle":
            background = emailTheme.colors.surfaceContainerLow;
            break;

        case "yellow":
            background = emailTheme.colors.notes.yellow.cream;
            break;

        case "blue":
            background = emailTheme.colors.notes.blue.iceBlue;
            break;

        case "green":
            background = emailTheme.colors.notes.green.mintCream;
            break;

        case "pink":
            background = emailTheme.colors.notes.pink.bubblegum;
            break;

        case "orange":
            background = emailTheme.colors.notes.orange.peach;
            break;

        case "purple":
            background = emailTheme.colors.notes.purple.lavender;
            break;

        case "custom":
            background = backgroundColor ?? emailTheme.colors.surfaceContainerLowest;
            break;

        case "default":
        default:
            background = emailTheme.colors.surfaceContainerLowest;
            break;
    }

    const cardStyle = `
    width: ${width};
    background-color: ${background};
    color: ${textColor};
    padding: ${padding};
    border-radius: ${borderRadius};
    box-shadow: ${shadow};
    box-sizing: border-box;
  `;

    return `
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
    >
      <tr>
        <td
          align="${align}"
          style="
            padding: 0;
          "
        >
          <div
            style="
              ${cardStyle}
            "
          >
            ${content}
          </div>
        </td>
      </tr>
    </table>
  `;
};
