
import React, { useRef } from 'react';

interface SettingsManagementPanelProps {
  onSaveSettings: () => void;
  onLoadSettings: (file: File) => void;
  settingsMessage: string | null;
  disabled?: boolean;
}

const SettingsManagementPanel: React.FC<SettingsManagementPanelProps> = ({
  onSaveSettings,
  onLoadSettings,
  settingsMessage,
  disabled = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onLoadSettings(file);
      // Reset file input to allow loading the same file again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <div className="grid md:grid-cols-2 gap-6 items-start">
        <div>
          <h3 className="text-lg font-medium text-slate-200 mb-2">Save Configuration</h3>
          <p className="text-xs text-slate-400 mb-3">
            Save the current merge strategy, discarded entries, and manual translations to a JSON file.
          </p>
          <button
            onClick={onSaveSettings}
            disabled={disabled}
            className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-md shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-75"
          >
            Save Current Settings
          </button>
        </div>

        <div>
          <h3 className="text-lg font-medium text-slate-200 mb-2">Load Configuration</h3>
          <p className="text-xs text-slate-400 mb-3">
            Load a previously saved settings JSON file to apply its configuration.
          </p>
          <input
            type="file"
            accept=".json"
            onChange={handleFileChange}
            ref={fileInputRef}
            disabled={disabled}
            className="block w-full text-sm text-slate-300
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-md file:border-0
                       file:text-sm file:font-semibold
                       file:bg-slate-700 file:text-sky-300
                       hover:file:bg-slate-600
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            aria-label="Load settings from file"
          />
        </div>
      </div>

      {settingsMessage && (
        <div className={`mt-4 p-3 rounded-md text-sm ${settingsMessage.toLowerCase().includes('error') ? 'bg-red-700/80 text-red-100 border border-red-900' : 'bg-green-700/80 text-green-100 border border-green-900'}`}
             role="status"
             aria-live="polite"
        >
          {settingsMessage}
        </div>
      )}
       {disabled && (
        <p className="text-center text-amber-400 mt-4 text-sm">
          Select files and configure merge options to enable settings management.
        </p>
      )}
    </>
  );
};

export default SettingsManagementPanel;
