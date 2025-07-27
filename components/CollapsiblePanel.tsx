
import React, { useState, ReactNode } from 'react';

// Chevron Icon
const ChevronDownIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
  </svg>
);

interface CollapsiblePanelProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  disabled?: boolean;
  className?: string;
}

const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({ 
  title, 
  children, 
  defaultOpen = false, 
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // When a panel is disabled, it should be forced closed unless it was explicitly defaulted to open.
  // This prevents seeing stale content in a disabled (and therefore non-interactive) panel.
  const effectiveIsOpen = disabled ? (defaultOpen && isOpen) : isOpen;

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(prev => !prev);
    }
  };

  const panelId = `collapsible-panel-${title.replace(/\s+/g, '-').toLowerCase()}`;
  const headerId = `collapsible-header-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className={`bg-slate-800 rounded-lg shadow-xl mb-6 transition-opacity ${disabled ? 'opacity-60' : ''} ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`w-full flex justify-between items-center p-6 text-left ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        aria-expanded={effectiveIsOpen}
        aria-controls={panelId}
        id={headerId}
      >
        <h2 className="text-2xl font-semibold text-sky-400">{title}</h2>
        <ChevronDownIcon className={`w-6 h-6 text-slate-400 transition-transform duration-300 ${effectiveIsOpen ? 'rotate-180' : ''}`} />
      </button>
      {effectiveIsOpen && (
        <div 
          id={panelId}
          role="region"
          aria-labelledby={headerId}
          className="px-6 pb-6"
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsiblePanel;
