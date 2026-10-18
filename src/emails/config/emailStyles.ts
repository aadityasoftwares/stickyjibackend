import { emailTheme } from "./emailTheme.js";
const font = emailTheme.typography.fontFamily;

export const emailStyles = {
    body: `
    margin: 0;
    padding: 0;
    width: 100%;
    background-color: ${emailTheme.colors.surfaceContainerLow};
    font-family: ${font};
    color: ${emailTheme.colors.onSurface};
    -webkit-text-size-adjust: 100%;
    -ms-text-size-adjust: 100%;
  `,

    wrapper: `
    width: 100%;
    margin: 0;
    padding: ${emailTheme.email.outerPadding};
    background-color: ${emailTheme.colors.surfaceContainerLow};
  `,

    container: `
    width: 100%;
    max-width: ${emailTheme.email.maxWidth};
    margin: 0 auto;
    background-color: ${emailTheme.colors.surfaceContainerLowest};
    border-radius: ${emailTheme.radius.lg};
    overflow: hidden;
    box-shadow: ${emailTheme.shadows.level1};
  `,

    content: `
    padding: ${emailTheme.email.contentPadding};
  `,

    contentMobile: `
    padding: ${emailTheme.email.mobileContentPadding};
  `,

    logo: `
    display: block;
    width: ${emailTheme.email.logoWidth};
    max-width: 100%;
    height: auto;
    margin: 0 auto;
    border: 0;
    outline: none;
    text-decoration: none;
  `,

    h1: `
    margin: 0;
    padding: 0;
    font-family: ${emailTheme.typography.h1.fontFamily};
    font-size: 36px;
    line-height: ${emailTheme.typography.h1.lineHeight};
    font-weight: ${emailTheme.typography.h1.fontWeight};
    letter-spacing: ${emailTheme.typography.h1.letterSpacing};
    color: ${emailTheme.colors.onSurface};
  `,

    h2: `
    margin: 0;
    padding: 0;
    font-family: ${emailTheme.typography.h2.fontFamily};
    font-size: 24px;
    line-height: ${emailTheme.typography.h2.lineHeight};
    font-weight: ${emailTheme.typography.h2.fontWeight};
    letter-spacing: ${emailTheme.typography.h2.letterSpacing};
    color: ${emailTheme.colors.onSurface};
  `,

    h3: `
    margin: 0;
    padding: 0;
    font-family: ${emailTheme.typography.h3.fontFamily};
    font-size: 20px;
    line-height: ${emailTheme.typography.h3.lineHeight};
    font-weight: ${emailTheme.typography.h3.fontWeight};
    color: ${emailTheme.colors.onSurface};
  `,

    bodyText: `
    margin: 0;
    padding: 0;
    font-family: ${emailTheme.typography.body.fontFamily};
    font-size: ${emailTheme.typography.body.fontSize};
    line-height: ${emailTheme.typography.body.lineHeight};
    font-weight: ${emailTheme.typography.body.fontWeight};
    color: ${emailTheme.colors.onSurfaceVariant};
  `,

    bodyLarge: `
    margin: 0;
    padding: 0;
    font-family: ${emailTheme.typography.bodyLarge.fontFamily};
    font-size: ${emailTheme.typography.bodyLarge.fontSize};
    line-height: ${emailTheme.typography.bodyLarge.lineHeight};
    font-weight: ${emailTheme.typography.bodyLarge.fontWeight};
    letter-spacing: ${emailTheme.typography.bodyLarge.letterSpacing};
    color: ${emailTheme.colors.onSurfaceVariant};
  `,

    mutedText: `
    margin: 0;
    padding: 0;
    font-family: ${emailTheme.typography.labelSmall.fontFamily};
    font-size: ${emailTheme.typography.labelSmall.fontSize};
    line-height: ${emailTheme.typography.labelSmall.lineHeight};
    font-weight: ${emailTheme.typography.labelSmall.fontWeight};
    color: ${emailTheme.colors.outline};
  `,

    label: `
    margin: 0;
    padding: 0;
    font-family: ${emailTheme.typography.labelBold.fontFamily};
    font-size: ${emailTheme.typography.labelBold.fontSize};
    line-height: ${emailTheme.typography.labelBold.lineHeight};
    font-weight: ${emailTheme.typography.labelBold.fontWeight};
    color: ${emailTheme.colors.onSurface};
  `,

    buttonPrimary: `
    display: inline-block;
    padding: 13px 24px;
    border-radius: ${emailTheme.radius.full};
    background-color: ${emailTheme.colors.primary};
    color: ${emailTheme.colors.onPrimary};
    font-family: ${font};
    font-size: ${emailTheme.typography.labelBold.fontSize};
    line-height: 1.2;
    font-weight: ${emailTheme.typography.labelBold.fontWeight};
    text-decoration: none;
    text-align: center;
    border: 0;
  `,

    buttonSecondary: `
    display: inline-block;
    padding: 12px 24px;
    border-radius: ${emailTheme.radius.full};
    background-color: ${emailTheme.colors.surfaceContainer};
    color: ${emailTheme.colors.onSurface};
    font-family: ${font};
    font-size: ${emailTheme.typography.labelBold.fontSize};
    line-height: 1.2;
    font-weight: ${emailTheme.typography.labelBold.fontWeight};
    text-decoration: none;
    text-align: center;
    border: 1px solid ${emailTheme.colors.outlineVariant};
  `,

    card: `
    background-color: ${emailTheme.colors.surfaceContainerLowest};
    border-radius: ${emailTheme.radius.md};
    padding: ${emailTheme.spacing.cardPadding};
    box-shadow: ${emailTheme.shadows.level1};
  `,

    cardSubtle: `
    background-color: ${emailTheme.colors.surfaceContainerLow};
    border-radius: ${emailTheme.radius.md};
    padding: ${emailTheme.spacing.cardPadding};
  `,

    stickyNote: `
    border-radius: ${emailTheme.radius.sm};
    padding: ${emailTheme.spacing.cardPadding};
    box-shadow: ${emailTheme.shadows.level2};
  `,

    divider: `
    height: 1px;
    border: 0;
    background-color: ${emailTheme.colors.outlineVariant};
  `,

    center: `
    text-align: center;
  `,

    fullWidth: `
    width: 100%;
  `,
} as const;

