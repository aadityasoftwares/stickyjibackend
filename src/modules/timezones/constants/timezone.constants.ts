import { CountryCode } from "../../countries/constants/country.enums.js";

// ============================================================
// Default Timezone Configuration
// ============================================================


export const DEFAULT_TIMEZONE_STATUS = true;

export const DEFAULT_TIMEZONE_SYSTEM = true;

export const DEFAULT_TIMEZONE_CODE = "Asia/Kolkata";

export const DEFAULT_TIMEZONE_COUNTRY_CODE = CountryCode.INDIA;

export const DEFAULT_TIMEZONE_NAME = "India Standard Time";

export const DEFAULT_TIMEZONE_OFFSET = "+05:30";

export const DEFAULT_TIMEZONE_TYPE = "IANA";


// ============================================================
// Country → Timezone Mapping
// ============================================================

export const COUNTRY_TIMEZONE_MAP: Record<CountryCode, string[]> = {

    // ========================================================
    // Africa
    // ========================================================

    [CountryCode.ALGERIA]: [
        "Africa/Algiers",
    ],

    [CountryCode.ANGOLA]: [
        "Africa/Luanda",
    ],

    [CountryCode.BENIN]: [
        "Africa/Porto-Novo",
    ],

    [CountryCode.BOTSWANA]: [
        "Africa/Gaborone",
    ],

    [CountryCode.BURKINA_FASO]: [
        "Africa/Ouagadougou",
    ],

    [CountryCode.BURUNDI]: [
        "Africa/Bujumbura",
    ],

    [CountryCode.CABO_VERDE]: [
        "Atlantic/Cape_Verde",
    ],

    [CountryCode.CAMEROON]: [
        "Africa/Douala",
    ],

    [CountryCode.CENTRAL_AFRICAN_REPUBLIC]: [
        "Africa/Bangui",
    ],

    [CountryCode.CHAD]: [
        "Africa/Ndjamena",
    ],

    [CountryCode.COMOROS]: [
        "Indian/Comoro",
    ],

    [CountryCode.CONGO]: [
        "Africa/Brazzaville",
    ],

    [CountryCode.DEMOCRATIC_REPUBLIC_OF_CONGO]: [
        "Africa/Kinshasa",
        "Africa/Lubumbashi",
    ],

    [CountryCode.COTE_D_IVOIRE]: [
        "Africa/Abidjan",
    ],

    [CountryCode.DJIBOUTI]: [
        "Africa/Djibouti",
    ],

    [CountryCode.EGYPT]: [
        "Africa/Cairo",
    ],

    [CountryCode.EQUATORIAL_GUINEA]: [
        "Africa/Malabo",
    ],

    [CountryCode.ERITREA]: [
        "Africa/Asmara",
    ],

    [CountryCode.ESWATINI]: [
        "Africa/Mbabane",
    ],

    [CountryCode.ETHIOPIA]: [
        "Africa/Addis_Ababa",
    ],

    [CountryCode.GABON]: [
        "Africa/Libreville",
    ],

    [CountryCode.GAMBIA]: [
        "Africa/Banjul",
    ],

    [CountryCode.GHANA]: [
        "Africa/Accra",
    ],

    [CountryCode.GUINEA]: [
        "Africa/Conakry",
    ],

    [CountryCode.GUINEA_BISSAU]: [
        "Africa/Bissau",
    ],

    [CountryCode.KENYA]: [
        "Africa/Nairobi",
    ],

    [CountryCode.LESOTHO]: [
        "Africa/Maseru",
    ],

    [CountryCode.LIBERIA]: [
        "Africa/Monrovia",
    ],

    [CountryCode.LIBYA]: [
        "Africa/Tripoli",
    ],

    [CountryCode.MADAGASCAR]: [
        "Indian/Antananarivo",
    ],

    [CountryCode.MALAWI]: [
        "Africa/Blantyre",
    ],

    [CountryCode.MALI]: [
        "Africa/Bamako",
    ],

    [CountryCode.MAURITANIA]: [
        "Africa/Nouakchott",
    ],

    [CountryCode.MAURITIUS]: [
        "Indian/Mauritius",
    ],

    [CountryCode.MOROCCO]: [
        "Africa/Casablanca",
    ],

    [CountryCode.MOZAMBIQUE]: [
        "Africa/Maputo",
    ],

    [CountryCode.NAMIBIA]: [
        "Africa/Windhoek",
    ],

    [CountryCode.NIGER]: [
        "Africa/Niamey",
    ],

    [CountryCode.NIGERIA]: [
        "Africa/Lagos",
    ],

    [CountryCode.RWANDA]: [
        "Africa/Kigali",
    ],

    [CountryCode.SAO_TOME_AND_PRINCIPE]: [
        "Africa/Sao_Tome",
    ],

    [CountryCode.SENEGAL]: [
        "Africa/Dakar",
    ],

    [CountryCode.SEYCHELLES]: [
        "Indian/Mahe",
    ],

    [CountryCode.SIERRA_LEONE]: [
        "Africa/Freetown",
    ],

    [CountryCode.SOMALIA]: [
        "Africa/Mogadishu",
    ],

    [CountryCode.SOUTH_AFRICA]: [
        "Africa/Johannesburg",
    ],

    [CountryCode.SOUTH_SUDAN]: [
        "Africa/Juba",
    ],

    [CountryCode.SUDAN]: [
        "Africa/Khartoum",
    ],

    [CountryCode.TANZANIA]: [
        "Africa/Dar_es_Salaam",
    ],

    [CountryCode.TOGO]: [
        "Africa/Lome",
    ],

    [CountryCode.TUNISIA]: [
        "Africa/Tunis",
    ],

    [CountryCode.UGANDA]: [
        "Africa/Kampala",
    ],

    [CountryCode.ZAMBIA]: [
        "Africa/Lusaka",
    ],

    [CountryCode.ZIMBABWE]: [
        "Africa/Harare",
    ],


    // ========================================================
    // Asia
    // ========================================================

    [CountryCode.AFGHANISTAN]: [
        "Asia/Kabul",
    ],

    [CountryCode.ARMENIA]: [
        "Asia/Yerevan",
    ],

    [CountryCode.AZERBAIJAN]: [
        "Asia/Baku",
    ],

    [CountryCode.BAHRAIN]: [
        "Asia/Bahrain",
    ],

    [CountryCode.BANGLADESH]: [
        "Asia/Dhaka",
    ],

    [CountryCode.BHUTAN]: [
        "Asia/Thimphu",
    ],

    [CountryCode.BRUNEI]: [
        "Asia/Brunei",
    ],

    [CountryCode.CAMBODIA]: [
        "Asia/Phnom_Penh",
    ],

    [CountryCode.CHINA]: [
        "Asia/Shanghai",
    ],

    [CountryCode.CYPRUS]: [
        "Asia/Nicosia",
    ],

    [CountryCode.GEORGIA]: [
        "Asia/Tbilisi",
    ],

    [CountryCode.INDIA]: [
        "Asia/Kolkata",
    ],

    [CountryCode.INDONESIA]: [
        "Asia/Jakarta",
        "Asia/Makassar",
        "Asia/Jayapura",
    ],

    [CountryCode.IRAN]: [
        "Asia/Tehran",
    ],

    [CountryCode.IRAQ]: [
        "Asia/Baghdad",
    ],

    [CountryCode.ISRAEL]: [
        "Asia/Jerusalem",
    ],

    [CountryCode.JAPAN]: [
        "Asia/Tokyo",
    ],

    [CountryCode.JORDAN]: [
        "Asia/Amman",
    ],

    [CountryCode.KAZAKHSTAN]: [
        "Asia/Almaty",
        "Asia/Aqtobe",
        "Asia/Aqtau",
        "Asia/Atyrau",
        "Asia/Oral",
        "Asia/Qostanay",
        "Asia/Qyzylorda",
    ],

    [CountryCode.KUWAIT]: [
        "Asia/Kuwait",
    ],

    [CountryCode.KYRGYZSTAN]: [
        "Asia/Bishkek",
    ],

    [CountryCode.LAOS]: [
        "Asia/Vientiane",
    ],

    [CountryCode.LEBANON]: [
        "Asia/Beirut",
    ],

    [CountryCode.MALAYSIA]: [
        "Asia/Kuala_Lumpur",
        "Asia/Kuching",
    ],

    [CountryCode.MALDIVES]: [
        "Indian/Maldives",
    ],

    [CountryCode.MONGOLIA]: [
        "Asia/Ulaanbaatar",
        "Asia/Hovd",
        "Asia/Choibalsan",
    ],

    [CountryCode.MYANMAR]: [
        "Asia/Yangon",
    ],

    [CountryCode.NEPAL]: [
        "Asia/Kathmandu",
    ],

    [CountryCode.NORTH_KOREA]: [
        "Asia/Pyongyang",
    ],

    [CountryCode.OMAN]: [
        "Asia/Muscat",
    ],

    [CountryCode.PAKISTAN]: [
        "Asia/Karachi",
    ],

    [CountryCode.PALESTINE]: [
        "Asia/Gaza",
        "Asia/Hebron",
    ],

    [CountryCode.PHILIPPINES]: [
        "Asia/Manila",
    ],

    [CountryCode.QATAR]: [
        "Asia/Qatar",
    ],

    [CountryCode.SAUDI_ARABIA]: [
        "Asia/Riyadh",
    ],

    [CountryCode.SINGAPORE]: [
        "Asia/Singapore",
    ],

    [CountryCode.SOUTH_KOREA]: [
        "Asia/Seoul",
    ],

    [CountryCode.SRI_LANKA]: [
        "Asia/Colombo",
    ],

    [CountryCode.SYRIA]: [
        "Asia/Damascus",
    ],

    [CountryCode.TAIWAN]: [
        "Asia/Taipei",
    ],

    [CountryCode.TAJIKISTAN]: [
        "Asia/Dushanbe",
    ],

    [CountryCode.THAILAND]: [
        "Asia/Bangkok",
    ],

    [CountryCode.TIMOR_LESTE]: [
        "Asia/Dili",
    ],

    [CountryCode.TURKEY]: [
        "Europe/Istanbul",
    ],

    [CountryCode.TURKMENISTAN]: [
        "Asia/Ashgabat",
    ],

    [CountryCode.UNITED_ARAB_EMIRATES]: [
        "Asia/Dubai",
    ],

    [CountryCode.UZBEKISTAN]: [
        "Asia/Tashkent",
    ],

    [CountryCode.VIETNAM]: [
        "Asia/Ho_Chi_Minh",
    ],

    [CountryCode.YEMEN]: [
        "Asia/Aden",
    ],


    // ========================================================
    // Europe
    // ========================================================

    [CountryCode.ALBANIA]: [
        "Europe/Tirane",
    ],

    [CountryCode.ANDORRA]: [
        "Europe/Andorra",
    ],

    [CountryCode.AUSTRIA]: [
        "Europe/Vienna",
    ],

    [CountryCode.BELARUS]: [
        "Europe/Minsk",
    ],

    [CountryCode.BELGIUM]: [
        "Europe/Brussels",
    ],

    [CountryCode.BOSNIA_AND_HERZEGOVINA]: [
        "Europe/Sarajevo",
    ],

    [CountryCode.BULGARIA]: [
        "Europe/Sofia",
    ],

    [CountryCode.CROATIA]: [
        "Europe/Zagreb",
    ],

    [CountryCode.CZECH_REPUBLIC]: [
        "Europe/Prague",
    ],

    [CountryCode.DENMARK]: [
        "Europe/Copenhagen",
    ],

    [CountryCode.ESTONIA]: [
        "Europe/Tallinn",
    ],

    [CountryCode.FINLAND]: [
        "Europe/Helsinki",
    ],

    [CountryCode.FRANCE]: [
        "Europe/Paris",
    ],

    [CountryCode.GERMANY]: [
        "Europe/Berlin",
    ],

    [CountryCode.GREECE]: [
        "Europe/Athens",
    ],

    [CountryCode.HOLY_SEE]: [
        "Europe/Vatican",
    ],

    [CountryCode.HUNGARY]: [
        "Europe/Budapest",
    ],

    [CountryCode.ICELAND]: [
        "Atlantic/Reykjavik",
    ],

    [CountryCode.IRELAND]: [
        "Europe/Dublin",
    ],

    [CountryCode.ITALY]: [
        "Europe/Rome",
    ],

    [CountryCode.LATVIA]: [
        "Europe/Riga",
    ],

    [CountryCode.LIECHTENSTEIN]: [
        "Europe/Vaduz",
    ],

    [CountryCode.LITHUANIA]: [
        "Europe/Vilnius",
    ],

    [CountryCode.LUXEMBOURG]: [
        "Europe/Luxembourg",
    ],

    [CountryCode.MALTA]: [
        "Europe/Malta",
    ],

    [CountryCode.MOLDOVA]: [
        "Europe/Chisinau",
    ],

    [CountryCode.MONACO]: [
        "Europe/Monaco",
    ],

    [CountryCode.MONTENEGRO]: [
        "Europe/Podgorica",
    ],

    [CountryCode.NETHERLANDS]: [
        "Europe/Amsterdam",
    ],

    [CountryCode.NORTH_MACEDONIA]: [
        "Europe/Skopje",
    ],

    [CountryCode.NORWAY]: [
        "Europe/Oslo",
    ],

    [CountryCode.POLAND]: [
        "Europe/Warsaw",
    ],

    [CountryCode.PORTUGAL]: [
        "Europe/Lisbon",
        "Atlantic/Madeira",
        "Atlantic/Azores",
    ],

    [CountryCode.ROMANIA]: [
        "Europe/Bucharest",
    ],

    [CountryCode.RUSSIA]: [
        "Europe/Moscow",
        "Europe/Kaliningrad",
        "Europe/Volgograd",
        "Asia/Yekaterinburg",
        "Asia/Omsk",
        "Asia/Novosibirsk",
        "Asia/Barnaul",
        "Asia/Tomsk",
        "Asia/Novokuznetsk",
        "Asia/Krasnoyarsk",
        "Asia/Irkutsk",
        "Asia/Chita",
        "Asia/Yakutsk",
        "Asia/Khandyga",
        "Asia/Vladivostok",
        "Asia/Ust-Nera",
        "Asia/Magadan",
        "Asia/Sakhalin",
        "Asia/Srednekolymsk",
        "Asia/Kamchatka",
        "Asia/Anadyr",
    ],

    [CountryCode.SAN_MARINO]: [
        "Europe/San_Marino",
    ],

    [CountryCode.SERBIA]: [
        "Europe/Belgrade",
    ],

    [CountryCode.SLOVAKIA]: [
        "Europe/Bratislava",
    ],

    [CountryCode.SLOVENIA]: [
        "Europe/Ljubljana",
    ],

    [CountryCode.SPAIN]: [
        "Europe/Madrid",
        "Atlantic/Canary",
    ],

    [CountryCode.SWEDEN]: [
        "Europe/Stockholm",
    ],

    [CountryCode.SWITZERLAND]: [
        "Europe/Zurich",
    ],

    [CountryCode.UKRAINE]: [
        "Europe/Kyiv",
    ],

    [CountryCode.UNITED_KINGDOM]: [
        "Europe/London",
    ],


    // ========================================================
    // North America
    // ========================================================

    [CountryCode.ANTIGUA_AND_BARBUDA]: [
        "America/Antigua",
    ],

    [CountryCode.BAHAMAS]: [
        "America/Nassau",
    ],

    [CountryCode.BARBADOS]: [
        "America/Barbados",
    ],

    [CountryCode.BELIZE]: [
        "America/Belize",
    ],

    [CountryCode.CANADA]: [
        "America/St_Johns",
        "America/Halifax",
        "America/Glace_Bay",
        "America/Moncton",
        "America/Goose_Bay",
        "America/Blanc-Sablon",
        "America/Toronto",
        "America/Iqaluit",
        "America/Atikokan",
        "America/Winnipeg",
        "America/Resolute",
        "America/Rankin_Inlet",
        "America/Regina",
        "America/Swift_Current",
        "America/Edmonton",
        "America/Cambridge_Bay",
        "America/Inuvik",
        "America/Creston",
        "America/Dawson_Creek",
        "America/Fort_Nelson",
        "America/Whitehorse",
        "America/Dawson",
        "America/Vancouver",
    ],

    [CountryCode.COSTA_RICA]: [
        "America/Costa_Rica",
    ],

    [CountryCode.CUBA]: [
        "America/Havana",
    ],

    [CountryCode.DOMINICA]: [
        "America/Dominica",
    ],

    [CountryCode.DOMINICAN_REPUBLIC]: [
        "America/Santo_Domingo",
    ],

    [CountryCode.EL_SALVADOR]: [
        "America/El_Salvador",
    ],

    [CountryCode.GRENADA]: [
        "America/Grenada",
    ],

    [CountryCode.GUATEMALA]: [
        "America/Guatemala",
    ],

    [CountryCode.HAITI]: [
        "America/Port-au-Prince",
    ],

    [CountryCode.HONDURAS]: [
        "America/Tegucigalpa",
    ],

    [CountryCode.JAMAICA]: [
        "America/Jamaica",
    ],

    [CountryCode.MEXICO]: [
        "America/Mexico_City",
        "America/Cancun",
        "America/Merida",
        "America/Monterrey",
        "America/Matamoros",
        "America/Chihuahua",
        "America/Ojinaga",
        "America/Hermosillo",
        "America/Mazatlan",
        "America/Bahia_Banderas",
        "America/Tijuana",
    ],

    [CountryCode.NICARAGUA]: [
        "America/Managua",
    ],

    [CountryCode.PANAMA]: [
        "America/Panama",
    ],

    [CountryCode.SAINT_KITTS_AND_NEVIS]: [
        "America/St_Kitts",
    ],

    [CountryCode.SAINT_LUCIA]: [
        "America/St_Lucia",
    ],

    [CountryCode.SAINT_VINCENT_AND_THE_GRENADINES]: [
        "America/St_Vincent",
    ],

    [CountryCode.TRINIDAD_AND_TOBAGO]: [
        "America/Port_of_Spain",
    ],

    [CountryCode.UNITED_STATES]: [
        "America/New_York",
        "America/Detroit",
        "America/Kentucky/Louisville",
        "America/Kentucky/Monticello",
        "America/Indiana/Indianapolis",
        "America/Indiana/Vincennes",
        "America/Indiana/Winamac",
        "America/Indiana/Marengo",
        "America/Indiana/Petersburg",
        "America/Indiana/Vevay",
        "America/Chicago",
        "America/Indiana/Tell_City",
        "America/Indiana/Knox",
        "America/Menominee",
        "America/North_Dakota/Center",
        "America/North_Dakota/New_Salem",
        "America/North_Dakota/Beulah",
        "America/Denver",
        "America/Boise",
        "America/Phoenix",
        "America/Los_Angeles",
        "America/Anchorage",
        "America/Juneau",
        "America/Sitka",
        "America/Metlakatla",
        "America/Yakutat",
        "America/Nome",
        "America/Adak",
        "Pacific/Honolulu",
    ],


    // ========================================================
    // South America
    // ========================================================

    [CountryCode.ARGENTINA]: [
        "America/Argentina/Buenos_Aires",
        "America/Argentina/Catamarca",
        "America/Argentina/Cordoba",
        "America/Argentina/Jujuy",
        "America/Argentina/La_Rioja",
        "America/Argentina/Mendoza",
        "America/Argentina/Rio_Gallegos",
        "America/Argentina/Salta",
        "America/Argentina/San_Juan",
        "America/Argentina/San_Luis",
        "America/Argentina/Tucuman",
        "America/Argentina/Ushuaia",
    ],

    [CountryCode.BOLIVIA]: [
        "America/La_Paz",
    ],

    [CountryCode.BRAZIL]: [
        "America/Noronha",
        "America/Belem",
        "America/Fortaleza",
        "America/Recife",
        "America/Araguaina",
        "America/Maceio",
        "America/Bahia",
        "America/Sao_Paulo",
        "America/Campo_Grande",
        "America/Cuiaba",
        "America/Porto_Velho",
        "America/Boa_Vista",
        "America/Manaus",
        "America/Eirunepe",
        "America/Rio_Branco",
    ],

    [CountryCode.CHILE]: [
        "America/Santiago",
        "America/Punta_Arenas",
        "Pacific/Easter",
    ],

    [CountryCode.COLOMBIA]: [
        "America/Bogota",
    ],

    [CountryCode.ECUADOR]: [
        "America/Guayaquil",
        "Pacific/Galapagos",
    ],

    [CountryCode.GUYANA]: [
        "America/Guyana",
    ],

    [CountryCode.PARAGUAY]: [
        "America/Asuncion",
    ],

    [CountryCode.PERU]: [
        "America/Lima",
    ],

    [CountryCode.SURINAME]: [
        "America/Paramaribo",
    ],

    [CountryCode.URUGUAY]: [
        "America/Montevideo",
    ],

    [CountryCode.VENEZUELA]: [
        "America/Caracas",
    ],


    // ========================================================
    // Oceania
    // ========================================================

    [CountryCode.AUSTRALIA]: [
        "Australia/Lord_Howe",
        "Australia/Hobart",
        "Australia/Melbourne",
        "Australia/Sydney",
        "Australia/Broken_Hill",
        "Australia/Brisbane",
        "Australia/Lindeman",
        "Australia/Adelaide",
        "Australia/Darwin",
        "Australia/Perth",
        "Australia/Eucla",
    ],

    [CountryCode.FIJI]: [
        "Pacific/Fiji",
    ],

    [CountryCode.KIRIBATI]: [
        "Pacific/Tarawa",
        "Pacific/Kanton",
        "Pacific/Kiritimati",
    ],

    [CountryCode.MARSHALL_ISLANDS]: [
        "Pacific/Majuro",
        "Pacific/Kwajalein",
    ],

    [CountryCode.MICRONESIA]: [
        "Pacific/Chuuk",
        "Pacific/Pohnpei",
        "Pacific/Kosrae",
    ],

    [CountryCode.NAURU]: [
        "Pacific/Nauru",
    ],

    [CountryCode.NEW_ZEALAND]: [
        "Pacific/Auckland",
        "Pacific/Chatham",
    ],

    [CountryCode.PALAU]: [
        "Pacific/Palau",
    ],

    [CountryCode.PAPUA_NEW_GUINEA]: [
        "Pacific/Port_Moresby",
        "Pacific/Bougainville",
    ],

    [CountryCode.SAMOA]: [
        "Pacific/Apia",
    ],

    [CountryCode.SOLOMON_ISLANDS]: [
        "Pacific/Guadalcanal",
    ],

    [CountryCode.TONGA]: [
        "Pacific/Tongatapu",
    ],

    [CountryCode.TUVALU]: [
        "Pacific/Funafuti",
    ],

    [CountryCode.VANUATU]: [
        "Pacific/Efate",
    ],
};


// ============================================================
// Timezone Helpers
// ============================================================

export const getCountryTimezones = (
    countryCode: CountryCode
): string[] => {
    return COUNTRY_TIMEZONE_MAP[countryCode] ?? [];
};


export const getDefaultTimezoneForCountry = (
    countryCode: CountryCode
): string | null => {
    const timezones = getCountryTimezones(countryCode);

    return timezones.length > 0
        ? timezones[0]
        : null;
};


// ============================================================
// Validation
// ============================================================

export const isValidTimezone = (
    timezone: string
): boolean => {

    try {

        Intl.DateTimeFormat(
            "en-US",
            {
                timeZone: timezone,
            }
        );

        return true;

    } catch {

        return false;

    }
};


export const isTimezoneAvailableForCountry = (
    countryCode: CountryCode,
    timezone: string
): boolean => {

    return getCountryTimezones(countryCode).includes(
        timezone
    );

};