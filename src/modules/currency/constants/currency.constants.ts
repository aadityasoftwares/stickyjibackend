import { CurrencyCode, CurrencyType } from "./currency.enums.js";

export const DEFAULT_CURRENCY_STATUS = true;
export const DEFAULT_CURRENCY_SYSTEM = true;
export const DEFAULT_CURRENCY_CODE = CurrencyCode.INR;
export const DEFAULT_CURRENCY_NAME = "Indian Rupee";
export const DEFAULT_CURRENCY_SYMBOL = "₹";
export const DEFAULT_CURRENCY_NUMERIC_CODE = "356";
export const DEFAULT_CURRENCY_DECIMAL_PLACES = 2;
export const DEFAULT_CURRENCY_TYPE = CurrencyType.FIAT;
export const CURRENCY_SYMBOL_MAP: Record<CurrencyCode, string> = {
    [CurrencyCode.AED]: "د.إ",
    [CurrencyCode.AFN]: "؋",
    [CurrencyCode.ALL]: "Lek",
    [CurrencyCode.AMD]: "֏",
    [CurrencyCode.ANG]: "ƒ",
    [CurrencyCode.AOA]: "Kz",
    [CurrencyCode.ARS]: "$",
    [CurrencyCode.AUD]: "$",
    [CurrencyCode.AWG]: "ƒ",
    [CurrencyCode.AZN]: "₼",

    [CurrencyCode.BAM]: "KM",
    [CurrencyCode.BBD]: "$",
    [CurrencyCode.BDT]: "৳",
    [CurrencyCode.BGN]: "лв",
    [CurrencyCode.BHD]: ".د.ب",
    [CurrencyCode.BIF]: "FBu",
    [CurrencyCode.BMD]: "$",
    [CurrencyCode.BND]: "$",
    [CurrencyCode.BOB]: "Bs.",
    [CurrencyCode.BRL]: "R$",
    [CurrencyCode.BSD]: "$",
    [CurrencyCode.BTN]: "Nu.",
    [CurrencyCode.BWP]: "P",
    [CurrencyCode.BYN]: "Br",
    [CurrencyCode.BZD]: "BZ$",

    [CurrencyCode.CAD]: "$",
    [CurrencyCode.CDF]: "FC",
    [CurrencyCode.CHF]: "CHF",
    [CurrencyCode.CLP]: "$",
    [CurrencyCode.CNY]: "¥",
    [CurrencyCode.COP]: "$",
    [CurrencyCode.CRC]: "₡",
    [CurrencyCode.CUP]: "$",
    [CurrencyCode.CVE]: "$",
    [CurrencyCode.CZK]: "Kč",

    [CurrencyCode.DJF]: "Fdj",
    [CurrencyCode.DKK]: "kr",
    [CurrencyCode.DOP]: "RD$",
    [CurrencyCode.DZD]: "دج",

    [CurrencyCode.EGP]: "£",
    [CurrencyCode.ERN]: "Nfk",
    [CurrencyCode.ETB]: "Br",
    [CurrencyCode.EUR]: "€",

    [CurrencyCode.FJD]: "$",
    [CurrencyCode.FKP]: "£",

    [CurrencyCode.GBP]: "£",
    [CurrencyCode.GEL]: "₾",
    [CurrencyCode.GHS]: "₵",
    [CurrencyCode.GIP]: "£",
    [CurrencyCode.GMD]: "D",
    [CurrencyCode.GNF]: "FG",
    [CurrencyCode.GTQ]: "Q",
    [CurrencyCode.GYD]: "$",

    [CurrencyCode.HKD]: "$",
    [CurrencyCode.HNL]: "L",
    [CurrencyCode.HTG]: "G",
    [CurrencyCode.HUF]: "Ft",

    [CurrencyCode.IDR]: "Rp",
    [CurrencyCode.ILS]: "₪",
    [CurrencyCode.INR]: "₹",
    [CurrencyCode.IQD]: "ع.د",
    [CurrencyCode.IRR]: "﷼",
    [CurrencyCode.ISK]: "kr",

    [CurrencyCode.JMD]: "J$",
    [CurrencyCode.JOD]: "د.ا",
    [CurrencyCode.JPY]: "¥",

    [CurrencyCode.KES]: "KSh",
    [CurrencyCode.KGS]: "с",
    [CurrencyCode.KHR]: "៛",
    [CurrencyCode.KMF]: "CF",
    [CurrencyCode.KPW]: "₩",
    [CurrencyCode.KRW]: "₩",
    [CurrencyCode.KWD]: "د.ك",
    [CurrencyCode.KYD]: "$",
    [CurrencyCode.KZT]: "₸",

    [CurrencyCode.LAK]: "₭",
    [CurrencyCode.LBP]: "ل.ل",
    [CurrencyCode.LKR]: "Rs",
    [CurrencyCode.LRD]: "$",
    [CurrencyCode.LSL]: "L",
    [CurrencyCode.LYD]: "ل.د",

    [CurrencyCode.MAD]: "د.م.",
    [CurrencyCode.MDL]: "L",
    [CurrencyCode.MGA]: "Ar",
    [CurrencyCode.MKD]: "ден",
    [CurrencyCode.MMK]: "K",
    [CurrencyCode.MNT]: "₮",
    [CurrencyCode.MOP]: "MOP$",
    [CurrencyCode.MRU]: "UM",
    [CurrencyCode.MUR]: "₨",
    [CurrencyCode.MVR]: "Rf",
    [CurrencyCode.MWK]: "MK",
    [CurrencyCode.MXN]: "$",
    [CurrencyCode.MYR]: "RM",
    [CurrencyCode.MZN]: "MT",

    [CurrencyCode.NAD]: "$",
    [CurrencyCode.NGN]: "₦",
    [CurrencyCode.NIO]: "C$",
    [CurrencyCode.NOK]: "kr",
    [CurrencyCode.NPR]: "₨",
    [CurrencyCode.NZD]: "$",

    [CurrencyCode.OMR]: "ر.ع.",

    [CurrencyCode.PAB]: "B/.",
    [CurrencyCode.PEN]: "S/",
    [CurrencyCode.PGK]: "K",
    [CurrencyCode.PHP]: "₱",
    [CurrencyCode.PKR]: "₨",
    [CurrencyCode.PLN]: "zł",
    [CurrencyCode.PYG]: "₲",

    [CurrencyCode.QAR]: "ر.ق",

    [CurrencyCode.RON]: "lei",
    [CurrencyCode.RSD]: "дин",
    [CurrencyCode.RUB]: "₽",
    [CurrencyCode.RWF]: "FRw",

    [CurrencyCode.SAR]: "﷼",
    [CurrencyCode.SBD]: "$",
    [CurrencyCode.SCR]: "₨",
    [CurrencyCode.SDG]: "ج.س.",
    [CurrencyCode.SEK]: "kr",
    [CurrencyCode.SGD]: "$",
    [CurrencyCode.SHP]: "£",
    [CurrencyCode.SLE]: "Le",
    [CurrencyCode.SOS]: "S",
    [CurrencyCode.SRD]: "$",
    [CurrencyCode.SSP]: "£",
    [CurrencyCode.STN]: "Db",
    [CurrencyCode.SYP]: "£",
    [CurrencyCode.SZL]: "E",

    [CurrencyCode.THB]: "฿",
    [CurrencyCode.TJS]: "ЅМ",
    [CurrencyCode.TMT]: "m",
    [CurrencyCode.TND]: "د.ت",
    [CurrencyCode.TOP]: "T$",
    [CurrencyCode.TRY]: "₺",
    [CurrencyCode.TTD]: "TT$",
    [CurrencyCode.TWD]: "NT$",
    [CurrencyCode.TZS]: "TSh",

    [CurrencyCode.UAH]: "₴",
    [CurrencyCode.UGX]: "USh",
    [CurrencyCode.USD]: "$",
    [CurrencyCode.UYU]: "$U",
    [CurrencyCode.UZS]: "лв",

    [CurrencyCode.VED]: "Bs.D",
    [CurrencyCode.VES]: "Bs.S",
    [CurrencyCode.VND]: "₫",
    [CurrencyCode.VUV]: "VT",

    [CurrencyCode.WST]: "T",

    [CurrencyCode.XAF]: "FCFA",
    [CurrencyCode.XCD]: "$",
    [CurrencyCode.XOF]: "CFA",
    [CurrencyCode.XPF]: "₣",

    [CurrencyCode.YER]: "﷼",

    [CurrencyCode.ZAR]: "R",
    [CurrencyCode.ZMW]: "ZK",
    [CurrencyCode.ZWL]: "$",
};

