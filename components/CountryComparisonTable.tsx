
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { CountryDetail } from '../types';
import ScrollJumpButtons from './ScrollJumpButtons';

type CountrySelectionChoice = 'A' | 'B' | 'discard';

// A new component for the 3-way toggle switch, using styled radio buttons
const ThreeWayToggle: React.FC<{
  name: string; // Used for the radio group name, must be unique per row
  selection: CountrySelectionChoice | undefined;
  onSelect: (choice: CountrySelectionChoice) => void;
  disabledChoices?: { A?: boolean; B?: boolean };
  fileNameA: string;
  fileNameB: string;
}> = ({ name, selection, onSelect, disabledChoices = {}, fileNameA, fileNameB }) => {
  return (
    <div className="three-way-toggle">
      <input
        type="radio"
        id={`${name}-a`}
        name={name}
        value="A"
        checked={selection === 'A'}
        onChange={() => onSelect('A')}
        disabled={disabledChoices.A}
      />
      <label htmlFor={`${name}-a`} title={`Keep feature from ${fileNameA}`}>A</label>

      <input
        type="radio"
        id={`${name}-b`}
        name={name}
        value="B"
        checked={selection === 'B'}
        onChange={() => onSelect('B')}
        disabled={disabledChoices.B}
      />
      <label htmlFor={`${name}-b`} title={`Keep feature from ${fileNameB}`}>B</label>

      <input
        type="radio"
        id={`${name}-discard`}
        name={name}
        value="discard"
        checked={selection === 'discard'}
        onChange={() => onSelect('discard')}
      />
      <label htmlFor={`${name}-discard`} title="Discard this feature from merge">Discard</label>

      <div className="slider"></div>
    </div>
  );
};


interface CountryComparisonTableProps {
  countriesDetailsA: CountryDetail[] | undefined;
  countriesDetailsB: CountryDetail[] | undefined;
  fileNameA: string;
  fileNameB: string;
  countrySelections: Map<string, CountrySelectionChoice>;
  updateCountrySelection: (name: string, choice: CountrySelectionChoice | null) => void;
  setAllDisplayedEntriesSelection: (updates: Map<string, CountrySelectionChoice | null>) => void;
}

type SortableColumnKey = 'name' | 'fileA' | 'fileB' | 'choice';
interface SortConfig {
  key: SortableColumnKey;
  direction: 'ascending' | 'descending';
}

// SVG Icon Components (Material Design Style)
const ArrowUpIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z" />
  </svg>
);

const ArrowDownIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z" />
  </svg>
);

const UnfoldMoreIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4 opacity-50" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z" />
  </svg>
);

const SovereignGroupIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" className={className}>
        <path d="M480-160q18 0 34.5-2t33.5-6l-48-72H360v-40q0-33 23.5-56.5T440-360h80v-120h-80q-17 0-28.5-11.5T400-520v-80h-18q-26 0-44-17.5T320-661q0-9 2.5-18t7.5-17l62-91q-101 29-166.5 113T160-480h40v-40q0-17 11.5-28.5T240-560h80q17 0 28.5 11.5T360-520v40q0 17-11.5 28.5T320-440v40q0 33-23.5 56.5T240-320h-37q42 72 115 116t162 44Zm304-222q8-23 12-47.5t4-50.5q0-112-68-197.5T560-790v110q33 0 56.5 23.5T640-600v80q19 0 34 4.5t29 18.5l81 115ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>
    </svg>
);


