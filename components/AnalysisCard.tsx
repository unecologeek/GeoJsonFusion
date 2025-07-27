
import React from 'react';
import { FileAnalysisResult, CountryDetail } from '../types';

interface AnalysisCardProps {
  analysis: FileAnalysisResult | null;
  title: string;
}

const AnalysisCard: React.FC<AnalysisCardProps> = ({ analysis, title }) => {
  if (!analysis) {
    return (
      <div className="bg-slate-800 p-6 rounded-lg shadow-lg h-full flex flex-col justify-center items-center">
        <p className="text-slate-400 text-center">Select a file to see its analysis.</p>
      </div>
    );
  }

  const recognizedCountries = analysis.countryDetails.filter(cd => !cd.isDependency).length;
  const dependentTerritories = analysis.countryDetails.filter(cd => cd.isDependency).length;

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-lg h-full flex flex-col">
      <h3 className="text-xl font-semibold text-sky-400 mb-4 border-b border-slate-700 pb-2">{title}: <span className="text-sky-300">{analysis.fileName}</span></h3>
      <div className="space-y-3 text-sm flex-grow">
        <p><strong className="text-slate-400">Features:</strong> <span className="text-slate-200">{analysis.numFeatures}</span></p>
        <p><strong className="text-slate-400">Geometry Precision (Coord Count):</strong> <span className="text-slate-200">{analysis.geometryPrecisionScore.toLocaleString()}</span></p>
        <div>
          <strong className="text-slate-400">Detected Languages (NAME_xx):</strong>
          {analysis.languages.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-1">
              {analysis.languages.map(lang => (
                <span key={lang} className="px-2 py-1 bg-sky-700 text-sky-100 text-xs rounded-full">{lang}</span>
              ))}
            </div>
          ) : <span className="text-slate-300 ml-1">None</span>}
        </div>
        <div>
          <strong className="text-slate-400">Common Property Keys ({analysis.commonProperties.length}):</strong>
          <div className="max-h-32 overflow-y-auto bg-slate-700 p-2 rounded-md mt-1 text-xs">
            {analysis.commonProperties.length > 0 ? analysis.commonProperties.join(', ') : 'None'}
          </div>
        </div>
         <div>
          <strong className="text-slate-400">Potential ID Keys:</strong>
           <div className="max-h-20 overflow-y-auto bg-slate-700 p-2 rounded-md mt-1 text-xs">
            {analysis.potentialIdKeys.length > 0 ? analysis.potentialIdKeys.join(', ') : 'None identified'}
          </div>
        </div>
        <div>
          <strong className="text-slate-400">Name/Territory Analysis:</strong>
          {analysis.countryNameProperty ? (
            <div className="text-sm text-slate-300 mt-1 space-y-1">
              <p>Using name property: <span className="font-semibold text-sky-300">{analysis.countryNameProperty}</span></p>
              {analysis.sovereigntyPropertyKey && (
                <p>Using sovereignty property: <span className="font-semibold text-sky-300">{analysis.sovereigntyPropertyKey}</span></p>
              )}
              <p>Total unique entries: <span className="font-semibold text-slate-100">{analysis.countryDetails.length}</span></p>
              <p>Recognized countries: <span className="font-semibold text-emerald-400">{recognizedCountries}</span></p>
              <p>Dependent territories: <span className="font-semibold text-amber-400">{dependentTerritories}</span></p>
            </div>
          ) : (
             <p className="text-sm text-slate-400 mt-1">(Could not reliably determine a primary name property for territory analysis)</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisCard;
