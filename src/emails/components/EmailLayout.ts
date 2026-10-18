// Sticky Ji — Email Layout Component

import { emailStyles } from "../config/emailStyles.js";
import { emailTheme } from "../config/emailTheme.js";
import { EmailFooter } from "./EmailFooter.js";
import { EmailHeader } from "./EmailHeader.js";

export interface EmailLayoutProps {
    children: string;
    title?: string;
    preheader?: string;
    showHeader?: boolean;
    showFooter?: boolean;
    header?: Partial<Parameters<typeof EmailHeader>[0]>;
    footer?: Partial<Parameters<typeof EmailFooter>[0]>;
    backgroundColor?: string;
    containerBackgroundColor?: string;
    maxWidth?: string;
}

export const EmailLayout = ({
    children,
    title = emailTheme.brand.name,
    preheader = "",
    showHeader = true,
    showFooter = true,
    header = {},
    footer = {},
    backgroundColor = emailTheme.colors.surfaceContainerLow,
    containerBackgroundColor = emailTheme.colors.surfaceContainerLowest,
    maxWidth = emailTheme.email.maxWidth,
}: EmailLayoutProps): string => {
    return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />
  <meta
    http-equiv="X-UA-Compatible"
    content="IE=edge"
  />
  <title>${title}</title>

  <style>
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: ${backgroundColor};
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }

    table {
      border-spacing: 0;
      border-collapse: collapse;
    }

    img {
      border: 0;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }

    a {
      text-decoration: none;
    }

    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
        border-radius: 0 !important;
      }

      .email-content {
        padding: ${emailTheme.email.mobileContentPadding} !important;
      }

      .email-logo {
        width: ${emailTheme.email.logoMobileWidth} !important;
      }

      .email-heading {
        font-size: 30px !important;
        line-height: 1.2 !important;
      }

      .email-stack {
        display: block !important;
        width: 100% !important;
      }
    }
  </style>
</head>

<body style="${emailStyles.body}">
  ${
      preheader
          ? `
        <div
          style="
            display: none;
            max-height: 0;
            overflow: hidden;
            opacity: 0;
            color: transparent;
            font-size: 1px;
            line-height: 1px;
          "
        >
          ${preheader}
        </div>
      `
          : ""
  }

  <table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    border="0"
    style="
      width: 100%;
      background-color: ${backgroundColor};
    "
  >
    <tr>
      <td
        align="center"
        style="
          padding: ${emailTheme.email.outerPadding};
        "
      >
        <table
          role="presentation"
          width="${maxWidth.replace("px", "")}"
          cellspacing="0"
          cellpadding="0"
          border="0"
          class="email-container"
          style="
            ${emailStyles.container}
            max-width: ${maxWidth};
            background-color: ${containerBackgroundColor};
          "
        >
          ${showHeader ? EmailHeader(header) : ""}

          <tr>
            <td
              class="email-content"
              style="
                padding: ${emailTheme.email.contentPadding};
              "
            >
              ${children}
            </td>
          </tr>

          ${showFooter ? EmailFooter(footer) : ""}
        </table>

        <div
          style="
            height: 20px;
            line-height: 20px;
          "
        >
          &nbsp;
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};
