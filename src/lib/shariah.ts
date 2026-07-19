/**
 * Shariah-compliant PSX symbols (source: Sarmaaya Shariah universe, 288 symbols).
 *
 * No longer the source of truth: live KMIALLSHR index membership is, and this
 * set is only the fallback used when that call fails (see lib/sarmaaya.ts).
 * It is a frozen snapshot, so it drifts as companies enter and leave the index
 * -- prefer fixing the fetch over editing this list.
 */
export const SHARIAH_SYMBOLS: ReadonlySet<string> = new Set([
  "AWTX", "FIMM", "GEMMEL", "GEMPACRA", "GIL", "MEBL", "JVDC", "GHNI", "LUCK",
  "PSO", "MARI", "MLCF", "ENGROH", "PPL", "EFERT", "CHCC", "SHFA", "KEL",
  "CNERGY", "LOTCHEM", "AIRLINK", "HINOON", "PSEL", "OGDC", "FCCL", "AGP", "KOHC",
  "GAL", "SPSL", "DGKC", "NML", "SYS", "COLG", "SLM", "CRTM", "GLAXO",
  "KPUS", "NRL", "ITANZ", "EPCL", "FABL", "TGL", "POWER", "SGPL", "NESTLE",
  "KTML", "ACPL", "OTSU", "PICT", "STYLERS", "DCR", "CPPL", "HUBC", "ASL",
  "ISL", "FFC", "TOMCL", "INIL", "GCIL", "PKGS", "NETSOL", "WAFI", "BLUEX",
  "PAKOXY", "FML", "TELE", "GVGL", "SGF", "IMAGE", "PRL", "FFL", "GATM",
  "LCI", "ZAL", "ANL", "KSBP", "SITC", "MTL", "SSOM", "GGL", "GEMBCEM",
  "UNITY", "BIPL", "SHSML", "PTL", "SLGL", "LOADS", "RMPL", "OLPM", "MUGHAL",
  "UPFL", "HPL", "PIOC", "FHAM", "EPQL", "WASL", "BPL", "BERG", "BIFO",
  "NONS", "CLOV", "PREMA", "ECOP", "WAHN", "SZTM", "MACTER", "DCL", "AGTL",
  "NRSL", "HINO", "FEROZ", "FCL", "SYM", "FPJM", "GEMPAPL", "STL", "GWLC",
  "EMCO", "ALNRS", "ISIL", "SASML", "REWM", "MQTM", "SERT", "SANSM", "FIBLM",
  "FEM", "FRSM", "TATM", "TICL", "GATI", "UDPL", "OML", "AVN", "JATM",
  "PAKD", "PAKQATAR", "MRNS", "BNWM", "UDLI", "PPP", "SHDT", "FPRM", "BECO",
  "JSML", "FCEPL", "FANM", "ORM", "LIVEN", "FECM", "JDMT", "CHAS", "MFFL",
  "BFAGRO", "BCL", "ARCTM", "STJT", "ZIL", "IDRT", "CCM", "REDCO", "ASHT",
  "MERIT", "FTMM", "MFL", "UBDL", "GGGL", "IBLHL", "STML", "DNCC", "DAAG",
  "NSRM", "HAFL", "FZCM", "TOWL", "SINDM", "FECTC", "PIM", "BATA", "DADX",
  "CFL", "POML", "MSCL", "AKGL", "KCL", "FRCL", "DMC", "ELCM", "FASM",
  "BHAT", "STCL", "BNL", "SCL", "LPGL", "SEARL", "AHTM", "SNAI", "NATM",
  "SIEM", "GFIL", "KHYT", "SRR", "PQGTL", "BFMOD", "EXIDE", "ASTM", "ADAMS",
  "OCTOPUS", "GCWL", "ICCI", "SHCM", "BFBIO", "HRPL", "GOC", "SAPT", "LEUL",
  "BBFL", "BUXL", "ATBA", "QTECH", "FFLM", "GTYR", "RUPL", "GADT", "TRSM",
  "IDSM", "KOHE", "RPL", "HAEL", "SURC", "IREIT", "TCORP", "BAFS", "HALEON",
  "SARC", "ANTM", "INKL", "SEL", "AGIL", "WAVES", "BWHL", "MIRKS", "QUICE",
  "WAHDAT", "SPEL", "FTSM", "PSYL", "TREET", "CPHL", "KOHTM", "ZTL", "MACFL",
  "GDL", "PMRS", "SMCPL", "MWMP", "ITTEFAQ", "CEPB", "PAEL", "HCAR", "ELSM",
  "ABOT", "DINT", "GHGL", "CSAP", "ZAHID", "DOL", "PIBTL", "FLYNG", "JDWS",
  "DYNO", "HTL", "BTL", "TPLRF1", "THCCL", "DFSM", "ICL", "ARPL", "SSGC",
  "FATIMA", "ATRL", "IPAK", "ILP", "IBFL", "MEHT", "SNGP", "SRVI", "SAZEW",
]);

/** True when the given ticker is Shariah-compliant. */
export const isShariahSymbol = (ticker: string) =>
  SHARIAH_SYMBOLS.has(ticker.toUpperCase());
