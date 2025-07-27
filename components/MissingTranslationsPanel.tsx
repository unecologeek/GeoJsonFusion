import React, { useMemo, useState, useCallback, useRef } from 'react';
import { FileAnalysisResult, GeoJSONFeatureCollection, GeoJSONFeature } from '../types';
import ScrollJumpButtons from './ScrollJumpButtons';

interface MissingTranslationsPanelProps {
  analysisA: FileAnalysisResult | null;
  analysisB: FileAnalysisResult | null;
  fileAData: GeoJSONFeatureCollection | null;
  fileBData: GeoJSONFeatureCollection | null;
  idProperty: string;
  manualTranslations: Record<string, Record<string, string>>;
  updateManualTranslation: (countryId: string, langKey: string, value: string) => void;
  allStructuralTranslationKeys: string[];
  countrySelections: Map<string, 'A' | 'B' | 'discard'>;
}

const findFeatureById = (
    data: GeoJSONFeatureCollection | null, 
    idValue: string | number, 
    idPropKey: string
): GeoJSONFeature | undefined => {
    if (!data || !idPropKey) return undefined;
    const idPropKeyLower = idPropKey.toLowerCase();
    return data.features.find(f => {
        const props = f.properties || {};
        const actualPropKeyInFeature = Object.keys(props).find(k => k.toLowerCase() === idPropKeyLower);
        const val = actualPropKeyInFeature ? props[actualPropKeyInFeature] : undefined;
        return val !== undefined && String(val) === String(idValue);
    });
};

const findPropValueIgnoreCase = (props: Record<string, any>, keyToFind: string): string | undefined => {
    const actualKey = Object.keys(props).find(k => k.toLowerCase() === keyToFind.toLowerCase());
    if (actualKey && props[actualKey] !== undefined && props[actualKey] !== null) {
        return String(props[actualKey]);
    }
    return undefined;
};

// Data from the user's Python script
const COUNTRIES_ISO_ALPHA2_TO_ALPHA3: Record<string, string> = {
    "AD": "AND", "BB": "BRB", "BH": "BHR", "CG": "COG", "CV": "CPV", 
    "CZ": "CZE", "DM": "DMA", "FM": "FSM", "FR": "FRA", // Added France
    "GD": "GRD", "KI": "KIR", "KM": "COM", "KP": "PRK", "LC": "LCA", 
    "LI": "LIE", "MC": "MCO", "MH": "MHL", "MK": "MKD", "MT": "MLT", 
    "MU": "MUS", "MV": "MDV", "NO": "NOR", // Added Norway
    "NR": "NRU", "PW": "PLW", "SC": "SYC", "SG": "SGP", "SM": "SMR", 
    "SZ": "SWZ", "TO": "TGA", "VA": "VAT", "WS": "WSM"
};
// Use 'zh-Hant' for Traditional Chinese as per CLDR standard
const CLDR_LANGS = ["ar","bn","de","el","en","es","fa","fr","he","hi","hu","id", "it","ja","ko","nl","pl","pt","ru","sv","tr","uk","ur","vi","zh","zh-Hant"];


