
import React, { useState, useEffect, useCallback, useMemo } from 'react';
// REMOVE: import { AVAILABLE_FILES } from './data/sampleGeoJSON';
import { 
  FileSource, 
  FileAnalysisResult, 
  GeoJSONFeatureCollection, 
  MergeConfig, 
  SetMergeConfigFn,
  PropertySourcePreference, 
  OtherPropertyDetail, 
  OtherPropertiesPrimaryOption, 
  MergeConfigStructuredCharacteristicKey, 
  MergeConfigEntitySubKey,
  MergeConfigPropertySubKey,
  MergeSourceOption
} from './types';
import { analyzeGeoJSON, mergeGeoJSONs } from './services/geojsonService';
import FileSelectionPanel from './components/FileSelectionPanel';
import AnalysisCard from './components/AnalysisCard';
import MergeControlPanel from './components/MergeControlPanel';
import ResultPanel from './components/ResultPanel';
import CountryComparisonTable from './components/CountryComparisonTable'; 
import MissingTranslationsPanel from './components/MissingTranslationsPanel';
import SettingsManagementPanel from './components/SettingsManagementPanel';
import CollapsiblePanel from './components/CollapsiblePanel';

export type CountrySelectionChoice = 'A' | 'B' | 'discard';

// Define the settings structure
interface AppSettings {
  version: number;
  mergeConfig: MergeConfig;
  countrySelections: Record<string, CountrySelectionChoice>;
  manualTranslations: Record<string, Record<string, string>>;
}
const SETTINGS_FILE_VERSION = 1;


