// PSX symbol -> sector lookup used to auto-fill the sector when adding a stock.
//
// The values here MUST be one of the exact sector labels defined in StockManager
// (Autos, Banks, Cables, ...). They're the app's own short PSX labels, not the
// full exchange sector names, because sectors are stored as free text on the
// stock row -- see the note in StockManager.tsx.
//
// This is a curated seed of well-known / actively-traded PSX names, not the full
// list of ~466 listed companies. Symbols not present here fall back to the user's
// current sector selection ("Others" by default) and stay fully editable. To
// extend coverage, just add more `SYMBOL: 'Label'` entries below -- keep them
// grouped by sector and keep the label spelling identical to StockManager.

export const PSX_SECTORS: Record<string, string> = {
    // Banks (Commercial Banks)
    HBL: 'Banks', UBL: 'Banks', MCB: 'Banks', ABL: 'Banks', NBP: 'Banks',
    BAHL: 'Banks', BAFL: 'Banks', MEBL: 'Banks', FABL: 'Banks', AKBL: 'Banks',
    BOP: 'Banks', BIPL: 'Banks', SNBL: 'Banks', JSBL: 'Banks', SCBPL: 'Banks',
    HMB: 'Banks', SILK: 'Banks', SMBL: 'Banks',

    // Oil & Gas (Exploration + Marketing + Distribution)
    OGDC: 'Oil & Gas', PPL: 'Oil & Gas', POL: 'Oil & Gas', MARI: 'Oil & Gas',
    PSO: 'Oil & Gas', APL: 'Oil & Gas', SHEL: 'Oil & Gas', SNGP: 'Oil & Gas',
    SSGC: 'Oil & Gas', HTL: 'Oil & Gas', HASCOL: 'Oil & Gas',

    // Refinery -- its own sector rather than folded into Oil & Gas: refiners trade on
    // crack spreads and currency, not on crude prices the way E&P names do.
    ATRL: 'Refinery', NRL: 'Refinery', PRL: 'Refinery', CNERGY: 'Refinery',

    // Fertilizer
    ENGRO: 'Fertilizer', FFC: 'Fertilizer', EFERT: 'Fertilizer', FFBL: 'Fertilizer',
    FATIMA: 'Fertilizer', AGL: 'Fertilizer',

    // Cement
    LUCK: 'Cement', DGKC: 'Cement', MLCF: 'Cement', FCCL: 'Cement', KOHC: 'Cement',
    PIOC: 'Cement', CHCC: 'Cement', ACPL: 'Cement', BWCL: 'Cement', GWLC: 'Cement',
    THCCL: 'Cement', FLYNG: 'Cement', FECTC: 'Cement',

    // Power (Generation & Distribution)
    HUBC: 'Power', KEL: 'Power', KAPCO: 'Power', NPL: 'Power', NCPL: 'Power',
    ALTN: 'Power', LPL: 'Power', PKGP: 'Power', EPQL: 'Power',

    // Autos (Assemblers + Parts)
    INDU: 'Autos', HCAR: 'Autos', PSMC: 'Autos', MTL: 'Autos', AGTL: 'Autos',
    SAZEW: 'Autos', DFML: 'Autos', GTYR: 'Autos', BWHL: 'Autos', LOADS: 'Autos',
    EXIDE: 'Autos', ATBA: 'Autos',

    // Chemicals
    ICI: 'Chemicals', LOTCHEM: 'Chemicals', EPCL: 'Chemicals', BERG: 'Chemicals',
    SITC: 'Chemicals', ARPL: 'Chemicals', NRSL: 'Chemicals', GCIL: 'Chemicals',

    // Pharma
    GLAXO: 'Pharma', AGP: 'Pharma', SEARL: 'Pharma', HINOON: 'Pharma',
    FEROZ: 'Pharma', ABOT: 'Pharma', HALEON: 'Pharma', MACTER: 'Pharma',
    CPHL: 'Pharma', IBLHL: 'Pharma', BFBIO: 'Pharma',

    // Tech (Technology & Communication)
    SYS: 'Tech', TRG: 'Tech', NETSOL: 'Tech', AVN: 'Tech', PTC: 'Tech',
    WTL: 'Tech', TELE: 'Tech', AIRLINK: 'Tech',

    // Textiles (Composite / Spinning / Weaving)
    NML: 'Textiles', GATM: 'Textiles', ILP: 'Textiles', KTML: 'Textiles',
    NCL: 'Textiles', KML: 'Textiles', FML: 'Textiles', SAPT: 'Textiles',
    SFL: 'Textiles', GADT: 'Textiles',

    // Foods (Food & Personal Care)
    NESTLE: 'Foods', EFOODS: 'Foods', FCEPL: 'Foods', UPFL: 'Foods',
    NATF: 'Foods', COLG: 'Foods', MFFL: 'Foods',

    // Sugar
    JDWS: 'Sugar',

    // Tobacco
    PAKT: 'Tobacco', PMPK: 'Tobacco',

    // Glass & Ceramics
    TGL: 'Glass', GGL: 'Glass',

    // Insurance
    AICL: 'Insurance', EFUG: 'Insurance', EFUL: 'Insurance', IGIHL: 'Insurance',
    JGICL: 'Insurance', JLICL: 'Insurance', TPLI: 'Insurance', ATIL: 'Insurance',

    // Investments (Investment Cos / Holdings / Modaraba)
    AHCL: 'Investments', JSCL: 'Investments', DAWH: 'Investments',

    // Engineering (Steel / Pumps / etc.)
    ISL: 'Engineering', ASTL: 'Engineering', MUGHAL: 'Engineering', INIL: 'Engineering',
    CSAP: 'Engineering', KSBP: 'Engineering', ASL: 'Engineering', DSIL: 'Engineering',

    // Cables & Electrical Goods
    PAEL: 'Cables', PCAL: 'Cables', SIEM: 'Cables', WAVES: 'Cables', EMCO: 'Cables',

    // Packaging (Paper & Board)
    PKGS: 'Packaging', CPPL: 'Packaging', CEPB: 'Packaging', RPL: 'Packaging',

    // Leather & Tanneries
    SRVI: 'Leather', BATA: 'Leather',

    // Transport
    PIAA: 'Transport', PICT: 'Transport', PNSC: 'Transport', PIBTL: 'Transport',

    // REITS
    DCR: 'REITS',

    // Property
    TPLP: 'Property',
};

// Returns the mapped sector for a symbol, or undefined if we don't know it.
// Input is normalized the same way StockManager stores symbols (trimmed, upper).
export const getSectorForSymbol = (symbol: string): string | undefined => {
    const key = symbol.trim().toUpperCase();
    return key ? PSX_SECTORS[key] : undefined;
};
