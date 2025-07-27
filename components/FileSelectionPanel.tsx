
import React from 'react';
import { FileSource, SetSelectedFileFn } from '../types';

interface FileSelectionPanelProps {
  availableFiles: FileSource[];
  selectedFileAKey: string | null;
  setSelectedFileAKey: SetSelectedFileFn;
  selectedFileBKey: string | null;
  setSelectedFileBKey: SetSelectedFileFn;
  idProperty: string;
  setIdProperty: (idProp: string) => void;
  potentialIdKeysA: string[];
  potentialIdKeysB: string[];
}

const FileSelectionPanel: React.FC<FileSelectionPanelProps> = ({
  availableFiles,
  selectedFileAKey,
  setSelectedFileAKey,
  selectedFileBKey,
  setSelectedFileBKey,
  idProperty,
  setIdProperty,
  potentialIdKeysA,
  potentialIdKeysB,
}) => {
  const commonPotentialIdKeys = Array.from(new Set([...potentialIdKeysA, ...potentialIdKeysB])).sort();
  const handleIdPropertyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setIdProperty(e.target.value);
  };

  return (
    <div className="grid md:grid-cols-3 gap-6 items-end">
      <div>
        <label htmlFor="fileA" className="block text-sm font-medium text-slate-300 mb-1">
          File A (Primary Reference)
        </label>
        <select
          id="fileA"
          value={selectedFileAKey || ''}
          onChange={(e) => setSelectedFileAKey(e.target.value || null)}
          className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-slate-100"
        >
          <option value="">-- Select File A --</option>
          {availableFiles.map((file) => (
            <option key={file.key} value={file.key} disabled={file.key === selectedFileBKey}>
              {file.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="fileB" className="block text-sm font-medium text-slate-300 mb-1">
          File B (Secondary Reference)
        </label>
        <select
          id="fileB"
          value={selectedFileBKey || ''}
          onChange={(e) => setSelectedFileBKey(e.target.value || null)}
          className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-slate-100"
        >
          <option value="">-- Select File B --</option>
          {availableFiles.map((file) => (
            <option key={file.key} value={file.key} disabled={file.key === selectedFileAKey}>
              {file.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="idProperty" className="block text-sm font-medium text-slate-300 mb-1">
          Feature Matching ID Property
        </label>
        <select
          id="idProperty"
          value={idProperty}
          onChange={handleIdPropertyChange}
          className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-slate-100"
          disabled={!selectedFileAKey || !selectedFileBKey || commonPotentialIdKeys.length === 0}
        >
          {commonPotentialIdKeys.length > 0 ? (
            commonPotentialIdKeys.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))
          ) : (
            <option value="">{selectedFileAKey && selectedFileBKey ? 'No common ID keys found' : 'Select files first'}</option>
          )}
        </select>
        {(!selectedFileAKey || !selectedFileBKey) && <p className="text-xs text-slate-400 mt-1">Select both files to see ID property options.</p>}
      </div>
    </div>
  );
};

export default FileSelectionPanel;
