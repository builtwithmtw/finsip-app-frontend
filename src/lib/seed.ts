import type { Sector } from "./types";

/**
 * Sector -> tickers, transcribed verbatim from claude.md.
 * This is our universe of stocks; prices, market caps and the 1D change are
 * fetched live from the Sarmaaya feed (see lib/sarmaaya.ts), which also
 * supplies Shariah status via KMIALLSHR membership.
 */
export const SECTOR_TICKERS: Record<Sector, string[]> = {
  "COMMERCIAL BANKS": ["MEBL", "BAHL", "UBL", "MCB", "NBP", "FABL", "AKBL", "BAFL", "BOP"],
  "OIL & GAS EXPLORATION COMPANIES": ["OGDC", "MARI", "PPL", "POL"],
  FERTILIZER: ["FFC", "EFERT", "FATIMA"],
  CEMENT: ["KOHC", "LUCK", "CHCC", "THCCL", "PIOC", "BWCL", "MLCF", "DGKC", "FCCL"],
  "FOOD & PERSONAL CARE PRODUCTS": ["NATF", "COLG", "UPFL", "ISIL", "NESTLE", "RMPL", "ZIL", "TOMCL", "QUICE", "CLOV", "TREET"],
  "INV. BANKS / INV. COS. / SECURITIES COS.": ["ENGROH"],
  "AUTOMOBILE ASSEMBLER": ["SAZEW", "ATLH", "GHNI", "GAL", "INDU", "MTL"],
  "TECHNOLOGY & COMMUNICATION": ["SYS", "SYM", "HUMNL", "PAKD", "AIRLINK", "AVN", "NETSOL", "PTC", "TRG"],
  "POWER GENERATION & DISTRIBUTION": ["NCPL", "NPL", "SGPL", "HUBC", "TSPL", "KAPCO"],
  PHARMACEUTICALS: ["HALEON", "AGP", "HINOON", "GLAXO", "SEARL", "ABOT"],
  "TEXTILE COMPOSITE": ["KHYT", "HAFL", "ILP", "FSWL", "SAPT", "SFL", "REDCO", "KTML", "JUBS", "GATM"],
  "OIL & GAS MARKETING COMPANIES": ["APL", "SNGP", "PSO", "SSGC", "WAFI"],
  CHEMICAL: ["LCI", "LOTCHEM", "EPCL", "NICL", "PAKOXY", "GCIL", "SITC", "ICL", "GGL", "BERG", "PPVC", "DAAG"],
  REFINERY: ["ATRL", "PRL"],
  TRANSPORT: ["PNSC", "PIBTL"],
  ENGINEERING: ["MUGHAL", "ISL", "CSAP", "BECO", "INIL"],
  "LEATHER & TANNERIES": ["SRVI", "SGF", "SUHJ", "BATA"],
  "PAPER & BOARD": ["PKGS", "MACFL", "SPEL", "PPP", "SEPL", "CPPL"],
  "REAL ESTATE INVESTMENT TRUST": ["DCR", "GRR"],
  "GLASS & CERAMICS": ["TGL", "FRCL", "GVGL", "KCL", "GHGL"],
  "CABLE & ELECTRICAL GOODS": ["PCAL", "EMCO", "PAEL", "FCL"],
  PROPERTY: ["JVDC"],
  "TEXTILE WEAVING": ["ASHT", "STJT", "PRWM", "ZTL"],
  MISCELLANEOUS: ["UDPL", "SHFA", "ARPAK", "GEMPACRA"],
};

/** Flat list of every ticker with its sector — the screener's universe. */
export const TICKERS: { ticker: string; sector: Sector }[] = (
  Object.entries(SECTOR_TICKERS) as [Sector, string[]][]
).flatMap(([sector, tickers]) => tickers.map((ticker) => ({ ticker, sector })));