export const stickyNoteStyles = {
    yellow: `
    ${emailStyles.stickyNote}
    background-color: ${emailTheme.colors.notes.yellow.cream};
    color: ${emailTheme.colors.onSurface};
  `,

    blue: `
    ${emailStyles.stickyNote}
    background-color: ${emailTheme.colors.notes.blue.iceBlue};
    color: ${emailTheme.colors.onSurface};
  `,

    green: `
    ${emailStyles.stickyNote}
    background-color: ${emailTheme.colors.notes.green.mintCream};
    color: ${emailTheme.colors.onSurface};
  `,

    pink: `
    ${emailStyles.stickyNote}
    background-color: ${emailTheme.colors.notes.pink.bubblegum};
    color: ${emailTheme.colors.onSurface};
  `,

    orange: `
    ${emailStyles.stickyNote}
    background-color: ${emailTheme.colors.notes.orange.peach};
    color: ${emailTheme.colors.onSurface};
  `,

    purple: `
    ${emailStyles.stickyNote}
    background-color: ${emailTheme.colors.notes.purple.lavender};
    color: ${emailTheme.colors.onSurface};
  `,
} as const;

export const getStickyNoteStyle = (color: string): string => `
  ${emailStyles.stickyNote}
  background-color: ${color};
  color: ${emailTheme.colors.onSurface};
`;

export const getButtonStyle = (
    backgroundColor = emailTheme.colors.primary,
    textColor = emailTheme.colors.onPrimary,
): string => `
  display: inline-block;
  padding: 13px 24px;
  border-radius: ${emailTheme.radius.full};
  background-color: ${backgroundColor};
  color: ${textColor};
  font-family: ${font};
  font-size: ${emailTheme.typography.labelBold.fontSize};
  line-height: 1.2;
  font-weight: ${emailTheme.typography.labelBold.fontWeight};
  text-decoration: none;
  text-align: center;
`;