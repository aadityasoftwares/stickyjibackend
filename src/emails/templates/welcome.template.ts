// Sticky Ji — Welcome Email Template

import { EmailButton } from "../components/EmailButton.js";
import { EmailCard } from "../components/EmailCard.js";
import { EmailLayout } from "../components/EmailLayout.js";
import { emailAssets } from "../config/emailAssets.js";
import { emailStyles } from "../config/emailStyles.js";
import { emailTheme } from "../config/emailTheme.js";

export interface WelcomeEmailProps {
    userName?: string;
}

/**
 * Escape dynamic values before inserting them into HTML.
 */
const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

export const welcomeEmailTemplate = ({ userName = "there" }: WelcomeEmailProps = {}): string => {
    const firstName = escapeHtml(userName.trim() || "there");

    /**
     * Caveat is intentionally used only for small expressive areas.
     * Email clients that don't support Caveat fall back gracefully.
     */
    const handwrittenFont = "'Caveat', 'Comic Sans MS', 'Segoe Print', cursive";

    return EmailLayout({
        title: `Welcome to ${emailTheme.brand.name}`,
        preheader:
            "Your workspace is ready. Capture ideas, organize tasks, and turn your notes into progress.",

        showHeader: true,
        showFooter: true,

        children: `

        <!-- =========================================================
             HERO
        ========================================================== -->

        <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
                margin: 0 0 ${emailTheme.spacing.stackLg};
            "
        >
            <tr>
                <td align="center">

                    <!-- SMALL EYEBROW -->
                    <table
                        role="presentation"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="
                            margin: 0 auto 16px;
                        "
                    >
                        <tr>
                            <td
                                align="center"
                                style="
                                    padding: 7px 14px;
                                    background-color:
                                        ${emailTheme.colors.notes.yellow.cream};
                                    border-radius:
                                        ${emailTheme.radius.full};
                                "
                            >
                                <span
                                    style="
                                        font-family:
                                            ${emailTheme.typography.labelBold.fontFamily};
                                        font-size: 11px;
                                        line-height: 1;
                                        font-weight: 700;
                                        letter-spacing: 1.2px;
                                        text-transform: uppercase;
                                        color:
                                            ${emailTheme.colors.notes.yellow.goldenrod};
                                    "
                                >
                                    ✦ YOUR WORKSPACE IS READY
                                </span>
                            </td>
                        </tr>
                    </table>


                    <!-- HANDWRITTEN WELCOME -->
                    <p
                        style="
                            margin: 0 0 4px;

                            font-family: ${handwrittenFont};

                            font-size: 34px;
                            line-height: 1.15;
                            font-weight: 700;

                            color:
                                ${emailTheme.colors.notes.yellow.goldenrod};

                            text-align: center;
                        "
                    >
                        Welcome, ${firstName}!
                    </p>


                    <!-- MAIN TITLE -->
                    <h1
                        class="email-heading"
                        style="
                            ${emailStyles.h1}

                            max-width: 500px;

                            margin: 0 auto 14px;

                            text-align: center;
                        "
                    >
                        A clearer place for
                        all those busy thoughts.
                    </h1>


                    <!-- INTRO -->
                    <p
                        style="
                            ${emailStyles.bodyLarge}

                            max-width: 470px;

                            margin: 0 auto;

                            text-align: center;
                        "
                    >
                        ${emailTheme.brand.name} gives your ideas,
                        tasks, reminders and projects a visual home —
                        so everything important stays close,
                        organized and easy to act on.
                    </p>

                </td>
            </tr>
        </table>



        <!-- =========================================================
             MINI STICKY BOARD
        ========================================================== -->

        <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
                margin: 0 0 ${emailTheme.spacing.stackLg};

                background-color:
                    ${emailTheme.colors.surfaceContainer};

                border-radius:
                    ${emailTheme.radius.lg};

                box-shadow:
                    ${emailTheme.shadows.level1};
            "
        >
            <tr>
                <td
                    style="
                        padding: 18px 18px 8px;
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
                            <td>
                                <p
                                    style="
                                        margin: 0;

                                        font-family:
                                            ${handwrittenFont};

                                        font-size: 20px;
                                        line-height: 1.3;

                                        color:
                                            ${emailTheme.colors.onSurfaceVariant};
                                    "
                                >
                                    A little glimpse of your new desk ↓
                                </p>
                            </td>
                        </tr>
                    </table>

                </td>
            </tr>

            <tr>
                <td
                    style="
                        padding:
                            8px
                            14px
                            22px;
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

                            <!-- NOTE 1 -->
                            <td
                                width="32%"
                                valign="top"
                                style="
                                    width: 32%;
                                    padding: 6px;
                                "
                            >
                                <div
                                    style="
                                        min-height: 112px;

                                        padding: 17px;

                                        background-color:
                                            ${emailTheme.colors.notes.yellow.cream};

                                        border-radius:
                                            ${emailTheme.radius.sm};

                                        box-shadow:
                                            ${emailTheme.shadows.level2};

                                        transform:
                                            rotate(-2deg);
                                    "
                                >
                                    <p
                                        style="
                                            margin: 0 0 10px;

                                            font-family:
                                                ${emailTheme.typography.labelBold.fontFamily};

                                            font-size: 10px;
                                            line-height: 1;

                                            font-weight: 700;

                                            letter-spacing:
                                                1px;

                                            text-transform:
                                                uppercase;

                                            color:
                                                ${emailTheme.colors.notes.yellow.goldenrod};
                                        "
                                    >
                                        CAPTURE
                                    </p>

                                    <p
                                        style="
                                            margin: 0 0 8px;

                                            font-family:
                                                ${handwrittenFont};

                                            font-size: 23px;
                                            line-height: 1.15;

                                            font-weight: 700;

                                            color:
                                                ${emailTheme.colors.onSurface};
                                        "
                                    >
                                        Big idea!
                                    </p>

                                    <p
                                        style="
                                            margin: 0;

                                            font-family:
                                                ${emailTheme.typography.body.fontFamily};

                                            font-size: 12px;
                                            line-height: 1.45;

                                            color:
                                                ${emailTheme.colors.onSurfaceVariant};
                                        "
                                    >
                                        Get it out of your head.
                                    </p>
                                </div>
                            </td>


                            <!-- NOTE 2 -->
                            <td
                                width="34%"
                                valign="top"
                                style="
                                    width: 34%;
                                    padding: 6px;
                                "
                            >
                                <div
                                    style="
                                        min-height: 112px;

                                        padding: 17px;

                                        background-color:
                                            ${emailTheme.colors.notes.blue.iceBlue};

                                        border-radius:
                                            ${emailTheme.radius.sm};

                                        box-shadow:
                                            ${emailTheme.shadows.level2};

                                        transform:
                                            rotate(1deg);
                                    "
                                >
                                    <p
                                        style="
                                            margin: 0 0 10px;

                                            font-family:
                                                ${emailTheme.typography.labelBold.fontFamily};

                                            font-size: 10px;

                                            line-height: 1;

                                            font-weight: 700;

                                            letter-spacing:
                                                1px;

                                            text-transform:
                                                uppercase;

                                            color:
                                                ${emailTheme.colors.notes.blue.steelBlue};
                                        "
                                    >
                                        ORGANIZE
                                    </p>

                                    <p
                                        style="
                                            margin: 0 0 8px;

                                            font-family:
                                                ${handwrittenFont};

                                            font-size: 23px;

                                            line-height: 1.15;

                                            font-weight: 700;

                                            color:
                                                ${emailTheme.colors.onSurface};
                                        "
                                    >
                                        Make a plan
                                    </p>

                                    <p
                                        style="
                                            margin: 0;

                                            font-family:
                                                ${emailTheme.typography.body.fontFamily};

                                            font-size: 12px;

                                            line-height: 1.45;

                                            color:
                                                ${emailTheme.colors.onSurfaceVariant};
                                        "
                                    >
                                        Notes, folders & boards.
                                    </p>
                                </div>
                            </td>


                            <!-- NOTE 3 -->
                            <td
                                width="34%"
                                valign="top"
                                style="
                                    width: 34%;
                                    padding: 6px;
                                "
                            >
                                <div
                                    style="
                                        min-height: 112px;

                                        padding: 17px;

                                        background-color: #e9f7e8;

                                        border-radius:
                                            ${emailTheme.radius.sm};

                                        box-shadow:
                                            ${emailTheme.shadows.level2};

                                        transform:
                                            rotate(-1deg);
                                    "
                                >
                                    <p
                                        style="
                                            margin: 0 0 10px;

                                            font-family:
                                                ${emailTheme.typography.labelBold.fontFamily};

                                            font-size: 10px;

                                            line-height: 1;

                                            font-weight: 700;

                                            letter-spacing:
                                                1px;

                                            text-transform:
                                                uppercase;

                                            color: #4d7a48;
                                        "
                                    >
                                        DO
                                    </p>

                                    <p
                                        style="
                                            margin: 0 0 8px;

                                            font-family:
                                                ${handwrittenFont};

                                            font-size: 23px;

                                            line-height: 1.15;

                                            font-weight: 700;

                                            color:
                                                ${emailTheme.colors.onSurface};
                                        "
                                    >
                                        Done ✓
                                    </p>

                                    <p
                                        style="
                                            margin: 0;

                                            font-family:
                                                ${emailTheme.typography.body.fontFamily};

                                            font-size: 12px;

                                            line-height: 1.45;

                                            color:
                                                ${emailTheme.colors.onSurfaceVariant};
                                        "
                                    >
                                        Turn notes into progress.
                                    </p>
                                </div>
                            </td>

                        </tr>
                    </table>

                </td>
            </tr>
        </table>



        <!-- =========================================================
             MAIN INTRO CARD
        ========================================================== -->

        ${EmailCard({
            variant: "yellow",

            content: `

                <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                >
                    <tr>
                        <td valign="top">

                            <p
                                style="
                                    margin: 0 0 6px;

                                    font-family:
                                        ${handwrittenFont};

                                    font-size: 22px;

                                    line-height: 1.2;

                                    font-weight: 700;

                                    color:
                                        ${emailTheme.colors.notes.yellow.goldenrod};
                                "
                            >
                                Start small.
                            </p>

                            <h2
                                style="
                                    ${emailStyles.h3}

                                    margin:
                                        0 0 8px;
                                "
                            >
                                Your first note is all you need.
                            </h2>

                            <p
                                style="
                                    ${emailStyles.bodyText}

                                    margin: 0;
                                "
                            >
                                Write down something you want to remember,
                                finish or explore. From there, organize it
                                into folders, move it across your Kanban
                                board, or share the workspace with others.
                            </p>

                        </td>
                    </tr>
                </table>

            `,
        })}



        <!-- SPACER -->

        <div
            style="
                height:
                    ${emailTheme.spacing.stackLg};

                line-height:
                    ${emailTheme.spacing.stackLg};
            "
        >
            &nbsp;
        </div>



        <!-- =========================================================
             WHAT YOU CAN DO
        ========================================================== -->

        <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
        >
            <tr>
                <td align="center">

                    <p
                        style="
                            margin:
                                0 0 4px;

                            font-family:
                                ${handwrittenFont};

                            font-size: 21px;

                            line-height: 1.2;

                            color:
                                ${emailTheme.colors.notes.yellow.goldenrod};
                        "
                    >
                        Made for the way ideas actually happen.
                    </p>

                    <h2
                        style="
                            ${emailStyles.h2}

                            font-size: 24px;

                            margin:
                                0 0 20px;

                            text-align: center;
                        "
                    >
                        Everything has a place.
                    </h2>

                </td>
            </tr>
        </table>



        <!-- FEATURE 1 -->

        ${EmailCard({
            variant: "blue",

            content: `

                <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                >
                    <tr>

                        <td
                            width="46"
                            valign="top"
                        >
                            <div
                                style="
                                    width: 38px;

                                    height: 38px;

                                    line-height: 38px;

                                    text-align: center;

                                    border-radius:
                                        ${emailTheme.radius.sm};

                                    background-color:
                                        ${emailTheme.colors.notes.blue.iceBlue};

                                    font-size: 18px;
                                "
                            >
                                ✦
                            </div>
                        </td>

                        <td valign="top">

                            <h3
                                style="
                                    ${emailStyles.h3}

                                    font-size: 17px;

                                    margin:
                                        0 0 5px;
                                "
                            >
                                Capture everything
                            </h3>

                            <p
                                style="
                                    ${emailStyles.mutedText}

                                    margin: 0;
                                "
                            >
                                Save ideas, reminders, tasks
                                and quick thoughts before they disappear.
                            </p>

                        </td>

                    </tr>
                </table>

            `,
        })}



        <div style="height: 12px; line-height: 12px;">
            &nbsp;
        </div>



        <!-- FEATURE 2 -->

        ${EmailCard({
            variant: "yellow",

            content: `

                <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                >
                    <tr>

                        <td
                            width="46"
                            valign="top"
                        >
                            <div
                                style="
                                    width: 38px;

                                    height: 38px;

                                    line-height: 38px;

                                    text-align: center;

                                    border-radius:
                                        ${emailTheme.radius.sm};

                                    background-color:
                                        ${emailTheme.colors.notes.yellow.cream};

                                    font-size: 18px;
                                "
                            >
                                ▦
                            </div>
                        </td>

                        <td valign="top">

                            <h3
                                style="
                                    ${emailStyles.h3}

                                    font-size: 17px;

                                    margin:
                                        0 0 5px;
                                "
                            >
                                See your progress
                            </h3>

                            <p
                                style="
                                    ${emailStyles.mutedText}

                                    margin: 0;
                                "
                            >
                                Use folders and Kanban views
                                to move work from
                                <strong>To Do</strong>
                                to
                                <strong>Done</strong>.
                            </p>

                        </td>

                    </tr>
                </table>

            `,
        })}



        <div style="height: 12px; line-height: 12px;">
            &nbsp;
        </div>



        <!-- FEATURE 3 -->

        ${EmailCard({
            variant: "green",

            content: `

                <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                >
                    <tr>

                        <td
                            width="46"
                            valign="top"
                        >
                            <div
                                style="
                                    width: 38px;

                                    height: 38px;

                                    line-height: 38px;

                                    text-align: center;

                                    border-radius:
                                        ${emailTheme.radius.sm};

                                    background-color:
                                        #e9f7e8;

                                    font-size: 18px;
                                "
                            >
                                ◉
                            </div>
                        </td>

                        <td valign="top">

                            <h3
                                style="
                                    ${emailStyles.h3}

                                    font-size: 17px;

                                    margin:
                                        0 0 5px;
                                "
                            >
                                Work your way
                            </h3>

                            <p
                                style="
                                    ${emailStyles.mutedText}

                                    margin: 0;
                                "
                            >
                                Keep a personal workspace
                                for yourself or bring people together
                                when an idea becomes a team project.
                            </p>

                        </td>

                    </tr>
                </table>

            `,
        })}



        <!-- =========================================================
             HANDWRITTEN TIP
        ========================================================== -->

        <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
                margin:
                    ${emailTheme.spacing.stackLg}
                    0;
            "
        >
            <tr>
                <td
                    align="center"
                    style="
                        padding:
                            18px 20px;

                        border-radius:
                            ${emailTheme.radius.lg};

                        background-color:
                            ${emailTheme.colors.surfaceContainer};
                    "
                >

                    <p
                        style="
                            margin:
                                0 0 3px;

                            font-family:
                                ${handwrittenFont};

                            font-size: 24px;

                            line-height: 1.25;

                            font-weight: 700;

                            color:
                                ${emailTheme.colors.onSurface};
                        "
                    >
                        One tiny note can start something big.
                    </p>

                    <p
                        style="
                            margin: 0;

                            font-family:
                                ${emailTheme.typography.body.fontFamily};

                            font-size: 12px;

                            line-height: 1.5;

                            color:
                                ${emailTheme.colors.onSurfaceVariant};
                        "
                    >
                        Don't organize everything today.
                        Just capture the first thing on your mind.
                    </p>

                </td>
            </tr>
        </table>



        <!-- =========================================================
             CTA SECTION
        ========================================================== -->

        <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
        >
            <tr>

                <td
                    align="center"
                    style="
                        padding:
                            28px 22px;

                        border-radius:
                            ${emailTheme.radius.lg};

                        background-color:
                            ${emailTheme.colors.surfaceContainer};
                    "
                >

                    <p
                        style="
                            margin:
                                0 0 4px;

                            font-family:
                                ${handwrittenFont};

                            font-size: 22px;

                            line-height: 1.2;

                            color:
                                ${emailTheme.colors.notes.yellow.goldenrod};
                        "
                    >
                        Your blank sticky note is waiting...
                    </p>


                    <h2
                        style="
                            ${emailStyles.h2}

                            font-size: 25px;

                            margin:
                                0 0 10px;

                            text-align: center;
                        "
                    >
                        What will you stick first?
                    </h2>


                    <p
                        style="
                            ${emailStyles.bodyText}

                            max-width: 390px;

                            margin:
                                0 auto 20px;

                            text-align: center;
                        "
                    >
                        Open your workspace and create
                        your first note. It only takes a moment.
                    </p>


                    ${EmailButton({
                        text: "Create My First Note",
                        href: emailAssets.links.dashboard,
                        variant: "primary",
                    })}

                </td>

            </tr>
        </table>



        <!-- =========================================================
             SIGN OFF
        ========================================================== -->

        <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
                margin-top:
                    ${emailTheme.spacing.stackLg};
            "
        >
            <tr>
                <td align="center">

                    <div
                        style="
                            width: 42px;

                            height: 3px;

                            margin:
                                0 auto 14px;

                            border-radius:
                                ${emailTheme.radius.full};

                            background-color:
                                ${emailTheme.colors.surfaceContainerHighest};
                        "
                    >
                        &nbsp;
                    </div>


                    <p
                        style="
                            margin:
                                0 0 2px;

                            font-family:
                                ${handwrittenFont};

                            font-size: 21px;

                            line-height: 1.3;

                            color:
                                ${emailTheme.colors.onSurfaceVariant};
                        "
                    >
                        Happy sticking!
                    </p>


                    <p
                        style="
                            margin: 0;

                            ${emailStyles.label}
                        "
                    >
                        The ${emailTheme.brand.name} Team
                    </p>

                </td>
            </tr>
        </table>

        `,
    });
};
