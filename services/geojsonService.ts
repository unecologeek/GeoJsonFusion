
import { GeoJSONFeatureCollection, FileAnalysisResult, GeoJSONGeometry, MergeConfig, GeoJSONFeature, GeoJSONPoint, GeoJSONMultiPoint, GeoJSONLineString, GeoJSONMultiLineString, GeoJSONPolygon, GeoJSONMultiPolygon, GeoJSONGeometryCollection, CountryDetail, MergeSourceOption, PropertySourcePreference, OtherPropertyDetail, OtherPropertiesPrimaryOption } from '../types';

// Helper function to normalize property keys to lowercase
function normalizeProperties(props: Record<string, any> | undefined | null): Record<string, any> {
  if (!props) return {};
  const newProps: Record<string, any> = {};
  for (const originalKey in props) {
    if (Object.prototype.hasOwnProperty.call(props, originalKey)) {
      newProps[originalKey.toLowerCase()] = props[originalKey];
    }
  }
  return newProps;
}

// Helper function to get a "core" name for comparison, stripping common political terms and normalizing
function getCoreName(name: string | undefined | null): string {
    if (!name) return "";
    return name
        .toLowerCase()
        .replace(/\b(republic|rep\.?|democratic|dem\.?|people's|p\.?d\.?r\.?|kingdom|k\.?o\.?|federation|fed\.?|federal|islamic|state of|states|the|of|and|commonwealth|territory|islands|is\.?|province|admin\.?|administrative|region)\b/g, '')
        .replace(/[.,()'-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Geometry Precision Helpers
function roundCoordinate(num: number, precision: number): number {
  if (precision < 0 || isNaN(num) || !isFinite(num)) return num; // Allow 0 for full precision
  const factor = Math.pow(10, precision);
  return Math.round(num * factor) / factor;
}

function roundCoordinatesArray(coords: any[], precision: number): any[] {
  if (precision < 0) return coords; // Allow 0 for full precision via roundCoordinate
  return coords.map(val => {
    if (Array.isArray(val)) {
      return roundCoordinatesArray(val, precision);
    } else if (typeof val === 'number') {
      return roundCoordinate(val, precision);
    }
    return val;
  });
}

function roundGeometryCoordinates<T extends GeoJSONGeometry | null>(geometry: T, precision: number): T {
  if (!geometry || precision < 0) return geometry; // Allow 0 for full precision

  const newGeometry = JSON.parse(JSON.stringify(geometry)) as NonNullable<T>;

  switch (newGeometry.type) {
    case 'Point':
      newGeometry.coordinates = roundCoordinatesArray(newGeometry.coordinates, precision) as [number,number];
      break;
    case 'MultiPoint':
    case 'LineString':
      newGeometry.coordinates = roundCoordinatesArray(newGeometry.coordinates, precision);
      break;
    case 'MultiLineString':
    case 'Polygon':
      newGeometry.coordinates = roundCoordinatesArray(newGeometry.coordinates, precision);
      break;
    case 'MultiPolygon':
      newGeometry.coordinates = roundCoordinatesArray(newGeometry.coordinates, precision);
      break;
    case 'GeometryCollection':
      newGeometry.geometries = newGeometry.geometries.map((geom: GeoJSONGeometry) => roundGeometryCoordinates(geom, precision));
      break;
  }
  return newGeometry as T;
}


function countCoordinatesRecursive(geometry: GeoJSONGeometry | null): number {
  if (!geometry) return 0;
  switch (geometry.type) {
    case 'Point': return 1;
    case 'MultiPoint': return (geometry as GeoJSONMultiPoint).coordinates.length;
    case 'LineString': return (geometry as GeoJSONLineString).coordinates.length;
    case 'MultiLineString': return (geometry as GeoJSONMultiLineString).coordinates.reduce((sum, ls) => sum + ls.length, 0);
    case 'Polygon': return (geometry as GeoJSONPolygon).coordinates.reduce((sum, ring) => sum + ring.length, 0);
    case 'MultiPolygon':
      return (geometry as GeoJSONMultiPolygon).coordinates.reduce(
        (sum, poly) => sum + poly.reduce((s, ring) => s + ring.length, 0),
        0
      );
    case 'GeometryCollection':
      return (geometry as GeoJSONGeometryCollection).geometries.reduce((sum, geom) => sum + countCoordinatesRecursive(geom), 0);
    default:
      return 0;
  }
}

// --- Helpers for Max Coordinate Precision Analysis ---
function getCoordinatePrecision(num: number): number {
  if (Math.floor(num) === num || !isFinite(num)) return 0; // Integer or non-finite
  const s = num.toString();
  const decimalPart = s.split('.')[1];
  return decimalPart ? decimalPart.length : 0;
}

function _traverseCoordinatesForMaxPrecision(coords: any[], currentMaxRef: { value: number }) {
  coords.forEach(val => {
    if (Array.isArray(val)) {
      _traverseCoordinatesForMaxPrecision(val, currentMaxRef);
    } else if (typeof val === 'number') {
      currentMaxRef.value = Math.max(currentMaxRef.value, getCoordinatePrecision(val));
    }
  });
}

function _findMaxPrecisionInGeometry(geometry: GeoJSONGeometry | null, currentMaxRef: { value: number }) {
    if (!geometry) return;
    switch (geometry.type) {
        case 'Point':
            _traverseCoordinatesForMaxPrecision(geometry.coordinates, currentMaxRef);
            break;
        case 'MultiPoint':
        case 'LineString':
            _traverseCoordinatesForMaxPrecision(geometry.coordinates, currentMaxRef);
            break;
        case 'Polygon':
        case 'MultiLineString':
            (geometry.coordinates as any[][]).forEach(ringOrLine => _traverseCoordinatesForMaxPrecision(ringOrLine, currentMaxRef));
            break;
        case 'MultiPolygon':
            (geometry.coordinates as any[][][]).forEach(polygon =>
                polygon.forEach(ring => _traverseCoordinatesForMaxPrecision(ring, currentMaxRef))
            );
            break;
        case 'GeometryCollection':
            (geometry as GeoJSONGeometryCollection).geometries.forEach(geom => _findMaxPrecisionInGeometry(geom, currentMaxRef));
            break;
    }
}
// --- End of Max Coordinate Precision Helpers ---


export function analyzeGeoJSON(fileName: string, data: GeoJSONFeatureCollection): FileAnalysisResult {
  const numFeatures = data.features.length;
  const languages = new Set<string>();
  const commonProperties = new Set<string>();
  let geometryPrecisionScore = 0;
  const propertyValueSamples: Record<string, Set<string | number>> = {};
  const propertyCounts: Record<string, number> = {};

  const countryDetailsMap = new Map<string, CountryDetail>();

  const preferredNameKeys = ['NAME', 'ADMIN', 'SOVEREIGNT', 'NAME_EN', 'OFFICIAL_NAME', 'COUNTRY_NAME', 'CNTRY_NAME', 'CNTRYNAM', 'NAME_LONG', 'FORMAL_EN'].map(k => k.toLowerCase());
  const preferredSovereigntyKeys = ['SOVEREIGNT', 'SOV_A3', 'ADMIN0_SOV_NAME', 'SOVEREIGN', 'ADMIN0_A3_US', 'ISO_A2_EH', 'ADMIN0_SOVEREIGNTY'].map(k => k.toLowerCase());

  const maxPrecisionRef = { value: 0 }; 

  data.features.forEach(feature => {
    geometryPrecisionScore += countCoordinatesRecursive(feature.geometry);
    _findMaxPrecisionInGeometry(feature.geometry, maxPrecisionRef); 

    const normalizedFeatureProps = normalizeProperties(feature.properties);

    Object.keys(normalizedFeatureProps).forEach(key => { 
      commonProperties.add(key);
      const langMatch = key.match(/^(?:name|admin|official_name|title|label)_(?:([a-z]{2,3}))$/i);
      if (langMatch && langMatch[1]) {
           languages.add(langMatch[1].toUpperCase());
      }

      if (!propertyValueSamples[key]) {
        propertyValueSamples[key] = new Set();
      }
      if (propertyValueSamples[key].size < 5 && normalizedFeatureProps[key] !== null && normalizedFeatureProps[key] !== undefined) {
         propertyValueSamples[key].add(String(normalizedFeatureProps[key]));
      }
      propertyCounts[key] = (propertyCounts[key] || 0) + 1;
    });
  });

  let countryNameProperty: string | null = null;
  let maxCountForNameKey = 0;

  for (const pKey of preferredNameKeys) {
    if (commonProperties.has(pKey)) {
        const firstFeatureNormalizedProps = normalizeProperties(data.features[0]?.properties);
        if (typeof firstFeatureNormalizedProps[pKey] === 'string') {
            if (propertyCounts[pKey] > maxCountForNameKey) {
                countryNameProperty = pKey;
                maxCountForNameKey = propertyCounts[pKey];
            }
        }
    }
  }

  if (!countryNameProperty || maxCountForNameKey < numFeatures * 0.5) {
     for (const key of commonProperties) {
        const firstFeatureNormalizedProps = normalizeProperties(data.features[0]?.properties);
        if (typeof firstFeatureNormalizedProps[key] === 'string' && propertyCounts[key] > maxCountForNameKey && propertyCounts[key] > numFeatures * 0.5) {
            countryNameProperty = key;
            maxCountForNameKey = propertyCounts[key];
        }
     }
  }

  let sovereigntyPropertyKey: string | null = null;
  let maxCountForSovereigntyKey = 0;

  for (const pKey of preferredSovereigntyKeys) {
      if (commonProperties.has(pKey)) {
          const firstFeatureNormalizedProps = normalizeProperties(data.features[0]?.properties);
          if (typeof firstFeatureNormalizedProps[pKey] === 'string') {
              if (propertyCounts[pKey] > maxCountForSovereigntyKey) {
                  sovereigntyPropertyKey = pKey;
                  maxCountForSovereigntyKey = propertyCounts[pKey];
              }
          }
      }
  }
  if (!sovereigntyPropertyKey && countryNameProperty) {
      const sovereigntKeyLowercase = 'sovereignt';
      if (commonProperties.has(sovereigntKeyLowercase) && sovereigntKeyLowercase !== countryNameProperty.toLowerCase()) {
          const firstFeatureNormalizedProps = normalizeProperties(data.features[0]?.properties);
          if (typeof firstFeatureNormalizedProps[sovereigntKeyLowercase] === 'string') {
             sovereigntyPropertyKey = sovereigntKeyLowercase;
          }
      }
  }

  if (countryNameProperty) {
    const finalNamePropLowercase = countryNameProperty;

    data.features.forEach(feature => {
      const normalizedFeatureProps = normalizeProperties(feature.properties);
      const nameValueRaw = normalizedFeatureProps[finalNamePropLowercase];

      if (typeof nameValueRaw === 'string' && nameValueRaw.trim() !== '') {
        const originalTrimmedName = nameValueRaw.trim();
        const nameValForComparison = originalTrimmedName.toLowerCase();

        let isDependency = false;
        let sovereignStateForDetail: string | undefined = undefined;
        let finalNameForMapKey = originalTrimmedName;

        if (sovereigntyPropertyKey) {
          const sovValueRaw = normalizedFeatureProps[sovereigntyPropertyKey];
          if (typeof sovValueRaw === 'string' && sovValueRaw.trim() !== '') {
            const originalTrimmedSovValue = sovValueRaw.trim();
            const sovValForComparison = originalTrimmedSovValue.toLowerCase();

            if (nameValForComparison !== sovValForComparison) {
              const coreName = getCoreName(nameValForComparison);
              const coreSov = getCoreName(sovValForComparison);

              const oneContainsCoreOfOther = (coreName && coreSov) &&
                                           (nameValForComparison.includes(coreSov) || sovValForComparison.includes(coreName));
              const isKoreaCase = (coreName === 'korea' && (coreSov === 'south korea' || coreSov === 'north korea')) ||
                                  (coreSov === 'korea' && (coreName === 'south korea' || coreName === 'north korea'));
               const isCzechCase = (coreName === 'czech' && coreSov === 'czechia') || (coreSov === 'czech' && coreName === 'czechia');


              if (coreName === coreSov || oneContainsCoreOfOther || isKoreaCase || isCzechCase) {
                isDependency = false;
                finalNameForMapKey = originalTrimmedSovValue.length >= originalTrimmedName.length ? originalTrimmedSovValue : originalTrimmedName;
                sovereignStateForDetail = undefined;
              } else {
                isDependency = true;
                sovereignStateForDetail = originalTrimmedSovValue;
                finalNameForMapKey = originalTrimmedName;
              }
            } else {
              isDependency = false;
              finalNameForMapKey = originalTrimmedName;
            }
          }
        }

        const existingDetail = countryDetailsMap.get(finalNameForMapKey);

        if (!existingDetail) {
             countryDetailsMap.set(finalNameForMapKey, { name: finalNameForMapKey, isDependency, sovereignState: sovereignStateForDetail });
        } else {
            if (existingDetail.isDependency && !isDependency) {
                 countryDetailsMap.set(finalNameForMapKey, { name: finalNameForMapKey, isDependency, sovereignState: sovereignStateForDetail });
            } else if (!existingDetail.isDependency && !isDependency) {
                if (finalNameForMapKey.length > existingDetail.name.length) {
                     if (getCoreName(finalNameForMapKey) === getCoreName(existingDetail.name)) {
                        countryDetailsMap.delete(existingDetail.name); 
                     }
                     countryDetailsMap.set(finalNameForMapKey, { name: finalNameForMapKey, isDependency, sovereignState: sovereignStateForDetail });
                }
            }
        }
      }
    });
  }


  const potentialIdKeys = Object.entries(propertyCounts)
    .filter(([key, count]) => count >= numFeatures * 0.8)
    .map(([key]) => key)
    .filter(key => {
        const samples = propertyValueSamples[key];
        return samples && samples.size > Math.min(numFeatures, 5) * 0.6;
    })
    .sort();

  const preferredIdKeysLowercase = ['ISO_A3', 'ADMIN', 'NAME', 'ID', 'GEOID'].map(k => k.toLowerCase());
  potentialIdKeys.sort((a, b) => {
    const aIsPreferred = preferredIdKeysLowercase.includes(a);
    const bIsPreferred = preferredIdKeysLowercase.includes(b);
    if (aIsPreferred && !bIsPreferred) return -1;
    if (!aIsPreferred && bIsPreferred) return 1;
    return a.localeCompare(b);
  });

  return {
    fileName,
    numFeatures,
    languages: Array.from(languages).sort(),
    geometryPrecisionScore,
    maxCoordinatePrecision: maxPrecisionRef.value, 
    commonProperties: Array.from(commonProperties).sort(), 
    potentialIdKeys: potentialIdKeys.length > 0 ? potentialIdKeys : (commonProperties.size > 0 ? Array.from(commonProperties).slice(0,5) : ['none_found']),
    countryNameProperty, 
    sovereigntyPropertyKey, 
    countryDetails: Array.from(countryDetailsMap.values()).sort((a,b) => a.name.localeCompare(b.name)),
  };
}

const createFeatureMap = (features: Array<GeoJSONFeature>, idPropLowercase: string): Map<string | number, GeoJSONFeature> => {
  const validEntries = features
    .map(f => {
      const normalizedProps = normalizeProperties(f.properties);
      const idVal = normalizedProps[idPropLowercase];
      if (typeof idVal === 'string' || typeof idVal === 'number') {
        return [idVal, f] as const;
      }
      return undefined;
    })
    .filter((entry): entry is readonly [string | number, GeoJSONFeature] => entry !== undefined);

  return new Map<string | number, GeoJSONFeature>(validEntries);
};

export function mergeGeoJSONs(
  fileAData: GeoJSONFeatureCollection,
  fileBData: GeoJSONFeatureCollection,
  config: MergeConfig,
  analysisA: FileAnalysisResult | null,
  analysisB: FileAnalysisResult | null,
  countrySelections: Map<string, 'A' | 'B' | 'discard'>,
  manualTranslations: Record<string, Record<string, string>> = {}
): GeoJSONFeatureCollection {
  const idPropertyLowercase = config.idProperty.toLowerCase();

  const featuresA = createFeatureMap(fileAData.features, idPropertyLowercase);
  const featuresB = createFeatureMap(fileBData.features, idPropertyLowercase);

  const allIds = new Set([...featuresA.keys(), ...featuresB.keys()]);
  const outputFeatures: Array<GeoJSONFeature> = [];

  const namePropertyA = analysisA?.countryNameProperty; 
  const namePropertyB = analysisB?.countryNameProperty; 

  const countryDetailsMapA = new Map(analysisA?.countryDetails.map(cd => [cd.name, cd]));
  const countryDetailsMapB = new Map(analysisB?.countryDetails.map(cd => [cd.name, cd]));

  const nameTranslationPattern = /^(name|admin|official_name|country_name|sovereignt|cntry_name|cntrynam|name_long|formal_en)(_[a-z]{2,3})?$/i;
  const namePropertyAutofillPattern = /^(name|official_name|country_name|name_long|formal_en)(_[a-z]{2,3})?$/i;


  const allStructuralTranslationKeys = new Set<string>();
  if (analysisA?.commonProperties) {
    analysisA.commonProperties.forEach(key => { 
        if (nameTranslationPattern.test(key)) {
            allStructuralTranslationKeys.add(key);
        }
    });
  }
  if (analysisB?.commonProperties) {
    analysisB.commonProperties.forEach(key => { 
        if (nameTranslationPattern.test(key)) {
            allStructuralTranslationKeys.add(key);
        }
    });
  }
  if (namePropertyA) allStructuralTranslationKeys.add(namePropertyA);
  if (namePropertyB) allStructuralTranslationKeys.add(namePropertyB);


  for (const id of allIds) {
    let featureA = featuresA.get(id);
    let featureB = featuresB.get(id);

    const normalizedPropsA = normalizeProperties(featureA?.properties);
    const normalizedPropsB = normalizeProperties(featureB?.properties);
    
    // --- START: New logic for Country Selection Override ---
    const nameInA = namePropertyA ? String(normalizedPropsA[namePropertyA] || '').trim() : undefined;
    const nameInB = namePropertyB ? String(normalizedPropsB[namePropertyB] || '').trim() : undefined;

    const detailA = nameInA ? countryDetailsMapA.get(nameInA) : undefined;
    const detailB = nameInB ? countryDetailsMapB.get(nameInB) : undefined;

    // Use a representative detail to find the name key for the selection map.
    // The name in the comparison table is the key we must use.
    const representativeDetail = detailA || detailB;

    if (representativeDetail) {
      const selection = countrySelections.get(representativeDetail.name);
      if (selection === 'discard') {
        continue; // Skip this feature entirely
      }
      if (selection === 'A') {
        featureB = undefined; // Force use of File A feature
      } else if (selection === 'B') {
        featureA = undefined; // Force use of File B feature
      }
    }
    // --- END: New logic for Country Selection Override ---
    
    if (!featureA && !featureB) continue; // Both might be undefined now

    // Recalculate normalized props in case a feature was undefined
    const finalNormalizedPropsA = normalizeProperties(featureA?.properties);
    const finalNormalizedPropsB = normalizeProperties(featureB?.properties);

    let isEffectivelyDependent = false;
    let arbiterDetail: CountryDetail | undefined; // This is now for property rules, not for discard.

    // Determine arbiterDetail for property merge rules based on the *remaining* features
    const finalNameInA = namePropertyA ? String(finalNormalizedPropsA[namePropertyA] || '').trim() : undefined;
    const finalNameInB = namePropertyB ? String(finalNormalizedPropsB[namePropertyB] || '').trim() : undefined;

    const otherPropsDecisionConfigForDep = config.otherPropertiesSource.dependent;
    const otherPropsDecisionFileForDep = otherPropsDecisionConfigForDep.primary;

    if (otherPropsDecisionFileForDep === 'fileA' && finalNameInA && countryDetailsMapA.has(finalNameInA)) {
        arbiterDetail = countryDetailsMapA.get(finalNameInA);
    } else if (otherPropsDecisionFileForDep === 'fileB' && finalNameInB && countryDetailsMapB.has(finalNameInB)) {
        arbiterDetail = countryDetailsMapB.get(finalNameInB);
    } else {
        const detailA = finalNameInA ? countryDetailsMapA.get(finalNameInA) : undefined;
        const detailB = finalNameInB ? countryDetailsMapB.get(finalNameInB) : undefined;
        if (detailA?.isDependency) arbiterDetail = detailA;
        else if (detailB?.isDependency) arbiterDetail = detailB;
        else arbiterDetail = detailA || detailB;
    }

    isEffectivelyDependent = !!(arbiterDetail && arbiterDetail.isDependency);

    const translationsConfig = isEffectivelyDependent ? config.translationsSource.dependent : config.translationsSource.recognized;
    const otherPropsConfig = isEffectivelyDependent ? config.otherPropertiesSource.dependent : config.otherPropertiesSource.recognized;

    let chosenGeometry: GeoJSONGeometry | null = null;
    if (featureA?.geometry) {
        chosenGeometry = featureA.geometry;
    } else if (featureB?.geometry) {
        chosenGeometry = featureB.geometry;
    }


    if (!chosenGeometry) continue;

    let finalGeometryToPush = chosenGeometry;
    if (config.geometryPrecision >= 0 && finalGeometryToPush) { // Allow 0 for full precision
        finalGeometryToPush = roundGeometryCoordinates(finalGeometryToPush, config.geometryPrecision);
    }


    let newProperties: Record<string, any> = {};

    if (otherPropsConfig.primary === 'discard') {
        newProperties = {}; // Start with empty if discarding all other props
    } else {
        const primaryOtherProviderNormalizedProps = (otherPropsConfig.primary === 'fileA' ? finalNormalizedPropsA : finalNormalizedPropsB);
        const secondaryOtherProviderNormalizedProps = (otherPropsConfig.primary === 'fileA' ? finalNormalizedPropsB : finalNormalizedPropsA);

        let initialOtherPropertiesFromStrategy: Record<string, any> = {};
        if (otherPropsConfig.additive) {
            Object.assign(initialOtherPropertiesFromStrategy, secondaryOtherProviderNormalizedProps); // Secondary first
            Object.assign(initialOtherPropertiesFromStrategy, primaryOtherProviderNormalizedProps);  // Primary overwrites
        } else {
            Object.assign(initialOtherPropertiesFromStrategy, primaryOtherProviderNormalizedProps);
        }

        // Filter by selectedProperties map
        const tempFilteredOtherProps: Record<string, any> = {};
        for (const propKeyLowercase in initialOtherPropertiesFromStrategy) {
            // Include if explicitly true OR if not in map (default to include if map is for exclusion)
            // The current UI logic for selectedProperties is inclusive, so it should be `=== true`
            if (otherPropsConfig.selectedProperties[propKeyLowercase] === true ) { // Ensure it's explicitly selected
                tempFilteredOtherProps[propKeyLowercase] = initialOtherPropertiesFromStrategy[propKeyLowercase];
            }
        }
        newProperties = tempFilteredOtherProps;
    }

    const translationSpecificKeysForFeature = new Set<string>([idPropertyLowercase]);
    if (analysisA?.countryNameProperty) translationSpecificKeysForFeature.add(analysisA.countryNameProperty);
    if (analysisB?.countryNameProperty) translationSpecificKeysForFeature.add(analysisB.countryNameProperty);
    if (analysisA?.sovereigntyPropertyKey) translationSpecificKeysForFeature.add(analysisA.sovereigntyPropertyKey);
    if (analysisB?.sovereigntyPropertyKey) translationSpecificKeysForFeature.add(analysisB.sovereigntyPropertyKey);
    
    allStructuralTranslationKeys.forEach(key => translationSpecificKeysForFeature.add(key));


    let definitiveNameValue: string | undefined = undefined;
    const namePropKeyInA = namePropertyA; 
    const namePropKeyInB = namePropertyB; 

    const primaryTransProviderForFeatureDefinitiveName = (translationsConfig.primary === 'fileA' ? finalNormalizedPropsA : finalNormalizedPropsB);
    const secondaryTransProviderForFeatureDefinitiveName = (translationsConfig.primary === 'fileA' ? finalNormalizedPropsB : finalNormalizedPropsA);

    if (featureA && !featureB && namePropKeyInA && finalNormalizedPropsA[namePropKeyInA]) {
        definitiveNameValue = String(finalNormalizedPropsA[namePropKeyInA]);
    } else if (featureB && !featureA && namePropKeyInB && finalNormalizedPropsB[namePropKeyInB]) {
        definitiveNameValue = String(finalNormalizedPropsB[namePropKeyInB]);
    } else if (translationsConfig.primary === 'fileA' && namePropKeyInA && primaryTransProviderForFeatureDefinitiveName[namePropKeyInA]) {
        definitiveNameValue = String(primaryTransProviderForFeatureDefinitiveName[namePropKeyInA]);
    } else if (translationsConfig.primary === 'fileB' && namePropKeyInB && primaryTransProviderForFeatureDefinitiveName[namePropKeyInB]) {
        definitiveNameValue = String(primaryTransProviderForFeatureDefinitiveName[namePropKeyInB]);
    } else if (namePropKeyInA && finalNormalizedPropsA[namePropKeyInA]) { 
        definitiveNameValue = String(finalNormalizedPropsA[namePropKeyInA]);
    } else if (namePropKeyInB && finalNormalizedPropsB[namePropKeyInB]) {
        definitiveNameValue = String(finalNormalizedPropsB[namePropKeyInB]);
    } else if (primaryTransProviderForFeatureDefinitiveName[namePropKeyInA || 'name']) { 
        definitiveNameValue = String(primaryTransProviderForFeatureDefinitiveName[namePropKeyInA || 'name']);
    } else if (secondaryTransProviderForFeatureDefinitiveName[namePropKeyInB || 'name']) {
        definitiveNameValue = String(secondaryTransProviderForFeatureDefinitiveName[namePropKeyInB || 'name']);
    } else if (primaryTransProviderForFeatureDefinitiveName[idPropertyLowercase]) { // Fallback to ID if no name found
        definitiveNameValue = String(primaryTransProviderForFeatureDefinitiveName[idPropertyLowercase]);
    }


    if (translationsConfig.primary === 'discard') { // Differs from otherProps 'discard', this one targets translation keys
        for (const keyLowercase of translationSpecificKeysForFeature) {
            if (keyLowercase !== idPropertyLowercase) { 
                delete newProperties[keyLowercase];
            }
        }
    } else {
        let tempTranslationProps: Record<string, any> = {};
        const primaryTransProviderNormalizedProps = (translationsConfig.primary === 'fileA' ? finalNormalizedPropsA : finalNormalizedPropsB);
        const secondaryTransProviderNormalizedProps = (translationsConfig.primary === 'fileA' ? finalNormalizedPropsB : finalNormalizedPropsA);

        if (translationsConfig.additive) {
            Object.keys(secondaryTransProviderNormalizedProps).forEach(key => {
                if(translationSpecificKeysForFeature.has(key)) {
                    tempTranslationProps[key] = secondaryTransProviderNormalizedProps[key];
                }
            });
            Object.keys(primaryTransProviderNormalizedProps).forEach(key => {
                 if(translationSpecificKeysForFeature.has(key)) {
                    tempTranslationProps[key] = primaryTransProviderNormalizedProps[key]; // Primary overwrites
                }
            });
        } else {
             Object.keys(primaryTransProviderNormalizedProps).forEach(key => {
                 if(translationSpecificKeysForFeature.has(key)) {
                    tempTranslationProps[key] = primaryTransProviderNormalizedProps[key];
                }
            });
        }
        
        for (const keyLowercase of translationSpecificKeysForFeature) {
            if (keyLowercase === idPropertyLowercase) {
                continue; 
            }
            const valueFromTranslations = tempTranslationProps[keyLowercase];

            if (valueFromTranslations !== undefined && valueFromTranslations !== null) {
                newProperties[keyLowercase] = valueFromTranslations;
            } else if (translationsConfig.additive && definitiveNameValue && namePropertyAutofillPattern.test(keyLowercase)) {
                newProperties[keyLowercase] = definitiveNameValue;
            } else if (!translationsConfig.additive) {
                 if (!primaryTransProviderNormalizedProps.hasOwnProperty(keyLowercase) || primaryTransProviderNormalizedProps[keyLowercase] === undefined || primaryTransProviderNormalizedProps[keyLowercase] === null) {
                    delete newProperties[keyLowercase];
                }
            }
        }
    }

    let fallbackNameForMissingTranslations: string | undefined = undefined;
    const englishNameKeys = ['name_en', 'name_eng']; 
    for (const enKey of englishNameKeys) {
        if (newProperties[enKey] && typeof newProperties[enKey] === 'string') {
            fallbackNameForMissingTranslations = newProperties[enKey];
            break;
        }
    }
    if (!fallbackNameForMissingTranslations) { 
        fallbackNameForMissingTranslations = definitiveNameValue;
    }

    if (fallbackNameForMissingTranslations) {
        for (const structuralKey of allStructuralTranslationKeys) {
            if (newProperties[structuralKey] === undefined || newProperties[structuralKey] === null) {
                const wasDiscardedForDependent = isEffectivelyDependent && 
                                                 translationsConfig.primary === 'discard' && 
                                                 translationSpecificKeysForFeature.has(structuralKey) &&
                                                 structuralKey !== idPropertyLowercase; 
                if (!wasDiscardedForDependent) {
                    newProperties[structuralKey] = fallbackNameForMissingTranslations;
                }
            }
        }
    }

    // Set the ID property itself - needs to be robust
    let idValueToSet: string | number | undefined | null = undefined;
    // Prefer ID from feature that provided 'otherProperties' if not discarded, else try A then B then loop ID
    if (otherPropsConfig.primary !== 'discard') {
        const idSourcePrimaryProps = otherPropsConfig.primary === 'fileA' ? finalNormalizedPropsA : finalNormalizedPropsB;
        if (idSourcePrimaryProps[idPropertyLowercase] !== undefined && idSourcePrimaryProps[idPropertyLowercase] !== null) {
            idValueToSet = idSourcePrimaryProps[idPropertyLowercase];
        }
    }
    if (idValueToSet === undefined || idValueToSet === null) { // If not found from otherProps source
        if (finalNormalizedPropsA[idPropertyLowercase] !== undefined && finalNormalizedPropsA[idPropertyLowercase] !== null) {
            idValueToSet = finalNormalizedPropsA[idPropertyLowercase];
        } else if (finalNormalizedPropsB[idPropertyLowercase] !== undefined && finalNormalizedPropsB[idPropertyLowercase] !== null) {
            idValueToSet = finalNormalizedPropsB[idPropertyLowercase];
        } else {
            idValueToSet = id; // Fallback to the original loop ID (from the Set of all IDs)
        }
    }

    if (idValueToSet !== undefined && idValueToSet !== null) {
        newProperties[idPropertyLowercase] = idValueToSet;
    } else {
        console.warn("Could not determine a final ID for a feature. Loop ID:", id, "PropsA:", finalNormalizedPropsA, "PropsB:", finalNormalizedPropsB);
        // If still no ID, use the loop ID as a last resort, assuming it's valid
        newProperties[idPropertyLowercase] = id;
    }
    
    // Apply Manual Translations (these take highest precedence for the keys they specify)
    const featureIdForManualLookup = String(newProperties[idPropertyLowercase] || id); // Use the final ID
    if (manualTranslations[featureIdForManualLookup]) {
      for (const langKeyLowercase in manualTranslations[featureIdForManualLookup]) { // manualTranslations stores keys as lowercase
        if (Object.prototype.hasOwnProperty.call(manualTranslations[featureIdForManualLookup], langKeyLowercase)) {
          newProperties[langKeyLowercase] = manualTranslations[featureIdForManualLookup][langKeyLowercase];
        }
      }
    }


    outputFeatures.push({
      type: "Feature",
      geometry: finalGeometryToPush,
      properties: newProperties, // newProperties should have lowercase keys by this point
    });
  }

  return {
    type: "FeatureCollection",
    name: `Fused GeoJSON - ${fileAData.name || 'DatasetA'} & ${fileBData.name || 'DatasetB'}`,
    features: outputFeatures,
  };
}

export function downloadGeoJSON(geojsonObject: GeoJSONFeatureCollection, filenamePrefix: string = "merged") {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${filenamePrefix}_${timestamp}.geojson`;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojsonObject, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", filename);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}
