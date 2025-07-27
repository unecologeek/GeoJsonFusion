
import React from 'react';
import { GeoJSONFeatureCollection } from '../types';
import { downloadGeoJSON } from '../services/geojsonService';

interface ResultPanelProps {
  mergedData: GeoJSONFeatureCollection | null;
  isLoading: boolean;
  error: string | null;
  onFuse: () => void;
  fuseDisabled: boolean;
  noPropertiesSelectedForMerge: boolean; // New prop
}

const ResultPanel: React.FC<ResultPanelProps> = ({ 
  mergedData, 
  isLoading, 
  error, 
  onFuse, 
  fuseDisabled,
  noPropertiesSelectedForMerge 
}) => {
  let disabledMessage = "Please select two files and configure merge strategy to enable fusion.";
  if (fuseDisabled && noPropertiesSelectedForMerge && !isLoading) {
    disabledMessage = "Fusion disabled: No properties are selected for merging. Please adjust the 'Translations' or 'Other Properties' merge strategies to include some properties."
  } else if (fuseDisabled && !isLoading && !mergedData) { // General case if not due to no properties selected
    disabledMessage = "Please select two files, configure the merge strategy, and ensure some properties are set to merge.";
  }


  return (
    <>
      <button
        onClick={onFuse}
        disabled={isLoading || fuseDisabled}
        className="w-full mb-6 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-md shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75"
        aria-label={fuseDisabled ? disabledMessage : "Fuse GeoJSON Files"}
        title={fuseDisabled ? disabledMessage : undefined}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Fusing...
          </div>
        ) : 'Fuse GeoJSON Files'}
      </button>

      {error && (
        <div className="bg-red-700 border border-red-900 text-red-100 px-4 py-3 rounded-md mb-4" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline ml-2">{error}</span>
        </div>
      )}

      {mergedData && (
        <div>
          <h3 className="text-lg font-semibold text-slate-200 mb-2">Fusion Successful!</h3>
          <p className="text-sm text-slate-300 mb-1">Total features in merged file: {mergedData.features.length}</p>
          <p className="text-sm text-slate-300 mb-4">Merged file name: <span className="font-mono text-xs">{mergedData.name}</span></p>
          <button
            onClick={() => downloadGeoJSON(mergedData, "fused_countries")}
            className="w-full px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-md shadow-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-opacity-75"
          >
            Download Merged GeoJSON
          </button>
          <div className="mt-4">
            <label htmlFor="mergedJsonOutput" className="block text-sm font-medium text-slate-300 mb-1">Preview (first 1000 chars):</label>
            <textarea
              id="mergedJsonOutput"
              readOnly
              value={JSON.stringify(mergedData, null, 2).substring(0, 1000) + '...'}
              className="w-full h-48 p-2 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-300 font-mono focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
        </div>
      )}
      {fuseDisabled && !mergedData && !isLoading && (
         <p className="text-center text-amber-400 mt-4">{disabledMessage}</p>
      )}
    </>
  );
};

export default ResultPanel;
