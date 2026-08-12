/**
 * Dialex dialect catalog — IDs match live Dialex Cloud Run backend.
 */
(function (global) {
  const languages = [
    { id: "ar", name: "Arabic" },
    { id: "es", name: "Spanish" },
    { id: "en", name: "English" },
    { id: "pt", name: "Portuguese" },
    { id: "fr", name: "French" },
  ];

  const dialects = [
    // Arabic
    { id: "arabic_msa", languageId: "ar", name: "Modern Standard Arabic (MSA)", abbrev: "MSA" },
    { id: "arabic_emirati", languageId: "ar", name: "Emirati Arabic", abbrev: "AE" },
    { id: "arabic_saudi_najdi", languageId: "ar", name: "Saudi-Najdi Arabic", abbrev: "NJD" },
    { id: "arabic_saudi_hijazi", languageId: "ar", name: "Saudi-Hijazi Arabic", abbrev: "HJZ" },
    { id: "arabic_kuwaiti", languageId: "ar", name: "Kuwaiti Arabic", abbrev: "KW" },
    { id: "arabic_qatari", languageId: "ar", name: "Qatari Arabic", abbrev: "QA" },
    { id: "arabic_bahraini", languageId: "ar", name: "Bahraini Arabic", abbrev: "BH" },
    { id: "arabic_syrian_damascus", languageId: "ar", name: "Syrian Arabic (Damascus)", abbrev: "SY" },
    { id: "arabic_lebanese", languageId: "ar", name: "Lebanese Arabic", abbrev: "LB" },
    { id: "arabic_jordanian", languageId: "ar", name: "Jordanian Arabic", abbrev: "JO" },
    { id: "arabic_palestinian", languageId: "ar", name: "Palestinian Arabic", abbrev: "PS" },
    { id: "arabic_iraqi", languageId: "ar", name: "Iraqi Arabic", abbrev: "IQ" },
    { id: "arabic_egyptian", languageId: "ar", name: "Egyptian Arabic", abbrev: "EGY" },
    { id: "arabic_sudanese", languageId: "ar", name: "Sudanese Arabic", abbrev: "SD" },
    { id: "arabic_libyan", languageId: "ar", name: "Libyan Arabic", abbrev: "LY" },
    { id: "arabic_yemeni", languageId: "ar", name: "Yemeni Arabic", abbrev: "YE" },
    { id: "arabic_omani", languageId: "ar", name: "Omani Arabic", abbrev: "OM" },
    { id: "arabic_moroccan", languageId: "ar", name: "Moroccan Arabic", abbrev: "MA" },
    { id: "arabic_algerian", languageId: "ar", name: "Algerian Arabic", abbrev: "DZ" },
    { id: "arabic_tunisian", languageId: "ar", name: "Tunisian Arabic", abbrev: "TN" },
    // Spanish
    { id: "spanish_castilian", languageId: "es", name: "Castilian Spanish", abbrev: "ES" },
    { id: "spanish_andalusian", languageId: "es", name: "Andalusian Spanish", abbrev: "AN" },
    { id: "spanish_madrid", languageId: "es", name: "Madrid Spanish", abbrev: "MAD" },
    { id: "spanish_barcelona", languageId: "es", name: "Barcelona Spanish", abbrev: "BCN" },
    { id: "spanish_mexican", languageId: "es", name: "Mexican Spanish", abbrev: "MX" },
    { id: "spanish_argentine", languageId: "es", name: "Argentine Spanish", abbrev: "AR" },
    { id: "spanish_colombian", languageId: "es", name: "Colombian Spanish", abbrev: "CO" },
    { id: "spanish_peruvian", languageId: "es", name: "Peruvian Spanish", abbrev: "PE" },
    { id: "spanish_chilean", languageId: "es", name: "Chilean Spanish", abbrev: "CL" },
    { id: "spanish_venezuelan", languageId: "es", name: "Venezuelan Spanish", abbrev: "VE" },
    { id: "spanish_cuban", languageId: "es", name: "Cuban Spanish", abbrev: "CU" },
    { id: "spanish_dominican", languageId: "es", name: "Dominican Spanish", abbrev: "DO" },
    { id: "spanish_puerto_rican", languageId: "es", name: "Puerto Rican Spanish", abbrev: "PR" },
    // English
    { id: "english_american", languageId: "en", name: "American English", abbrev: "US" },
    { id: "english_cockney", languageId: "en", name: "Cockney English", abbrev: "CKY" },
    { id: "english_australian", languageId: "en", name: "Australian English", abbrev: "AU" },
    { id: "english_irish", languageId: "en", name: "Irish English", abbrev: "IE" },
    { id: "english_scottish", languageId: "en", name: "Scottish English", abbrev: "SCT" },
    { id: "english_south_african", languageId: "en", name: "South African English", abbrev: "ZA" },
    { id: "english_new_zealand", languageId: "en", name: "New Zealand English", abbrev: "NZ" },
    { id: "english_southern", languageId: "en", name: "Southern US English", abbrev: "SOU" },
    { id: "english_aave", languageId: "en", name: "African American Vernacular English", abbrev: "AAVE" },
    { id: "english_nigerian", languageId: "en", name: "Nigerian English", abbrev: "NG" },
    { id: "english_jamaican", languageId: "en", name: "Jamaican English", abbrev: "JM" },
    // Portuguese
    { id: "portuguese_carioca", languageId: "pt", name: "Brazilian Portuguese (Carioca)", abbrev: "BR" },
    { id: "portuguese_lisbon", languageId: "pt", name: "European Portuguese (Lisbon)", abbrev: "PT" },
    { id: "portuguese_angolan", languageId: "pt", name: "Angolan Portuguese", abbrev: "AO" },
    { id: "portuguese_mozambican", languageId: "pt", name: "Mozambican Portuguese", abbrev: "MZ" },
    // French
    { id: "french_parisian", languageId: "fr", name: "Parisian French", abbrev: "FR" },
    { id: "french_quebecois", languageId: "fr", name: "Québécois French", abbrev: "QC" },
    { id: "french_swiss", languageId: "fr", name: "Swiss French", abbrev: "CH" },
    { id: "french_marseille", languageId: "fr", name: "Marseille French", abbrev: "MRS" },
    { id: "french_lyonnais", languageId: "fr", name: "Lyonnais French", abbrev: "LYO" },
  ];

  /** Legacy DialectsOnX short keys → live Dialex IDs */
  const legacyKeyMap = {
    msa: "arabic_msa",
    uae: "arabic_emirati",
    saudi_najdi: "arabic_saudi_najdi",
    saudi_hijazi: "arabic_saudi_hijazi",
    kuwait: "arabic_kuwaiti",
    qatar: "arabic_qatari",
    syria: "arabic_syrian_damascus",
    lebanon: "arabic_lebanese",
    jordan: "arabic_jordanian",
    palestine: "arabic_palestinian",
    iraq: "arabic_iraqi",
    egypt: "arabic_egyptian",
    sudan: "arabic_sudanese",
    morocco: "arabic_moroccan",
    algeria: "arabic_algerian",
    tunisia: "arabic_tunisian",
    ar_msa: "arabic_msa",
    ar_egyptian: "arabic_egyptian",
    ar_sudanese: "arabic_sudanese",
    ar_bahraini: "arabic_bahraini",
  };

  function dialectsFor(languageId) {
    return dialects.filter((d) => d.languageId === languageId);
  }

  function dialectById(id) {
    return dialects.find((d) => d.id === id) || null;
  }

  function languageById(id) {
    return languages.find((l) => l.id === id) || null;
  }

  function defaultDialectFor(languageId) {
    const list = dialectsFor(languageId);
    return list[0] || null;
  }

  function normalizeDialectId(id) {
    if (!id) return null;
    if (dialectById(id)) return id;
    return legacyKeyMap[id] || null;
  }

  function isValidDialect(id) {
    return Boolean(normalizeDialectId(id));
  }

  global.DialexCatalog = {
    languages,
    dialects,
    legacyKeyMap,
    dialectsFor,
    dialectById,
    languageById,
    defaultDialectFor,
    normalizeDialectId,
    isValidDialect,
    DEFAULT_LANGUAGE: "ar",
    DEFAULT_DIALECT: "arabic_msa",
  };
})(typeof window !== "undefined" ? window : globalThis);