const MissingTranslationsPanel: React.FC<MissingTranslationsPanelProps> = ({
  analysisA,
  analysisB,
  fileAData,
  fileBData,
  idProperty,
  manualTranslations,
  updateManualTranslation,
  allStructuralTranslationKeys,
  countrySelections,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [showDependentTranslations, setShowDependentTranslations] = useState<boolean>(true);
  const [filterText, setFilterText] = useState<string>('');

  // State for CLDR translations
  const [cldrDataSourceState, setCldrDataSourceState] = useState<Record<string, Record<string, string>> | null>(null);
  const [cldrLoadingState, setCldrLoadingState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [cldrMessage, setCldrMessage] = useState<string | null>(null);


  const fetchAndProcessCldrData = useCallback(async () => {
    setCldrLoadingState('loading');
    setCldrMessage("Fetching CLDR translation data from unicode.org...");
    
    const rawCldrDataPerLang: Record<string, any> = {};
    const fetchPromises: Promise<void>[] = [];

    for (const lang of CLDR_LANGS) {
        const url = `https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-localenames-full/main/${lang}/territories.json`;
        fetchPromises.push(
            fetch(url)
                .then(res => {
                    if (!res.ok) throw new Error(`Failed to fetch CLDR data for ${lang}: ${res.status}`);
                    return res.json();
                })
                .then(jsonData => {
                    rawCldrDataPerLang[lang] = jsonData?.main?.[lang]?.localeDisplayNames?.territories || {};
                })
                .catch(err => {
                    console.error(`Error fetching CLDR for ${lang}:`, err.message); // Log full error
                    rawCldrDataPerLang[lang] = {}; // Ensure entry exists even on error to avoid breaking downstream
                })
        );
    }

    try {
        await Promise.all(fetchPromises);

        setCldrMessage("Processing fetched CLDR data...");
        const transformedData: Record<string, Record<string, string>> = {};

        for (const [alpha2, iso3] of Object.entries(COUNTRIES_ISO_ALPHA2_TO_ALPHA3)) {
            const englishNameFromCldr = rawCldrDataPerLang["en"]?.[alpha2];
            if (!englishNameFromCldr) {
                console.warn(`CLDR: No English name found for ${alpha2} (${iso3}), skipping.`);
                continue;
            }

            const countryTranslationMap: Record<string, string> = {};
            for (const lang of CLDR_LANGS) { // lang here will be e.g. 'zh-Hant'
                countryTranslationMap[lang] = rawCldrDataPerLang[lang]?.[alpha2] || englishNameFromCldr; // Fallback to English
            }
            
            // Store by ISO A3 (uppercase)
            transformedData[iso3.toUpperCase()] = countryTranslationMap;
            // Also store by English name (lowercase) for flexible lookup
            transformedData[englishNameFromCldr.toLowerCase()] = countryTranslationMap;
        }

        setCldrDataSourceState(transformedData);
        setCldrLoadingState('loaded');
        setCldrMessage("CLDR translation data loaded and processed.");
        setTimeout(() => setCldrMessage(null), 7000);
        return transformedData; // Return data for immediate use

    } catch (error: any) {
        console.error("Error processing CLDR data:", error);
        setCldrDataSourceState(null);
        setCldrLoadingState('error');
        setCldrMessage(`Error fetching/processing CLDR data: ${error.message}. Check console for details.`);
        return null;
    }
  }, []);


  const featuresAndNamesById = useMemo(() => {
    if (!analysisA || !analysisB || !fileAData || !fileBData || !idProperty) return [];
    
    const idPropKeyLower = idProperty.toLowerCase();
    const map = new Map<string, { 
        idValue: string; 
        displayName: string; 
        featureA?: GeoJSONFeature; 
        featureB?: GeoJSONFeature;
        isDependency: boolean;
        englishName?: string; 
    }>();

    const countryDetailsMapA = new Map(analysisA.countryDetails.map(cd => [cd.name, cd]));
    const countryDetailsMapB = new Map(analysisB.countryDetails.map(cd => [cd.name, cd]));

    const allFeatureIdsInData = new Set<string>();
    [fileAData, fileBData].forEach(dataCol => {
        dataCol?.features.forEach(f => {
            const props = f.properties || {};
            const actualIdPropKey = Object.keys(props).find(k => k.toLowerCase() === idPropKeyLower);
            const idValRaw = actualIdPropKey ? props[actualIdPropKey] : undefined;
            if (idValRaw !== undefined && idValRaw !== null) {
                allFeatureIdsInData.add(String(idValRaw));
            }
        });
    });

    for (const idValStr of Array.from(allFeatureIdsInData).sort()) {
        const featureA = findFeatureById(fileAData, idValStr, idProperty);
        const featureB = findFeatureById(fileBData, idValStr, idProperty);

        if (!featureA && !featureB) continue;

        const propsA = featureA?.properties || {};
        const propsB = featureB?.properties || {};
        const namePropKeyAOriginal = analysisA.countryNameProperty; 
        const namePropKeyBOriginal = analysisB.countryNameProperty; 

        let primaryName = idValStr; 
        if (namePropKeyAOriginal) {
            const nameFromA = findPropValueIgnoreCase(propsA, namePropKeyAOriginal);
            if (nameFromA && nameFromA.trim()) primaryName = nameFromA.trim();
        }
        if (namePropKeyBOriginal) {
            const nameFromB = findPropValueIgnoreCase(propsB, namePropKeyBOriginal);
            if (nameFromB && nameFromB.trim() && (primaryName === idValStr || (!namePropKeyAOriginal && namePropKeyBOriginal))) {
                 primaryName = nameFromB.trim();
            }
        }
        
        const selection = countrySelections.get(primaryName);
        if (selection === 'discard') continue;

        let isDep = false;
        const detailA = countryDetailsMapA.get(primaryName);
        const detailB = countryDetailsMapB.get(primaryName);
        if (detailA?.isDependency) isDep = true;
        if (!isDep && detailB?.isDependency) isDep = true;

        let englishNameValue: string | undefined;
        const engKeys = ['name_en', 'name_eng']; 
        for (const engKey of engKeys) {
            const nameFromA = findPropValueIgnoreCase(propsA, engKey);
            if (nameFromA && nameFromA.trim()) { englishNameValue = nameFromA.trim(); break; }
            const nameFromB = findPropValueIgnoreCase(propsB, engKey);
            if (nameFromB && nameFromB.trim()) { englishNameValue = nameFromB.trim(); break; }
        }

        map.set(idValStr, { 
            idValue: idValStr, displayName: primaryName, featureA, featureB, isDependency: isDep, englishName: englishNameValue 
        });
    }
    return Array.from(map.values());
  }, [analysisA, analysisB, fileAData, fileBData, idProperty, countrySelections]);

  const countriesToDisplay = useMemo(() => {
    const lowercasedFilter = filterText.toLowerCase();
    return featuresAndNamesById.filter(item => {
        if (item.isDependency && !showDependentTranslations) {
            return false;
        }
        if (lowercasedFilter) {
            const nameMatch = item.displayName.toLowerCase().includes(lowercasedFilter);
            const idMatch = item.idValue.toLowerCase().includes(lowercasedFilter);
            if (!nameMatch && !idMatch) {
                return false;
            }
        }
        return true;
    });
  }, [featuresAndNamesById, showDependentTranslations, filterText]);


  const handleCldrLookup = useCallback(async () => {
    let currentCldrData = cldrDataSourceState;
    if (cldrLoadingState === 'loading') return;

    if (!currentCldrData && cldrLoadingState !== 'loaded') {
      setCldrMessage("Fetching CLDR data first...");
      currentCldrData = await fetchAndProcessCldrData();
      if (!currentCldrData) {
        return;
      }
    } else if (!currentCldrData) {
        setCldrMessage("CLDR data not available. Please try fetching again or check console.");
        return;
    }


    setCldrMessage("Performing CLDR translation lookup...");
    let translationsAppliedCount = 0;
    
    // Use a short timeout to allow the message to render before the blocking loop starts
    await new Promise(resolve => setTimeout(resolve, 50)); 

    for (const countryItem of countriesToDisplay) {
      const countryIdForApp = countryItem.idValue; 
      const appFeatureEnglishName = countryItem.englishName || countryItem.displayName;

      let cldrCountryEntry: Record<string, string> | undefined = undefined;

      if (countryIdForApp) {
        cldrCountryEntry = currentCldrData[String(countryIdForApp).toUpperCase()];
      }
      if (!cldrCountryEntry && appFeatureEnglishName) {
        cldrCountryEntry = currentCldrData[appFeatureEnglishName.toLowerCase()];
      }
      
      if (cldrCountryEntry) {
        const propsA = countryItem.featureA?.properties || {};
        const propsB = countryItem.featureB?.properties || {};
        for (const transKeyOriginalCase of allStructuralTranslationKeys) {
          const transKeyLower = transKeyOriginalCase.toLowerCase();
          const valA = findPropValueIgnoreCase(propsA, transKeyOriginalCase);
          const valB = findPropValueIgnoreCase(propsB, transKeyOriginalCase);
          let existingTranslationInOriginalData = valA ?? valB;
          const alreadyManuallyEntered = manualTranslations[countryIdForApp]?.[transKeyLower] !== undefined;

          if (existingTranslationInOriginalData === undefined && !alreadyManuallyEntered) {
            const langCodeMatch = transKeyLower.match(/_([a-z]{2,3}(?:-[a-z]{2,4})?)$/i);
            let targetLangCode = langCodeMatch ? langCodeMatch[1].toLowerCase() : null;
            
            let effectiveLangCodeForLookup = targetLangCode;
            if (targetLangCode === 'zht') {
                effectiveLangCodeForLookup = 'zh-Hant'; // Map 'zht' to 'zh-Hant'
            }

            if (effectiveLangCodeForLookup && effectiveLangCodeForLookup !== 'en' && effectiveLangCodeForLookup !== 'eng') {
              const foundTranslation = cldrCountryEntry[effectiveLangCodeForLookup];
              if (foundTranslation) {
                updateManualTranslation(countryIdForApp, transKeyLower, foundTranslation);
                translationsAppliedCount++;
              }
            }
          }
        }
      }
    }

    setCldrMessage(`CLDR lookup complete. ${translationsAppliedCount} translations applied.`);
    setTimeout(() => setCldrMessage(null), 5000);

  }, [
    cldrDataSourceState, 
    countriesToDisplay, 
    allStructuralTranslationKeys, 
    manualTranslations, 
    updateManualTranslation, 
    cldrLoadingState, 
    fetchAndProcessCldrData
  ]);


  if (!analysisA || !analysisB || !idProperty || allStructuralTranslationKeys.length === 0) {
    return null; 
  }
  
  const hasContentToShow = featuresAndNamesById.length > 0;

  let buttonText = "Fetch & Apply CLDR Translations";
  if (cldrLoadingState === 'loading') buttonText = "Loading CLDR Data...";
  else if (cldrLoadingState === 'loaded' && cldrDataSourceState) buttonText = "Apply CLDR Translations";
  else if (cldrLoadingState === 'error') buttonText = "Retry CLDR Fetch & Apply";

  return (
    <div ref={panelRef} className="relative" aria-labelledby="manual-translation-heading">
      <ScrollJumpButtons targetElementRef={panelRef} thresholdHeightPx={400} />
      
      {!hasContentToShow ? (
         <p className="text-slate-400">No countries available for translation (they might all be discarded or the ID property isn't resolving correctly), or no structural translation keys were found.</p>
      ) : (
      <>
        <p className="text-slate-400 mb-2 text-sm">
          Review and fill in translations in the table below. Input fields are color-coded by status. Manual entries take highest precedence.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 items-center mb-4 text-xs text-slate-300">
            <div className="font-semibold">Legend:</div>
            <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm bg-sky-900/70 border border-sky-700"></span>Manually Edited</div>
            <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm bg-emerald-900/60 border border-emerald-700"></span>Exists in Source</div>
            <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm bg-rose-900/60 border border-rose-700"></span>Missing</div>
        </div>
        <p className="text-slate-400 mb-4 text-xs">
          Use the CLDR button to automatically fill missing fields. Hover over an input to see its status.
        </p>

        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-4 items-end">
            <label htmlFor="showDependentToggle" className="flex items-center space-x-2 cursor-pointer text-sm text-slate-300 hover:text-sky-300 transition-colors">
            <input type="checkbox" id="showDependentToggle" checked={showDependentTranslations} onChange={(e) => setShowDependentTranslations(e.target.checked)} className="form-checkbox h-4 w-4 text-sky-500 bg-slate-600 border border-slate-500 rounded focus:ring-sky-500" />
            <span>Show translations for dependent territories</span>
            </label>
            <div className="flex-grow max-w-sm">
                <label htmlFor="translation-filter" className="block text-sm font-medium text-slate-300 mb-1">
                    Filter by Name or ID
                </label>
                <input
                    id="translation-filter"
                    type="text"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="e.g., France, USA, FRA..."
                    className="w-full p-2 bg-slate-900 border border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-slate-100 placeholder:text-slate-400 text-sm"
                />
            </div>
        </div>

        <div className="mb-4">
            <button
              onClick={handleCldrLookup}
              disabled={cldrLoadingState === 'loading' || countriesToDisplay.length === 0}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 text-sm"
              title="Attempt to fill missing fields using CLDR translation data"
            >
              {cldrLoadingState === 'loading' && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              )}
              {buttonText}
            </button>
            {cldrMessage && (
                <p className={`text-xs mt-1 inline-block ml-4 ${cldrLoadingState === 'error' ? 'text-red-400' : 'text-slate-400'}`}>{cldrMessage}</p>
            )}
        </div>
        
        <div className="overflow-x-auto custom-scrollbar border border-slate-700 rounded-lg">
            <table className="min-w-full text-sm border-separate border-spacing-0">
                <thead className="bg-slate-700 sticky top-0 z-10">
                    <tr>
                        <th scope="col" className="p-3 text-left font-semibold text-slate-300 sticky left-0 bg-slate-700 z-20 border-b border-r border-slate-600">
                           <div className="w-48">Country / ID</div>
                        </th>
                        {allStructuralTranslationKeys.map(transKey => (
                            <th key={transKey} scope="col" className="p-3 text-left font-semibold text-slate-300 whitespace-nowrap border-b border-r border-slate-600">
                                {transKey}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                    {countriesToDisplay.length > 0 ? countriesToDisplay.map((item) => {
                        const countryIdentifier = item.idValue;
                        const propsA = item.featureA?.properties || {};
                        const propsB = item.featureB?.properties || {};
                        const defaultFillName = item.englishName || item.displayName;
                        const rowBGClass = item.isDependency ? 'bg-amber-900/10' : 'bg-slate-800';

                        return (
                            <tr key={countryIdentifier} className={`group hover:bg-slate-700/50 ${rowBGClass}`}>
                                <td className={`p-3 font-semibold text-sky-300 sticky left-0 group-hover:bg-slate-700/50 z-10 border-r border-slate-600 ${rowBGClass}`}>
                                    <div className="w-48 truncate" title={item.displayName}>{item.displayName}</div>
                                    <div className="text-xs text-slate-400 font-normal">({idProperty}: {countryIdentifier})</div>
                                </td>
                                {allStructuralTranslationKeys.map(transKeyOriginalCase => {
                                    const transKeyLower = transKeyOriginalCase.toLowerCase();
                                    const valueFromSource = findPropValueIgnoreCase(propsA, transKeyOriginalCase) ?? findPropValueIgnoreCase(propsB, transKeyOriginalCase);
                                    const manuallyEnteredValue = manualTranslations[countryIdentifier]?.[transKeyLower];
                                    
                                    const isManual = manuallyEnteredValue !== undefined;
                                    const isExisting = valueFromSource !== undefined;

                                    const valueForInput = manuallyEnteredValue ?? valueFromSource ?? '';
                                    
                                    let hintText: string;
                                    let customClasses: string;
                                    let placeholderText: string | undefined = undefined;

                                    if (isManual) {
                                        hintText = `Edited. Original: ${valueFromSource ?? 'N/A'}`;
                                        customClasses = 'bg-sky-900/70 border-sky-700';
                                    } else if (isExisting) {
                                        hintText = `Exists in source data. Value: ${valueFromSource}`;
                                        customClasses = 'bg-emerald-900/60 border-emerald-700';
                                    } else { // isMissing
                                        hintText = `Missing. Default name: '${defaultFillName}'`;
                                        customClasses = 'bg-rose-900/60 border-rose-700';
                                        placeholderText = defaultFillName;
                                    }


                                    return (
                                        <td key={transKeyLower} className="p-2 align-middle w-48 min-w-[12rem] border-r border-slate-700">
                                            <input
                                                type="text"
                                                title={hintText}
                                                value={valueForInput}
                                                placeholder={placeholderText}
                                                onChange={(e) => updateManualTranslation(countryIdentifier, transKeyLower, e.target.value)}
                                                className={`w-full p-2 text-sm border rounded-md shadow-sm focus:ring-sky-500 focus:ring-1 text-slate-100 placeholder:text-slate-500 ${customClasses}`}
                                            />
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    }) : (
                        <tr>
                             <td colSpan={allStructuralTranslationKeys.length + 1} className="text-center text-slate-400 py-6">
                                {filterText ? `No countries match the filter "${filterText}".` : 'No countries match the current filters (e.g., all might be dependent and hidden). Adjust toggles above.'}
                             </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </>
      )}
    </div>
  );
};

export default MissingTranslationsPanel;