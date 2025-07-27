
import React, { useRef, useState, useMemo } from 'react'; // Added useState and useMemo
import { MergeConfig, SetMergeConfigFn, MergeSourceOption, PropertySourcePreference, MergeConfigStructuredCharacteristicKey, MergeConfigEntitySubKey, MergeConfigPropertySubKey, OtherPropertyDetail, OtherPropertiesPrimaryOption, FileAnalysisResult } from '../types'; 
import ScrollJumpButtons from './ScrollJumpButtons'; // Import the new component

interface MergeControlPanelProps {
  mergeConfig: MergeConfig;
  setMergeConfig: SetMergeConfigFn;
  fileAName?: string;
  fileBName?: string;
  analysisA: FileAnalysisResult | null; 
  analysisB: FileAnalysisResult | null;
}

const RadioButtonOption: React.FC<{
  idPrefix: string;
  value: string; 
  currentValue: string; 
  onChange: (value: string) => void;
  label: string;
  fileName?: string;
  disabled?: boolean;
}> = ({ idPrefix, value, currentValue, onChange, label, fileName, disabled }) => (
  <label htmlFor={`${idPrefix}-${value}`} className={`flex items-center space-x-2 p-3 rounded-md border transition-all duration-150 ${currentValue === value ? 'bg-sky-600 border-sky-500' : 'bg-slate-700 border-slate-600 hover:border-slate-500'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
    <input
      type="radio"
      id={`${idPrefix}-${value}`}
      name={idPrefix}
      value={value}
      checked={currentValue === value}
      onChange={() => !disabled && onChange(value)}
      className="form-radio h-4 w-4 text-sky-500 bg-slate-600 border-slate-500 focus:ring-sky-500"
      disabled={disabled}
    />
    <span className="text-sm text-slate-100">{label} {fileName ? `(${fileName})` : ''}</span>
  </label>
);

const CheckboxOption: React.FC<{
    id: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    disabled?: boolean;
    className?: string; 
}> = ({ id, checked, onChange, label, disabled, className }) => (
    <label htmlFor={id} className={`flex items-center space-x-2 p-3 rounded-md border transition-all duration-150 ${checked ? 'bg-sky-700/50 border-sky-600' : 'bg-slate-700/50 border-slate-600/50 hover:border-slate-500'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
        <input
            type="checkbox"
            id={id}
            checked={checked}
            onChange={(e) => !disabled && onChange(e.target.checked)}
            className="form-checkbox h-4 w-4 text-sky-500 bg-slate-600 border-slate-500 rounded focus:ring-sky-500"
            disabled={disabled}
        />
        <span className="text-sm text-slate-100">{label}</span>
    </label>
);


const MergeControlPanel: React.FC<MergeControlPanelProps> = ({ 
    mergeConfig, 
    setMergeConfig, 
    fileAName = "File A", 
    fileBName = "File B", 
    analysisA,
    analysisB,
}) => {
  
  const CharacteristicControl: React.FC<{
    title: string;
    configKey: MergeConfigStructuredCharacteristicKey; 
    description: string;
  }> = ({ title, configKey, description }) => {
    
    // Each CharacteristicControl instance will manage its own filter state.
    const [otherPropsFilter, setOtherPropsFilter] = useState('');
    const otherPropsSectionRef = useRef<HTMLDivElement>(null);

    const renderControlsForEntityType = (entityType: MergeConfigEntitySubKey, entityTypeLabel: string, highlightColor: string = 'sky') => {
        let primarySourceValue: MergeSourceOption | OtherPropertiesPrimaryOption | 'discard' | undefined;
        let additiveFlagValue: boolean;
        let selectedPropertiesMap: Record<string, boolean> = {}; 
        let isOtherPropertiesConfig = false;
        let isTranslationsConfig = false;
        
        const currentCharacteristicBaseConfig = mergeConfig[configKey];

        if (configKey === 'otherPropertiesSource') {
            const currentCharacteristicConfig = (currentCharacteristicBaseConfig as { recognized: OtherPropertyDetail; dependent: OtherPropertyDetail })[entityType];
            primarySourceValue = currentCharacteristicConfig.primary;
            additiveFlagValue = currentCharacteristicConfig.additive;
            selectedPropertiesMap = currentCharacteristicConfig.selectedProperties; 
            isOtherPropertiesConfig = true;
        } else if (configKey === 'translationsSource') { 
             const currentCharacteristicConfigTyped = (currentCharacteristicBaseConfig as { recognized: PropertySourcePreference; dependent: PropertySourcePreference });
             if (currentCharacteristicConfigTyped && currentCharacteristicConfigTyped[entityType]) {
                primarySourceValue = currentCharacteristicConfigTyped[entityType].primary;
                additiveFlagValue = currentCharacteristicConfigTyped[entityType].additive;
             } else { 
                primarySourceValue = 'fileA'; 
                additiveFlagValue = false;
             }
             isTranslationsConfig = true;
        } else { 
            primarySourceValue = 'fileA';
            additiveFlagValue = false;
        }
        
        const additiveLabel = "Additive Merge (include unique properties from other file)";
        const isCurrentlyDiscardSelected = primarySourceValue === 'discard';

        const displayableOtherProperties = useMemo(() => {
            if (!isOtherPropertiesConfig || isCurrentlyDiscardSelected || (!analysisA && !analysisB)) {
                return [];
            }
            const nameTranslationPattern = /^(name|admin|official_name|country_name|sovereignt|cntry_name|cntrynam|name_long|formal_en)(_[a-z]{2,3})?$/i;
            
            const coreKeys = new Set<string>([
                mergeConfig.idProperty?.toLowerCase(), 
                analysisA?.countryNameProperty?.toLowerCase(), 
                analysisA?.sovereigntyPropertyKey?.toLowerCase(), 
                analysisB?.countryNameProperty?.toLowerCase(), 
                analysisB?.sovereigntyPropertyKey?.toLowerCase(), 
            ].filter(Boolean) as string[]);

            const allPropsA = new Set(analysisA?.commonProperties || []); 
            const allPropsB = new Set(analysisB?.commonProperties || []); 
            const uniqueCombinedProps = Array.from(new Set([...allPropsA, ...allPropsB])); 

            return uniqueCombinedProps.filter(key => 
                !coreKeys.has(key) && !nameTranslationPattern.test(key)
            ).sort();
        }, [isOtherPropertiesConfig, isCurrentlyDiscardSelected, analysisA, analysisB, mergeConfig.idProperty]);

        const filteredDisplayableOtherProperties = useMemo(() => {
            if (!otherPropsFilter) return displayableOtherProperties;
            const lowerFilter = otherPropsFilter.toLowerCase();
            return displayableOtherProperties.filter(key => key.toLowerCase().includes(lowerFilter));
        }, [displayableOtherProperties, otherPropsFilter]);
        
        const areAllDisplayedSelected = isOtherPropertiesConfig && filteredDisplayableOtherProperties.length > 0 && filteredDisplayableOtherProperties.every(key => !!selectedPropertiesMap[key]);

        const handleSelectAllToggle = () => {
            if (isCurrentlyDiscardSelected || !isOtherPropertiesConfig) return;
            const targetState = !areAllDisplayedSelected;
            const newSelectedMap = { ...selectedPropertiesMap }; 
            filteredDisplayableOtherProperties.forEach(key => { 
                newSelectedMap[key] = targetState;
            });
            setMergeConfig(configKey as 'otherPropertiesSource', newSelectedMap, entityType, 'setSelectedPropertiesMap');
        };

        const isTranslationsForDependent = isTranslationsConfig && entityType === 'dependent';

        return (
            <div className="mt-3"> 
                <h5 className={`text-sm font-semibold text-${highlightColor}-300 mb-2`}>{entityTypeLabel}:</h5>
                
                {(isTranslationsConfig || isOtherPropertiesConfig) && ( 
                    <div className={`grid grid-cols-1 ${ (isOtherPropertiesConfig || isTranslationsForDependent) ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
                        <RadioButtonOption
                            idPrefix={`${configKey}-${entityType}-primary`}
                            value="fileA"
                            currentValue={(primarySourceValue as string) || 'fileA'}
                            onChange={(val) => setMergeConfig(configKey, val as MergeSourceOption, entityType, 'primary')}
                            label="Use data from"
                            fileName={fileAName}
                        />
                        <RadioButtonOption
                            idPrefix={`${configKey}-${entityType}-primary`}
                            value="fileB"
                            currentValue={(primarySourceValue as string) || 'fileA'}
                            onChange={(val) => setMergeConfig(configKey, val as MergeSourceOption, entityType, 'primary')}
                            label="Use data from"
                            fileName={fileBName}
                        />
                        {isOtherPropertiesConfig && (
                             <RadioButtonOption
                                idPrefix={`${configKey}-${entityType}-primary`}
                                value="discard"
                                currentValue={primarySourceValue as string} 
                                onChange={(val) => setMergeConfig(configKey, val, entityType, 'primary')}
                                label="Discard All Other Properties"
                            />
                        )}
                        {isTranslationsForDependent && (
                             <RadioButtonOption
                                idPrefix={`${configKey}-${entityType}-primary`}
                                value="discard"
                                currentValue={primarySourceValue as string} 
                                onChange={(val) => setMergeConfig(configKey, val, entityType, 'primary')}
                                label="Discard Translations & Core IDs"
                            />
                        )}
                    </div>
                )}
                
                <div className="mt-3">
                    <CheckboxOption
                        id={`${configKey}-${entityType}-additive`}
                        checked={additiveFlagValue}
                        onChange={(val) => setMergeConfig(configKey, val, entityType, 'additive')}
                        label={additiveLabel}
                        disabled={isCurrentlyDiscardSelected || (isTranslationsForDependent && primarySourceValue === 'discard') }
                    />
                </div>

                {isOtherPropertiesConfig && !isCurrentlyDiscardSelected && displayableOtherProperties.length > 0 && (
                    <div ref={otherPropsSectionRef} className="mt-4 relative"> 
                        <ScrollJumpButtons 
                            targetElementRef={otherPropsSectionRef} 
                            thresholdHeightPx={300}
                            containerClass="absolute top-1 right-1 z-10 flex flex-col space-y-1"
                            buttonClass="p-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded-md shadow-md"
                        />
                        <h6 className="text-xs font-semibold text-slate-400 mb-2">Select Individual 'Other' Properties to Include:</h6>
                        
                        <div className="my-3">
                            <label htmlFor={`${configKey}-${entityType}-prop-filter`} className="sr-only">Filter properties</label>
                            <input
                                id={`${configKey}-${entityType}-prop-filter`}
                                type="text"
                                value={otherPropsFilter}
                                onChange={(e) => setOtherPropsFilter(e.target.value)}
                                placeholder="Filter properties..."
                                className="w-full p-2 bg-slate-900 border border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-slate-100 placeholder:text-slate-400 text-xs"
                            />
                        </div>

                        {filteredDisplayableOtherProperties.length > 0 && (
                            <div className="my-3 py-2 border-t border-b border-slate-600">
                                <CheckboxOption
                                    id={`${configKey}-${entityType}-selectAllOtherProps`}
                                    checked={areAllDisplayedSelected}
                                    onChange={handleSelectAllToggle}
                                    label={`Select/Deselect All ${filteredDisplayableOtherProperties.length} Displayed Properties`}
                                    disabled={isCurrentlyDiscardSelected}
                                    className="bg-slate-700 hover:border-slate-500" 
                                />
                            </div>
                        )}

                        <div className="bg-slate-700/50 p-3 rounded-md border border-slate-600 text-xs"> 
                            <table className="min-w-full divide-y divide-slate-600">
                                <thead className="bg-slate-700 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium text-slate-300">Property</th>
                                        <th className="px-3 py-2 text-center font-medium text-slate-300 w-16">In A?</th>
                                        <th className="px-3 py-2 text-center font-medium text-slate-300 w-16">In B?</th>
                                        <th className="px-3 py-2 text-center font-medium text-slate-300 w-20">Include</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-600">
                                    {filteredDisplayableOtherProperties.length > 0 ? (
                                        filteredDisplayableOtherProperties.map(propKeyLowercase => ( 
                                            <tr key={propKeyLowercase} className="hover:bg-slate-600/50">
                                                <td className="px-3 py-2 whitespace-nowrap text-slate-200 font-mono text-[11px] truncate" title={propKeyLowercase}>{propKeyLowercase}</td>
                                                <td className="px-3 py-2 text-center text-slate-300">
                                                    {analysisA?.commonProperties.includes(propKeyLowercase) ? <span className="text-sky-400">X</span> : '-'}
                                                </td>
                                                <td className="px-3 py-2 text-center text-slate-300">
                                                    {analysisB?.commonProperties.includes(propKeyLowercase) ? <span className="text-sky-400">X</span> : '-'}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <input 
                                                        type="checkbox"
                                                        className="form-checkbox h-4 w-4 text-sky-500 bg-slate-600 border-slate-500 rounded focus:ring-sky-500"
                                                        checked={!!selectedPropertiesMap[propKeyLowercase]}
                                                        onChange={(e) => setMergeConfig(
                                                            configKey as 'otherPropertiesSource', 
                                                            { name: propKeyLowercase, selected: e.target.checked }, 
                                                            entityType,
                                                            'toggleSelectedProperty'
                                                        )}
                                                    />
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="px-3 py-4 text-center text-slate-400">
                                                {otherPropsFilter ? `No properties match "${otherPropsFilter}".` : 'No "Other" properties available.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    };
    
    return (
      <> 
        <h3 className="text-xl font-medium text-slate-200 mb-1">{title}</h3>
        <p className="text-xs text-slate-400 mb-4">{description}</p>
        <div className="space-y-4"> 
          {renderControlsForEntityType('recognized', 'For Recognized Sovereign States', 'sky')}
          {renderControlsForEntityType('dependent', 'For Dependent Territories', 'amber')}
        </div>
      </>
    );
  };
    
  return (
    <>
      <div className="space-y-6">
        <CharacteristicControl
          title="Name Translations & Core Identifiers"
          configKey="translationsSource" 
          description="Choose primary source for country names, translations (e.g., NAME_EN), and core identifying properties (like 'admin'). Optionally, include unique translations from the other file. For Dependent Territories, translations & core IDs (except the main feature ID) can be discarded."
        />
        <CharacteristicControl
          title="Other Properties"
          configKey="otherPropertiesSource" 
          description="Choose primary source for remaining properties (e.g., population, continent). Optionally, include unique properties from the other file or discard them entirely. This also influences the primary source for determining if an entity is 'dependent' for rule application. Individual properties can be selected below if not discarding."
        />
      </div>
      <div className="mt-8 pt-6 border-t border-slate-700">
        <h4 className="text-lg font-medium text-slate-200 mb-3">Output Optimization</h4>
        <div>
          <label htmlFor="geometryPrecision" className="block text-sm font-medium text-slate-300 mb-1">
            Coordinate Precision (decimal places, 0 for full)
          </label>
          <div className="flex items-baseline space-x-2 mb-1">
            <input
              type="number"
              id="geometryPrecision"
              min="0"
              max="10" 
              value={mergeConfig.geometryPrecision === undefined ? '' : mergeConfig.geometryPrecision}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setMergeConfig('geometryPrecision', 0); 
                } else {
                  const numVal = parseInt(val, 10);
                  if (!isNaN(numVal)) {
                    setMergeConfig('geometryPrecision', numVal);
                  }
                }
              }}
              className="w-24 p-2 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-slate-100 disabled:opacity-50"
              aria-describedby="geometryPrecisionHelp"
            />
            {(analysisA?.maxCoordinatePrecision !== undefined || analysisB?.maxCoordinatePrecision !== undefined) && (
                <span className="text-xs text-slate-400 whitespace-nowrap">
                    (Detected max:
                    {analysisA?.maxCoordinatePrecision !== undefined && ` A: ${analysisA.maxCoordinatePrecision}`}
                    {analysisB?.maxCoordinatePrecision !== undefined && `${analysisA ? ',' : ''} B: ${analysisB.maxCoordinatePrecision}`})
                </span>
            )}
          </div>
          <p id="geometryPrecisionHelp" className="mt-1 text-xs text-slate-400">
            E.g., 6 for web maps. Choose based on detected precision or desired output size.
          </p>
        </div>
      </div>
    </>
  );
};

export default MergeControlPanel;