const App: React.FC = () => {
  const [availableFilesList, setAvailableFilesList] = useState<FileSource[]>([]);
  const [manifestError, setManifestError] = useState<string | null>(null);

  const [selectedFileAKey, setSelectedFileAKey] = useState<string | null>(null);
  const [selectedFileBKey, setSelectedFileBKey] = useState<string | null>(null);

  const [fileAData, setFileAData] = useState<GeoJSONFeatureCollection | null>(null);
  const [fileBData, setFileBData] = useState<GeoJSONFeatureCollection | null>(null);

  const [analysisA, setAnalysisA] = useState<FileAnalysisResult | null>(null);
  const [analysisB, setAnalysisB] = useState<FileAnalysisResult | null>(null);
  
  const [defaultIdProperty, setDefaultIdProperty] = useState<string>('iso_a3'); 

  const [mergeConfig, setMergeConfig] = useState<MergeConfig>({
    idProperty: defaultIdProperty, 
    geometryPrecision: 6, 
    geometrySource: { 
      recognized: { additive: false },
      dependent: { additive: false },
    },
    translationsSource: {
      recognized: { primary: 'fileA', additive: true },
      dependent: { primary: 'fileA', additive: true },
    },
    otherPropertiesSource: { 
      recognized: { primary: 'fileA', additive: true, selectedProperties: {} }, 
      dependent: { primary: 'fileA', additive: true, selectedProperties: {} },
    },
  });

  const [mergedData, setMergedData] = useState<GeoJSONFeatureCollection | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingErrorA, setLoadingErrorA] = useState<string | null>(null);
  const [loadingErrorB, setLoadingErrorB] = useState<string | null>(null);

  const [countrySelections, setCountrySelections] = useState<Map<string, CountrySelectionChoice>>(new Map());

  const [manualTranslations, setManualTranslations] = useState<Record<string, Record<string, string>>>({});
  const [allStructuralTranslationKeys, setAllStructuralTranslationKeys] = useState<string[]>([]);

  const [settingsMessage, setSettingsMessage] = useState<string | null>(null); // For save/load feedback

  const updateManualTranslation = useCallback((countryId: string, langKey: string, value: string) => {
    setManualTranslations(prev => ({
      ...prev,
      [countryId]: {
        ...(prev[countryId] || {}),
        [langKey.toLowerCase()]: value, // Store langKey as lowercase
      },
    }));
  }, []);

  useEffect(() => {
    const keys = new Set<string>();
    const nameTranslationPattern = /^(name|admin|official_name|country_name|sovereignt|cntry_name|cntrynam|name_long|formal_en)(_[a-z]{2,3})?$/i;
    const editableIdKeys = ['iso_a3', 'sov_a3', 'adm0_a3'];

    [analysisA, analysisB].forEach(analysis => {
      if (analysis?.commonProperties) {
        analysis.commonProperties.forEach(key => { // commonProperties are already lowercase
          if (nameTranslationPattern.test(key) || editableIdKeys.includes(key)) {
            keys.add(key);
          }
        });
      }
      if (analysis?.countryNameProperty) keys.add(analysis.countryNameProperty);
    });
    
    const finalKeys = Array.from(keys);
    // Custom sort to bring important keys to the front
    finalKeys.sort((a, b) => {
        const idKeys = ['iso_a3', 'sov_a3', 'adm0_a3'];
        const aIsId = idKeys.includes(a);
        const bIsId = idKeys.includes(b);

        if (aIsId && !bIsId) return -1;
        if (!aIsId && bIsId) return 1;
        if (aIsId && bIsId) return idKeys.indexOf(a) - idKeys.indexOf(b);

        const primaryNameA = analysisA?.countryNameProperty;
        const primaryNameB = analysisB?.countryNameProperty;

        const aIsPrimaryName = a === primaryNameA || a === primaryNameB;
        const bIsPrimaryName = b === primaryNameA || b === primaryNameB;

        if (aIsPrimaryName && !bIsPrimaryName) return -1;
        if (!aIsPrimaryName && bIsPrimaryName) return 1;

        // For other keys, sort alphabetically
        return a.localeCompare(b);
    });

    setAllStructuralTranslationKeys(finalKeys);
  }, [analysisA, analysisB]);


  const updateCountrySelection = useCallback((name: string, choice: CountrySelectionChoice | null) => {
    setCountrySelections(prev => {
      const newMap = new Map(prev);
      if (choice === null) {
        newMap.delete(name); // null means clear selection, go back to default
      } else {
        newMap.set(name, choice);
      }
      return newMap;
    });
  }, []);

  const setAllDisplayedEntriesSelection = useCallback((updates: Map<string, CountrySelectionChoice | null>) => {
    setCountrySelections(prev => {
      const newMap = new Map(prev);
      updates.forEach((choice, name) => {
        if (choice === null) { // null signifies clearing/deleting the entry
          newMap.delete(name);
        } else {
          newMap.set(name, choice);
        }
      });
      return newMap;
    });
  }, []);

  // Effect to set default selections for countries that are only in one file
  useEffect(() => {
    if (!analysisA || !analysisB) {
      return; // Wait for both files to be analyzed
    }

    const mapA = new Map(analysisA.countryDetails.map(cd => [cd.name, cd]));
    const mapB = new Map(analysisB.countryDetails.map(cd => [cd.name, cd]));
    const allCurrentNames = new Set([...mapA.keys(), ...mapB.keys()]);

    setCountrySelections(prevSelections => {
      const newSelections = new Map(prevSelections);
      let changed = false;

      // Clean up selections for countries that no longer exist in either file
      for (const name of prevSelections.keys()) {
        if (!allCurrentNames.has(name)) {
          newSelections.delete(name);
          changed = true;
        }
      }
      
      // Set defaults for new entries that don't already have a selection
      for (const name of allCurrentNames) {
        if (!newSelections.has(name)) { // Only set default if no selection exists
          const inA = mapA.has(name);
          const inB = mapB.has(name);
          if (inA && !inB) {
            newSelections.set(name, 'A');
            changed = true;
          } else if (!inA && inB) {
            newSelections.set(name, 'B');
            changed = true;
          }
        }
      }

      return changed ? newSelections : prevSelections;
    });
  }, [analysisA, analysisB]);


  useEffect(() => {
    fetch('/data/manifest.json')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load file list manifest (/data/manifest.json). Status: ${response.status}. Ensure the file exists and is valid JSON.`);
        }
        return response.json();
      })
      .then((data: FileSource[]) => {
        if (!Array.isArray(data) || !data.every(item => typeof item.key === 'string' && typeof item.name === 'string' && typeof item.path === 'string')) {
          throw new Error('Invalid manifest.json structure. Expected an array of {key: string, name: string, path: string}.');
        }
        setAvailableFilesList(data);
        setManifestError(null);
      })
      .catch(err => {
        console.error("Error loading or parsing manifest.json:", err);
        setAvailableFilesList([]);
        setManifestError(err.message);
        setSelectedFileAKey(null); 
        setSelectedFileBKey(null);
      });
  }, []); 


  const updateMergeConfig: SetMergeConfigFn = useCallback(
    (
      key: MergeConfigStructuredCharacteristicKey | 'idProperty' | 'geometryPrecision' | 'geometrySource', 
      value: string | boolean | { name: string; selected: boolean } | Record<string, boolean> | number, 
      entitySubKey?: MergeConfigEntitySubKey, 
      propertySubKey?: MergeConfigPropertySubKey 
    ) => {
      setMergeConfig(prev => {
        const newConfig = JSON.parse(JSON.stringify(prev)) as MergeConfig; 

        if (key === 'idProperty' && typeof value === 'string') {
          newConfig.idProperty = value; 
        } else if (key === 'geometryPrecision' && typeof value === 'number') {
          newConfig.geometryPrecision = Math.max(0, Math.min(10, value)); 
        } else if (key === 'geometrySource' && entitySubKey) { 
            const characteristic = newConfig[key] as { recognized: { additive: boolean }; dependent: { additive: boolean } };
            if (entitySubKey === 'recognized' || entitySubKey === 'dependent') { 
                const entitySpecificConfig = characteristic[entitySubKey];
                if (propertySubKey === 'additive' && typeof value === 'boolean') {
                    entitySpecificConfig.additive = value;
                }
            }
        } else if (entitySubKey && (key === 'translationsSource' || key === 'otherPropertiesSource') ) { 
            if (key === 'translationsSource') {
                 const characteristic = newConfig[key] as { recognized: PropertySourcePreference; dependent: PropertySourcePreference };
                 if (entitySubKey === 'recognized' || entitySubKey === 'dependent') { 
                    const entitySpecificConfig = characteristic[entitySubKey];
                    if (propertySubKey === 'primary' && typeof value === 'string') { 
                        if (entitySubKey === 'dependent' && (value === 'fileA' || value === 'fileB' || value === 'discard')) {
                            entitySpecificConfig.primary = value as MergeSourceOption | 'discard';
                            if (value === 'discard') {
                                entitySpecificConfig.additive = false;
                            }
                        } else if (entitySubKey === 'recognized' && (value === 'fileA' || value === 'fileB')) { 
                            entitySpecificConfig.primary = value as MergeSourceOption;
                        }
                    } else if (propertySubKey === 'additive' && typeof value === 'boolean') {
                        if (!(entitySubKey === 'dependent' && entitySpecificConfig.primary === 'discard')) {
                           entitySpecificConfig.additive = value;
                        }
                    }
                 }
            } else if (key === 'otherPropertiesSource') {
                const characteristic = newConfig[key] as { recognized: OtherPropertyDetail; dependent: OtherPropertyDetail };
                if (entitySubKey === 'recognized' || entitySubKey === 'dependent') { 
                    const entitySpecificConfig = characteristic[entitySubKey];
                    if (propertySubKey === 'primary' && typeof value === 'string') { 
                        entitySpecificConfig.primary = value as OtherPropertiesPrimaryOption;
                        if (value === 'discard') {
                            entitySpecificConfig.additive = false; 
                            entitySpecificConfig.selectedProperties = {}; 
                        }
                    } else if (propertySubKey === 'additive' && typeof value === 'boolean') {
                        if (entitySpecificConfig.primary !== 'discard') {
                           entitySpecificConfig.additive = value;
                        }
                    } else if (propertySubKey === 'toggleSelectedProperty' && typeof value === 'object' && value !== null && 'name' in value && 'selected' in value) {
                        entitySpecificConfig.selectedProperties[(value as {name: string}).name] = (value as {selected: boolean}).selected;
                    } else if (propertySubKey === 'setSelectedPropertiesMap' && typeof value === 'object' && value !== null) {
                        entitySpecificConfig.selectedProperties = value as Record<string, boolean>;
                    }
                }
            }
        }
        return newConfig;
      });
    },
    []
  );
  
  useEffect(() => {
    const nameTranslationPattern = /^(name|admin|official_name|country_name|sovereignt|cntry_name|cntrynam|name_long|formal_en)(_[a-z]{2,3})?$/i;
    
    const coreIdKeys = new Set<string>();
    if (mergeConfig.idProperty) coreIdKeys.add(mergeConfig.idProperty.toLowerCase()); 
    if (analysisA?.countryNameProperty) coreIdKeys.add(analysisA.countryNameProperty.toLowerCase());
    if (analysisA?.sovereigntyPropertyKey) coreIdKeys.add(analysisA.sovereigntyPropertyKey.toLowerCase());
    if (analysisB?.countryNameProperty) coreIdKeys.add(analysisB.countryNameProperty.toLowerCase());
    if (analysisB?.sovereigntyPropertyKey) coreIdKeys.add(analysisB.sovereigntyPropertyKey.toLowerCase());

    (['recognized', 'dependent'] as MergeConfigEntitySubKey[]).forEach(entityType => {
      const config = mergeConfig.otherPropertiesSource[entityType];
      const currentSelectedProps = config.selectedProperties; 
      
      if (config.primary === 'discard') {
        if (Object.keys(currentSelectedProps).length > 0) {
          updateMergeConfig('otherPropertiesSource', {}, entityType, 'setSelectedPropertiesMap');
        }
        return; 
      }

      const primaryPropsList = config.primary === 'fileA' ? analysisA?.commonProperties : analysisB?.commonProperties;
      const secondaryPropsList = config.primary === 'fileA' ? analysisB?.commonProperties : analysisA?.commonProperties;
      
      const potentialKeysFromStrategy = new Set<string>();
      if (primaryPropsList) {
        primaryPropsList.forEach(key => potentialKeysFromStrategy.add(key)); 
      }
      if (config.additive && secondaryPropsList) {
        secondaryPropsList.forEach(key => potentialKeysFromStrategy.add(key)); 
      }

      const actualOtherKeysToShow = Array.from(potentialKeysFromStrategy).filter(key => 
        !nameTranslationPattern.test(key) && !coreIdKeys.has(key)
      );
      
      const newCalculatedSelectedProps: Record<string, boolean> = {};
      let changed = false;

      actualOtherKeysToShow.forEach(key => { 
        const currentVal = currentSelectedProps[key];
        const newVal = currentVal === false ? false : true; 
        newCalculatedSelectedProps[key] = newVal;
        if (currentVal !== newVal) changed = true;
      });
      
      
      for (const keyInCurrent in currentSelectedProps) {
        if (!newCalculatedSelectedProps.hasOwnProperty(keyInCurrent)) {
          changed = true;
          break;
        }
      }

      if (changed || Object.keys(currentSelectedProps).length !== Object.keys(newCalculatedSelectedProps).length) {
         updateMergeConfig('otherPropertiesSource', newCalculatedSelectedProps, entityType, 'setSelectedPropertiesMap');
      }
    });
  }, [
    analysisA, 
    analysisB, 
    mergeConfig.otherPropertiesSource.recognized.primary, 
    mergeConfig.otherPropertiesSource.recognized.additive, 
    mergeConfig.otherPropertiesSource.dependent.primary, 
    mergeConfig.otherPropertiesSource.dependent.additive,
    mergeConfig.idProperty, 
    updateMergeConfig 
  ]);


  const setIdPropertyForMerge = useCallback((idProp: string) => {
    updateMergeConfig('idProperty', idProp.toLowerCase());
  },[updateMergeConfig]);


  useEffect(() => {
    if (selectedFileAKey) {
      const fileSource = availableFilesList.find(f => f.key === selectedFileAKey);
      if (fileSource) {
        setLoadingErrorA(null);
        setFileAData(null); 
        setAnalysisA(null); 
        fetch(fileSource.path)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Failed to load ${fileSource.name} (status: ${response.status}). Check console for more details.`);
            }
            return response.json();
          })
          .then((data: GeoJSONFeatureCollection) => {
            if (typeof data !== 'object' || data === null || data.type !== 'FeatureCollection') {
                throw new Error(`Invalid GeoJSON structure loaded for ${fileSource.name}. Expected FeatureCollection.`);
            }
            setFileAData(data);
            setAnalysisA(analyzeGeoJSON(fileSource.name, data));
          })
          .catch(err => {
            console.error(`Error loading or parsing file A (${fileSource.path}):`, err);
            setFileAData(null);
            setAnalysisA(null);
            setLoadingErrorA(err.message);
          });
      } else if (availableFilesList.length > 0) { 
        setFileAData(null);
        setAnalysisA(null);
        setLoadingErrorA(`File key "${selectedFileAKey}" not found in manifest.`);
      } else { 
        setFileAData(null);
        setAnalysisA(null);
        setLoadingErrorA(null);
      }
    } else {
      setFileAData(null);
      setAnalysisA(null);
      setLoadingErrorA(null);
      setManualTranslations({});
      setAllStructuralTranslationKeys([]);
    }
  }, [selectedFileAKey, availableFilesList]);

  useEffect(() => {
    if (selectedFileBKey) {
      const fileSource = availableFilesList.find(f => f.key === selectedFileBKey);
      if (fileSource) {
        setLoadingErrorB(null);
        setFileBData(null); 
        setAnalysisB(null); 
        fetch(fileSource.path)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Failed to load ${fileSource.name} (status: ${response.status}). Check console for more details.`);
            }
            return response.json();
          })
          .then((data: GeoJSONFeatureCollection) => {
             if (typeof data !== 'object' || data === null || data.type !== 'FeatureCollection') {
                throw new Error(`Invalid GeoJSON structure loaded for ${fileSource.name}. Expected FeatureCollection.`);
            }
            setFileBData(data);
            setAnalysisB(analyzeGeoJSON(fileSource.name, data));
          })
          .catch(err => {
            console.error(`Error loading or parsing file B (${fileSource.path}):`, err);
            setFileBData(null);
            setAnalysisB(null);
            setLoadingErrorB(err.message);
          });
      } else if (availableFilesList.length > 0) { 
        setFileBData(null);
        setAnalysisB(null);
        setLoadingErrorB(`File key "${selectedFileBKey}" not found in manifest.`);
      } else { 
        setFileBData(null);
        setAnalysisB(null);
        setLoadingErrorB(null);
      }
    } else {
      setFileBData(null);
      setAnalysisB(null);
      setLoadingErrorB(null);
      setManualTranslations({});
      setAllStructuralTranslationKeys([]);
    }
  }, [selectedFileBKey, availableFilesList]);
  
  useEffect(() => {
    const potentialA = analysisA?.potentialIdKeys || []; 
    const potentialB = analysisB?.potentialIdKeys || []; 
    
    if(analysisA && analysisB) {
        const common = Array.from(new Set([...potentialA, ...potentialB])).filter(k => potentialA.includes(k) && potentialB.includes(k));
        
        if (common.length > 0) {
            if (!mergeConfig.idProperty || !common.includes(mergeConfig.idProperty)) { 
                const preferred = common.find(k => k === 'iso_a3') || 
                                  common.find(k => k === 'admin') ||
                                  common.find(k => k === 'id') || 
                                  common[0];
                if (preferred) setIdPropertyForMerge(preferred); 
            }
        } else if (potentialA.length > 0 && (!mergeConfig.idProperty || !potentialA.includes(mergeConfig.idProperty))) {
            setIdPropertyForMerge(potentialA[0]);
        } else if (potentialB.length > 0 && (!mergeConfig.idProperty || !potentialB.includes(mergeConfig.idProperty))) {
            setIdPropertyForMerge(potentialB[0]);
        }
    } else if (!analysisA && !analysisB) { 
        if(mergeConfig.idProperty !== defaultIdProperty) { 
            setIdPropertyForMerge(defaultIdProperty);
        }
    }
  }, [analysisA, analysisB, setIdPropertyForMerge, defaultIdProperty, mergeConfig.idProperty]);


  const handleFuseFiles = useCallback(() => {
    if (!fileAData || !fileBData) { 
      setError("Both GeoJSON files must be successfully loaded before fusing.");
      return;
    }
    if (!mergeConfig.idProperty || mergeConfig.idProperty === 'none_found' || mergeConfig.idProperty === '') {
      setError("Please select a valid Feature Matching ID Property.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setMergedData(null);

    setTimeout(() => {
      try {
        const result = mergeGeoJSONs(fileAData, fileBData, mergeConfig, analysisA, analysisB, countrySelections, manualTranslations);
        setMergedData(result);
      } catch (e: any) {
        setError(`Fusion failed: ${e.message}`);
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }, 500);
  }, [fileAData, fileBData, mergeConfig, analysisA, analysisB, countrySelections, manualTranslations]);

  const canConfigureMerge = !!(fileAData && fileBData && mergeConfig.idProperty && mergeConfig.idProperty !== 'none_found' && mergeConfig.idProperty !== '' && analysisA && analysisB);
  
  const isAnyPropertySelectedForMerge = useMemo(() => {
    const { translationsSource, otherPropertiesSource } = mergeConfig;

    const recTranslationsMerging = translationsSource.recognized.primary !== 'discard';
    const depTranslationsMerging = translationsSource.dependent.primary !== 'discard';

    const recOtherPropsMerging =
      otherPropertiesSource.recognized.primary !== 'discard' &&
      Object.values(otherPropertiesSource.recognized.selectedProperties).some(isSelected => isSelected);

    const depOtherPropsMerging =
      otherPropertiesSource.dependent.primary !== 'discard' &&
      Object.values(otherPropertiesSource.dependent.selectedProperties).some(isSelected => isSelected);

    return recTranslationsMerging || depTranslationsMerging || recOtherPropsMerging || depOtherPropsMerging;
  }, [mergeConfig]);

  const canFuse = canConfigureMerge && !isLoading && isAnyPropertySelectedForMerge;


  const showComparisonTable = 
    (analysisA?.countryDetails && analysisA.countryDetails.length > 0) || 
    (analysisB?.countryDetails && analysisB.countryDetails.length > 0);
  
  const showMissingTranslationsPanel = canConfigureMerge && allStructuralTranslationKeys.length > 0;

  // Settings Management
  const handleSaveSettings = useCallback(() => {
    setSettingsMessage(null);
    try {
      const settingsToSave: AppSettings = {
        version: SETTINGS_FILE_VERSION,
        mergeConfig,
        countrySelections: Object.fromEntries(countrySelections),
        manualTranslations,
      };
      const settingsString = JSON.stringify(settingsToSave, null, 2);
      const blob = new Blob([settingsString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // YYYY-MM-DDTHH-MM-SS
      a.download = `geojson_fusion_settings_${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSettingsMessage('Settings saved successfully!');
    } catch (e: any) {
      console.error("Error saving settings:", e);
      setSettingsMessage(`Error saving settings: ${e.message}`);
    }
     setTimeout(() => setSettingsMessage(null), 5000);
  }, [mergeConfig, countrySelections, manualTranslations]);

  const handleLoadSettingsFile = useCallback((file: File) => {
    setSettingsMessage(null);
    if (!file) {
      setSettingsMessage('No file selected for loading.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (typeof result !== 'string') {
          throw new Error('Could not read file content.');
        }
        const loadedSettings = JSON.parse(result) as AppSettings;

        // Validation
        if (!loadedSettings || typeof loadedSettings !== 'object') {
          throw new Error('Invalid settings file format: Not an object.');
        }
        if (loadedSettings.version !== SETTINGS_FILE_VERSION) {
          throw new Error(`Unsupported settings version. Expected ${SETTINGS_FILE_VERSION}, found ${loadedSettings.version}.`);
        }
        if (!loadedSettings.mergeConfig || typeof loadedSettings.mergeConfig !== 'object') {
          throw new Error('Invalid settings: Missing or invalid "mergeConfig".');
        }
        if (loadedSettings.countrySelections === undefined || typeof loadedSettings.countrySelections !== 'object') {
          throw new Error('Invalid settings: "countrySelections" must be an object.');
        }
        if (typeof loadedSettings.manualTranslations !== 'object') { // Could be null, but typically an object
          throw new Error('Invalid settings: "manualTranslations" should be an object.');
        }
        // Could add more granular validation for mergeConfig structure here if needed

        // Apply settings
        setMergeConfig(loadedSettings.mergeConfig);
        setCountrySelections(new Map(Object.entries(loadedSettings.countrySelections || {})) as Map<string, CountrySelectionChoice>);
        setManualTranslations(loadedSettings.manualTranslations || {});
        
        // Update idProperty separately because it's part of mergeConfig
        // but also used directly for FileSelectionPanel
        if (loadedSettings.mergeConfig.idProperty) {
          setIdPropertyForMerge(loadedSettings.mergeConfig.idProperty);
        }

        setSettingsMessage('Settings loaded successfully!');
      } catch (e: any) {
        console.error("Error loading settings:", e);
        setSettingsMessage(`Error loading settings: ${e.message}`);
      }
      setTimeout(() => setSettingsMessage(null), 7000);
    };
    reader.onerror = () => {
      setSettingsMessage('Error reading settings file.');
      setTimeout(() => setSettingsMessage(null), 5000);
    };
    reader.readAsText(file);
  }, [setIdPropertyForMerge]); // Added setIdPropertyForMerge

  const settingsPanelDisabled = !canConfigureMerge && Object.keys(mergeConfig.otherPropertiesSource.recognized.selectedProperties).length === 0 && Object.keys(mergeConfig.otherPropertiesSource.dependent.selectedProperties).length === 0;

  return (
    <div className="w-[98%] mx-auto p-4 md:p-8 min-h-screen">
      <header className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-bold text-sky-400">
          Geo<span className="text-emerald-400">JSON</span> Fusion Tool
        </h1>
        <p className="text-slate-400 mt-2 text-lg">Analyze, configure, translate and merge country datasets with precision. Made for <a href="https://www.naturalearthdata.com/" target="nat" className="text-sky-400 hover:underline">Natural Earth</a> data.</p>
      </header>
      
      {manifestError && (
        <div className="my-4 p-4 bg-red-800 border border-red-700 text-red-100 rounded-md shadow-lg" role="alert">
          <h3 className="font-bold text-lg mb-2">Error Loading File List!</h3>
          <p>{manifestError}</p>
          <p className="mt-2 text-sm">Please create or check your <code>/data/manifest.json</code> file. It should contain an array of file objects, e.g., <code>[{ "key": "file1", "name": "Display Name 1", "path": "/data/file1.geojson" }]</code>.</p>
        </div>
      )}

      {(loadingErrorA || loadingErrorB) && (
        <div className="my-4 p-4 bg-red-800 border border-red-700 text-red-100 rounded-md shadow-lg" role="alert">
          <h3 className="font-bold text-lg mb-2">File Loading Error!</h3>
          {loadingErrorA && <p><strong className="font-semibold">Error for File A:</strong> {loadingErrorA}</p>}
          {loadingErrorB && <p><strong className="font-semibold">Error for File B:</strong> {loadingErrorB}</p>}
          <p className="mt-2 text-sm">Please ensure the file path in <code>/data/manifest.json</code> is correct for the selected file, the GeoJSON file exists, is valid JSON, and your development server is serving the <code>/data</code> directory. Also check your browser's developer console for network errors.</p>
        </div>
       )}
      
      <CollapsiblePanel title="1. Select Files & ID Property" defaultOpen>
        <FileSelectionPanel
          availableFiles={availableFilesList}
          selectedFileAKey={selectedFileAKey}
          setSelectedFileAKey={setSelectedFileAKey}
          selectedFileBKey={selectedFileBKey}
          setSelectedFileBKey={setSelectedFileBKey}
          idProperty={mergeConfig.idProperty} 
          setIdProperty={setIdPropertyForMerge}
          potentialIdKeysA={analysisA?.potentialIdKeys || []} 
          potentialIdKeysB={analysisB?.potentialIdKeys || []} 
        />
      </CollapsiblePanel>

      {(selectedFileAKey || selectedFileBKey || analysisA || analysisB) && (
        <CollapsiblePanel title="2. Analyze Selected Files" defaultOpen>
            <div className="grid md:grid-cols-2 gap-6">
                <AnalysisCard analysis={analysisA} title="File A Analysis" />
                <AnalysisCard analysis={analysisB} title="File B Analysis" />
            </div>
        </CollapsiblePanel>
      )}
      
      {showComparisonTable && ( 
        <CollapsiblePanel title="2.5. Review & Select Source">
             <CountryComparisonTable
                countriesDetailsA={analysisA?.countryDetails || []}
                countriesDetailsB={analysisB?.countryDetails || []}
                fileNameA={analysisA?.fileName || "File A"}
                fileNameB={analysisB?.fileName || "File B"}
                countrySelections={countrySelections}
                updateCountrySelection={updateCountrySelection}
                setAllDisplayedEntriesSelection={setAllDisplayedEntriesSelection}
             />
        </CollapsiblePanel>
      )}

      {showMissingTranslationsPanel && (
        <CollapsiblePanel title="2.75. Manual Translation Input">
          <MissingTranslationsPanel
            analysisA={analysisA}
            analysisB={analysisB}
            fileAData={fileAData}
            fileBData={fileBData}
            idProperty={mergeConfig.idProperty}
            manualTranslations={manualTranslations}
            updateManualTranslation={updateManualTranslation}
            allStructuralTranslationKeys={allStructuralTranslationKeys}
            countrySelections={countrySelections}
          />
        </CollapsiblePanel>
      )}
      
      <CollapsiblePanel title="3. Configure Merge Strategy" disabled={!canConfigureMerge}>
        <MergeControlPanel
          mergeConfig={mergeConfig} 
          setMergeConfig={updateMergeConfig}
          fileAName={analysisA?.fileName || "File A"}
          fileBName={analysisB?.fileName || "File B"}
          analysisA={analysisA} 
          analysisB={analysisB}
        />
      </CollapsiblePanel>

      <CollapsiblePanel 
        title="3.5. Manage Settings" 
        disabled={settingsPanelDisabled}
      >
        <SettingsManagementPanel
          onSaveSettings={handleSaveSettings}
          onLoadSettings={handleLoadSettingsFile}
          settingsMessage={settingsMessage}
          disabled={settingsPanelDisabled}
        />
      </CollapsiblePanel>

      <CollapsiblePanel title="4. Fuse & Download" disabled={!canConfigureMerge}>
        <ResultPanel
          mergedData={mergedData}
          isLoading={isLoading}
          error={error}
          onFuse={handleFuseFiles}
          fuseDisabled={!canFuse}
          noPropertiesSelectedForMerge={canConfigureMerge && !isAnyPropertySelectedForMerge}
        />
      </CollapsiblePanel>

      <footer className="text-center mt-12 py-6 border-t border-slate-700 space-y-3">
        <p className="text-sm text-slate-500">
          Réalisé par <a href="https://www.avecnous.eu/" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">Fred Neau - NOUS – Ouvert, Utile et Simple</a>.
        </p>
        <p className="text-sm text-slate-500">GeoJSON Fusion Tool &copy; {new Date().getFullYear()}</p>
        <p className="text-xs text-slate-500">
          Licensed under the <a href="https://www.gnu.org/licenses/agpl-3.0.en.html" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">AGPL-3.0 License</a>.
        </p>
      </footer>
    </div>
  );
};

export default App;