const CountryComparisonTable: React.FC<CountryComparisonTableProps> = ({
  countriesDetailsA = [],
  countriesDetailsB = [],
  fileNameA,
  fileNameB,
  countrySelections,
  updateCountrySelection,
  setAllDisplayedEntriesSelection,
}) => {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });
  const [groupSortActive, setGroupSortActive] = useState<boolean>(false);
  const [filterText, setFilterText] = useState<string>('');

  const mapA = useMemo(() => new Map(countriesDetailsA.map(cd => [cd.name, cd])), [countriesDetailsA]);
  const mapB = useMemo(() => new Map(countriesDetailsB.map(cd => [cd.name, cd])), [countriesDetailsB]);

  const allCountryNames = useMemo(() => 
    Array.from(
      new Set([...countriesDetailsA.map(cd => cd.name), ...countriesDetailsB.map(cd => cd.name)])
    ).sort((a, b) => a.localeCompare(b)),
    [countriesDetailsA, countriesDetailsB]
  );

  const stats = useMemo(() => {
    const s = {
      recognized: { common: 0, uniqueA: 0, uniqueB: 0 },
      dependent: { common: 0, uniqueA: 0, uniqueB: 0 },
    };
    allCountryNames.forEach(name => {
      const detailA = mapA.get(name);
      const detailB = mapB.get(name);
      const representativeDetail = detailA || detailB || { name, isDependency: false };
      const inA = !!detailA;
      const inB = !!detailB;
      const category = representativeDetail.isDependency ? s.dependent : s.recognized;

      if (inA && inB) category.common++;
      else if (inA) category.uniqueA++;
      else if (inB) category.uniqueB++;
    });
    return s;
  }, [allCountryNames, mapA, mapB]);
  
  const requestSort = (key: SortableColumnKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && !groupSortActive && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
    setGroupSortActive(false);
  };

  const handleGroupSort = useCallback(() => {
    if (groupSortActive) {
      setSortConfig(prev => ({ ...prev, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' }));
    } else {
      setGroupSortActive(true);
      setSortConfig({ key: 'name', direction: 'ascending' });
    }
  }, [groupSortActive]);

  const sortedDisplayData = useMemo(() => {
    const lowercasedFilter = filterText.toLowerCase();
    
    let sortableItems = allCountryNames
      .filter(name => lowercasedFilter === '' || name.toLowerCase().includes(lowercasedFilter))
      .map(name => {
        const detailA = mapA.get(name);
        const detailB = mapB.get(name);
        const representativeDetail = detailA || detailB || { name, isDependency: false, sovereignState: undefined };
        return {
          name: representativeDetail.name,
          isDependency: representativeDetail.isDependency,
          sovereignState: representativeDetail.sovereignState || representativeDetail.name,
          inA: !!detailA,
          inB: !!detailB,
        };
      });

    if (groupSortActive) {
      sortableItems.sort((a, b) => {
        let comparison = 0;
        comparison = a.sovereignState.localeCompare(b.sovereignState);
        if (comparison === 0) {
          if (!a.isDependency && b.isDependency) {
            comparison = -1;
          } else if (a.isDependency && !b.isDependency) {
            comparison = 1;
          } else {
            comparison = a.name.localeCompare(b.name);
          }
        }
        return sortConfig.direction === 'ascending' ? comparison : comparison * -1;
      });
    } else if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let comparison = 0;
        if (sortConfig.key === 'name') {
          comparison = a.name.localeCompare(b.name);
        } else if (sortConfig.key === 'fileA') {
          if (a.inA && !b.inA) comparison = -1;
          else if (!a.inA && b.inA) comparison = 1;
          else comparison = a.name.localeCompare(b.name); 
        } else if (sortConfig.key === 'fileB') {
          if (a.inB && !b.inB) comparison = -1;
          else if (!b.inB && b.inB) comparison = 1;
          else comparison = a.name.localeCompare(b.name); 
        } else if (sortConfig.key === 'choice') {
          const choiceOrder: Record<string, number> = { 'A': 1, 'B': 2, 'discard': 3 };
          const choiceA = countrySelections.get(a.name);
          const choiceB = countrySelections.get(b.name);
          const valA = choiceA ? choiceOrder[choiceA] : 4;
          const valB = choiceB ? choiceOrder[choiceB] : 4;
          comparison = valA - valB;
          if (comparison === 0) {
              comparison = a.name.localeCompare(b.name);
          }
        }
        return sortConfig.direction === 'ascending' ? comparison : comparison * -1;
      });
    }
    return sortableItems;
  }, [allCountryNames, mapA, mapB, sortConfig, countrySelections, groupSortActive, filterText]);

  const handleSimpleSelect = useCallback((choice: CountrySelectionChoice | 'clear') => {
    const updates = new Map<string, CountrySelectionChoice | null>();
    const effectiveChoice = choice === 'clear' ? null : choice;
    sortedDisplayData.forEach(d => {
        updates.set(d.name, effectiveChoice);
    });
    setAllDisplayedEntriesSelection(updates);
  }, [sortedDisplayData, setAllDisplayedEntriesSelection]);

  const handleSmartSelect = useCallback((primary: 'A' | 'B') => {
      const updates = new Map<string, CountrySelectionChoice | null>();
      const secondary = primary === 'A' ? 'B' : 'A';

      sortedDisplayData.forEach(item => {
          const primaryExists = primary === 'A' ? item.inA : item.inB;
          const secondaryExists = secondary === 'A' ? item.inA : item.inB;

          if (primaryExists) {
              updates.set(item.name, primary);
          } else if (secondaryExists) {
              updates.set(item.name, secondary);
          }
      });
      setAllDisplayedEntriesSelection(updates);
  }, [sortedDisplayData, setAllDisplayedEntriesSelection]);


  if (allCountryNames.length === 0 && countriesDetailsA.length === 0 && countriesDetailsB.length === 0) {
    return <p className="text-slate-400 text-center my-4">No country/territory names found in the selected files to compare.</p>;
  }
  
  const getSortIcon = (columnKey: SortableColumnKey) => {
    if (sortConfig.key !== columnKey) {
      return <UnfoldMoreIcon />;
    }
    if (sortConfig.direction === 'ascending') {
      return <ArrowUpIcon />;
    }
    return <ArrowDownIcon />;
  };

  return (
    <div ref={tableContainerRef} className="relative">
      <ScrollJumpButtons targetElementRef={tableContainerRef} thresholdHeightPx={400} />
      
      <div className="mb-6">
        <h4 className="text-lg font-medium text-slate-200 mb-2">Recognized Countries</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="bg-slate-700 p-3 rounded">
            <p className="text-slate-300 text-sm">Common to Both</p>
            <p className="text-emerald-400 font-bold text-2xl">{stats.recognized.common}</p>
          </div>
          <div className="bg-slate-700 p-3 rounded">
            <p className="text-slate-300 text-sm">Only in {fileNameA || 'File A'}</p>
            <p className="text-red-400 font-bold text-2xl">{stats.recognized.uniqueA}</p>
          </div>
          <div className="bg-slate-700 p-3 rounded">
            <p className="text-slate-300 text-sm">Only in {fileNameB || 'File B'}</p>
            <p className="text-red-400 font-bold text-2xl">{stats.recognized.uniqueB}</p>
          </div>
        </div>
      </div>

       <div className="mb-6">
        <h4 className="text-lg font-medium text-slate-200 mb-2">Dependent Territories</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="bg-slate-700 p-3 rounded">
            <p className="text-slate-300 text-sm">Common to Both</p>
            <p className="text-emerald-400 font-bold text-2xl">{stats.dependent.common}</p>
          </div>
          <div className="bg-slate-700 p-3 rounded">
            <p className="text-slate-300 text-sm">Only in {fileNameA || 'File A'}</p>
            <p className="text-amber-400 font-bold text-2xl">{stats.dependent.uniqueA}</p>
          </div>
          <div className="bg-slate-700 p-3 rounded">
            <p className="text-slate-300 text-sm">Only in {fileNameB || 'File B'}</p>
            <p className="text-amber-400 font-bold text-2xl">{stats.dependent.uniqueB}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 p-4 border border-slate-700 rounded-md bg-slate-900/50 space-y-4">
        <div className="flex-grow">
          <label htmlFor="country-filter" className="block text-sm font-medium text-slate-300 mb-1">
            Filter Table by Name/Territory
          </label>
          <input
            id="country-filter"
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="e.g., United States, France..."
            className="w-full md:w-1/2 p-2 bg-slate-900 border border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 text-slate-100 placeholder:text-slate-400"
          />
        </div>

        {sortedDisplayData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pt-4 border-t border-slate-700">
            <div>
                <h5 className="text-sm font-semibold text-slate-300 mb-2">Simple Select (for displayed items)</h5>
                <div className="flex flex-wrap items-center gap-2">
                <button title="Set all displayed entries to keep File A's version" className="px-3 py-1 text-xs rounded-md bg-sky-700 hover:bg-sky-600 text-white transition-colors" onClick={() => handleSimpleSelect('A')}>Keep All A</button>
                <button title="Set all displayed entries to keep File B's version" className="px-3 py-1 text-xs rounded-md bg-emerald-700 hover:bg-emerald-600 text-white transition-colors" onClick={() => handleSimpleSelect('B')}>Keep All B</button>
                <button title="Set all displayed entries to be discarded" className="px-3 py-1 text-xs rounded-md bg-red-700 hover:bg-red-600 text-white transition-colors" onClick={() => handleSimpleSelect('discard')}>Discard All</button>
                <button title="Clear all selections for displayed entries" className="px-3 py-1 text-xs rounded-md bg-slate-600 hover:bg-slate-500 text-white transition-colors" onClick={() => handleSimpleSelect('clear')}>Clear All</button>
                </div>
            </div>
            <div>
                <h5 className="text-sm font-semibold text-slate-300 mb-2">Smart Select (for displayed items)</h5>
                <div className="flex flex-wrap items-center gap-2">
                <button title="For each entry, prefer File A. If not in A, use File B." className="px-3 py-1 text-xs rounded-md bg-sky-700/80 hover:bg-sky-600/80 border border-sky-600 text-white transition-colors" onClick={() => handleSmartSelect('A')}>Keep A (fallback B)</button>
                <button title="For each entry, prefer File B. If not in B, use File A." className="px-3 py-1 text-xs rounded-md bg-emerald-700/80 hover:bg-emerald-600/80 border border-emerald-600 text-white transition-colors" onClick={() => handleSmartSelect('B')}>Keep B (fallback A)</button>
                </div>
            </div>
            </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full w-full table-fixed divide-y divide-slate-700">
          <thead className="bg-slate-700 sticky top-0 z-10">
            <tr>
              <th
                scope="col" 
                className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"
              >
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => requestSort('name')}
                    className="flex items-center hover:text-sky-300 transition-colors"
                    aria-label="Sort by name alphabetically"
                    aria-sort={!groupSortActive && sortConfig.key === 'name' ? sortConfig.direction : 'none'}
                  >
                    Name / Territory
                    <span className="ml-2">
                      {!groupSortActive ? getSortIcon('name') : <UnfoldMoreIcon className="w-4 h-4 opacity-30" />}
                    </span>
                  </button>
                  <button
                    onClick={handleGroupSort}
                    className={`ml-2 p-1.5 rounded-md transition-colors ${groupSortActive ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-600'}`}
                    title="Group by sovereign country"
                    aria-pressed={groupSortActive}
                  >
                    {groupSortActive 
                        ? (sortConfig.direction === 'ascending' ? <ArrowUpIcon className="w-5 h-5" /> : <ArrowDownIcon className="w-5 h-5" />)
                        : <SovereignGroupIcon className="w-5 h-5" />
                    }
                  </button>
                </div>
              </th>
              <th 
                scope="col" 
                className="w-28 px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-600 transition-colors"
                onClick={() => requestSort('fileA')}
                aria-sort={sortConfig.key === 'fileA' ? (sortConfig.direction === 'ascending' ? 'ascending' : 'descending') : 'none'}
              >
                 <div className="flex items-center justify-center">
                  In A?
                  <span className="ml-2">{getSortIcon('fileA')}</span>
                </div>
              </th>
              <th 
                scope="col" 
                className="w-28 px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-600 transition-colors"
                onClick={() => requestSort('fileB')}
                aria-sort={sortConfig.key === 'fileB' ? (sortConfig.direction === 'ascending' ? 'ascending' : 'descending') : 'none'}
              >
                <div className="flex items-center justify-center">
                  In B?
                  <span className="ml-2">{getSortIcon('fileB')}</span>
                </div>
              </th>
              <th 
                scope="col" 
                className="w-40 px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-600 transition-colors"
                onClick={() => requestSort('choice')}
                aria-sort={sortConfig.key === 'choice' ? (sortConfig.direction === 'ascending' ? 'ascending' : 'descending') : 'none'}
              >
                <div className="flex items-center justify-center">
                  A / B / Discard
                  <span className="ml-2">{getSortIcon('choice')}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-slate-800 divide-y divide-slate-700">
            {sortedDisplayData.length > 0 ? (
              sortedDisplayData.map((detail) => {
                const selection = countrySelections.get(detail.name);
                let rowClass = '';
                if (selection === 'discard') {
                    rowClass = 'opacity-50 bg-slate-800/50';
                } else if (selection === 'A' || selection === 'B') {
                    // highlight selected rows
                } else if (detail.inA && detail.inB) {
                    rowClass = 'bg-emerald-900/30'; 
                } else if (detail.isDependency) {
                    rowClass = 'bg-amber-900/30'; 
                } else {
                    rowClass = 'bg-red-900/30'; 
                }
                if (selection) {
                  rowClass += ' font-semibold';
                }

                return (
                  <tr key={detail.name} className={`${rowClass} hover:bg-slate-700/50 transition-colors`}>
                    <td className="px-4 py-3 text-sm text-slate-200">
                      <div className="truncate" title={detail.isDependency ? `${detail.name} (${detail.sovereignState})` : detail.name}>
                          {detail.isDependency ? (
                          <em>
                              {detail.name}
                              {detail.sovereignState && detail.sovereignState !== detail.name && <span className="text-xs text-slate-400 ml-1">({detail.sovereignState})</span>}
                          </em>
                          ) : (
                          detail.name
                          )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-slate-200">
                      {detail.inA ? <span className="text-emerald-400 font-bold">X</span> : <span className="text-slate-500">-</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-slate-200">
                      {detail.inB ? <span className="text-emerald-400 font-bold">X</span> : <span className="text-slate-500">-</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <ThreeWayToggle
                        name={detail.name}
                        selection={selection}
                        onSelect={(choice) => {
                            const currentChoice = countrySelections.get(detail.name);
                            if (currentChoice === choice) {
                                updateCountrySelection(detail.name, null);
                            } else {
                                updateCountrySelection(detail.name, choice);
                            }
                        }}
                        disabledChoices={{ A: !detail.inA, B: !detail.inB }}
                        fileNameA={fileNameA}
                        fileNameB={fileNameB}
                      />
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                  <td colSpan={4} className="text-center text-slate-400 py-6">
                      {filterText 
                          ? `No entries match your filter "${filterText}".` 
                          : 'No country/territory names available for comparison.'
                      }
                  </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CountryComparisonTable;