export const CURRENCY_DECIMAL_PLACES: Record<string, number> = {
    [CurrencyCode.BIF]: 0,
    [CurrencyCode.CLP]: 0,
    [CurrencyCode.DJF]: 0,
    [CurrencyCode.GNF]: 0,
    [CurrencyCode.IQD]: 3,
    [CurrencyCode.ISK]: 0,
    [CurrencyCode.JPY]: 0,
    [CurrencyCode.KMF]: 0,
    [CurrencyCode.KRW]: 0,
    [CurrencyCode.LAK]: 0,
    [CurrencyCode.LBP]: 2,
    [CurrencyCode.MGA]: 2,
    [CurrencyCode.PYG]: 0,
    [CurrencyCode.RWF]: 0,
    [CurrencyCode.TZS]: 0,
    [CurrencyCode.UGX]: 0,
    [CurrencyCode.VND]: 0,
    [CurrencyCode.VUV]: 0,
    [CurrencyCode.XAF]: 0,
    [CurrencyCode.XOF]: 0,
    [CurrencyCode.XPF]: 0,
};

export const getCurrencySymbol = (code: CurrencyCode): string => {
    return CURRENCY_SYMBOL_MAP[code] ?? code;
};

export const getCurrencyDecimalPlaces = (code: CurrencyCode): number => {
    return CURRENCY_DECIMAL_PLACES[code] ?? 2;
};
