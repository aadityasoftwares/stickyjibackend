// Sticky Ji — Email Footer Component

import { emailAssets } from "../config/emailAssets.js";
import { emailTheme } from "../config/emailTheme.js";

export interface EmailFooterProps {
    showUnsubscribe?: boolean;
    unsubscribeUrl?: string;
    showWebsite?: boolean;
    websiteUrl?: string;
    copyrightYear?: number;
}

export const EmailFooter = ({
    showUnsubscribe = true,
    unsubscribeUrl = emailAssets.actions.unsubscribe,
    showWebsite = true,
    websiteUrl = emailAssets.links.website,
    copyrightYear = new Date().getFullYear(),
}: EmailFooterProps = {}): string => {
    return `
    <tr>
      <td
        align="center"
        style="
          padding:
            ${emailTheme.spacing.stackLg}
            ${emailTheme.email.contentPadding}
            ${emailTheme.spacing.stackLg};
        "
      >
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
        >
          <tr>
            <td
              style="
                height: 1px;
                background-color: ${emailTheme.colors.outlineVariant};
                font-size: 0;
                line-height: 0;
              "
            >
              &nbsp;
            </td>
          </tr>
        </table>

        <div
          style="
            height: ${emailTheme.spacing.stackLg};
            line-height: ${emailTheme.spacing.stackLg};
          "
        >
          &nbsp;
        </div>

        <p
          style="
            margin: 0 0 8px;
            font-family: ${emailTheme.typography.fontFamily};
            font-size: 13px;
            line-height: 1.5;
            font-weight: 700;
            color: ${emailTheme.colors.onSurface};
          "
        >
          ${emailTheme.brand.name}
        </p>

        ${showWebsite
            ? `
              <a
                href="${websiteUrl}"
                target="_blank"
                style="
                  font-family: ${emailTheme.typography.fontFamily};
                  font-size: ${emailTheme.typography.labelSmall.fontSize};
                  line-height: ${emailTheme.typography.labelSmall.lineHeight};
                  color: ${emailTheme.colors.onSurfaceVariant};
                  text-decoration: none;
                "
              >
                Visit Sticky Ji
              </a>
            `
            : ""
        }

        ${showWebsite && showUnsubscribe
            ? `
              <span
                style="
                  color: ${emailTheme.colors.outline};
                  padding: 0 6px;
                "
              >
                ·
              </span>
            `
            : ""
        }

        ${showUnsubscribe
            ? `
              <a
                href="${unsubscribeUrl}"
                target="_blank"
                style="
                  font-family: ${emailTheme.typography.fontFamily};
                  font-size: ${emailTheme.typography.labelSmall.fontSize};
                  line-height: ${emailTheme.typography.labelSmall.lineHeight};
                  color: ${emailTheme.colors.onSurfaceVariant};
                  text-decoration: underline;
                "
              >
                Unsubscribe
              </a>
            `
            : ""
        }

        <p
          style="
            margin: 12px 0 0;
            font-family: ${emailTheme.typography.fontFamily};
            font-size: 11px;
            line-height: 1.5;
            color: ${emailTheme.colors.outline};
          "
        >
          © ${copyrightYear} ${emailTheme.brand.name}. All rights reserved.
        </p>
      </td>
    </tr>
  `;
};