import React, { useState, useEffect, useMemo } from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { DataGrid } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';

const ExcelViewer = ({ data, metadata, onBack, onSelectionSummaryChange, clearSelectionToken }) => {
  const [columns, setColumns] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [frozenRowCount, setFrozenRowCount] = useState(0);
  const [frozenColumnCount, setFrozenColumnCount] = useState(0);
  const [selection, setSelection] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionAnchor, setSelectionAnchor] = useState(null);

  useEffect(() => {
    if (!data || !metadata) return;

    // Create column definitions
    const isCellInSelection = (rowIdx, colIdx) => {
      if (!selection) return false;
      const minRow = Math.min(selection.startRow, selection.endRow);
      const maxRow = Math.max(selection.startRow, selection.endRow);
      const minCol = Math.min(selection.startCol, selection.endCol);
      const maxCol = Math.max(selection.startCol, selection.endCol);
      return rowIdx >= minRow && rowIdx <= maxRow && colIdx >= minCol && colIdx <= maxCol;
    };

    const cols = Array.from({ length: metadata.columns }, (_, i) => ({
      key: i.toString(),
      name: getExcelColumnName(i),
      frozen: i < frozenColumnCount,
      resizable: true,
      sortable: true,
      width: 120,
      cellClass: (row) => (isCellInSelection(row?.id, i) ? 'excel-selection-cell' : undefined),
      renderCell: ({ row }) => (
        <div
          className="excel-cell-content"
          onMouseEnter={() => {
            if (!isSelecting) return;
            const rowIdx = row?.id;
            if (typeof rowIdx !== 'number') return;
            if (!selectionAnchor) return;
            setSelection({
              startRow: selectionAnchor.row,
              startCol: selectionAnchor.col,
              endRow: rowIdx,
              endCol: i
            });
          }}
        >
          {row?.[i.toString()] ?? ''}
        </div>
      ),
      renderSummaryCell: ({ row }) => row?.[i.toString()] ?? ''
    }));

    const rowNumberColumn = {
      key: '__rowNumber',
      name: '#',
      frozen: frozenColumnCount > 0,
      resizable: false,
      sortable: false,
      width: 56,
      headerCellClass: 'row-number-header',
      cellClass: 'row-number-cell',
      renderCell: ({ row }) => row?.id + 1,
      renderSummaryCell: ({ row }) => row?.id + 1
    };
    
    // Transform data into rows format expected by react-data-grid
    const formattedRows = data.map((row, rowIndex) => {
      return {
        id: rowIndex,
        ...row
      };
    });

    setColumns([rowNumberColumn, ...cols]);
    setRawRows(formattedRows);
  }, [data, metadata, frozenColumnCount, selection, isSelecting, selectionAnchor]);

  useEffect(() => {
    if (!metadata) return;
    setFrozenRowCount((value) => Math.min(value, Math.min(10, rawRows.length)));
    setFrozenColumnCount((value) => Math.min(value, Math.min(10, metadata.columns)));
  }, [rawRows.length, metadata]);

  useEffect(() => {
    if (!data || !metadata) return;
    setSelection(null);
    setSelectionAnchor(null);
    setIsSelecting(false);
  }, [data, metadata]);

  useEffect(() => {
    if (!selection) return;
    if (!rawRows.length || !metadata) return;
    const maxRow = rawRows.length - 1;
    const maxCol = metadata.columns - 1;
    setSelection((current) => {
      if (!current) return current;
      const clamp = (value, max) => Math.min(Math.max(value, 0), max);
      const next = {
        startRow: clamp(current.startRow, maxRow),
        endRow: clamp(current.endRow, maxRow),
        startCol: clamp(current.startCol, maxCol),
        endCol: clamp(current.endCol, maxCol)
      };
      if (
        next.startRow === current.startRow &&
        next.endRow === current.endRow &&
        next.startCol === current.startCol &&
        next.endCol === current.endCol
      ) {
        return current;
      }
      return next;
    });
  }, [rawRows.length, metadata, selection]);

  useEffect(() => {
    const handleMouseUp = () => setIsSelecting(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Convert column index to Excel column name (A, B, C, ..., Z, AA, AB, etc.)
  const getExcelColumnName = (index) => {
    let columnName = '';
    let tempIndex = index;
    
    while (tempIndex >= 0) {
      const remainder = tempIndex % 26;
      columnName = String.fromCharCode(65 + remainder) + columnName;
      tempIndex = Math.floor(tempIndex / 26) - 1;
    }
    
    return columnName;
  };

  const selectionSummary = useMemo(() => {
    if (!selection || !metadata) return null;
    const minRow = Math.min(selection.startRow, selection.endRow);
    const maxRow = Math.max(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);
    const maxCol = Math.max(selection.startCol, selection.endCol);
    const startCell = `${getExcelColumnName(minCol)}${minRow + 1}`;
    const endCell = `${getExcelColumnName(maxCol)}${maxRow + 1}`;
    return {
      minRow,
      maxRow,
      minCol,
      maxCol,
      startCell,
      endCell,
      rangeLabel: `${startCell}:${endCell}`
    };
  }, [metadata, selection]);

  useEffect(() => {
    onSelectionSummaryChange?.(selectionSummary);
  }, [selectionSummary, onSelectionSummaryChange]);

  const clearSelection = () => {
    setSelection(null);
    setSelectionAnchor(null);
    setIsSelecting(false);
  };

  useEffect(() => {
    if (clearSelectionToken === undefined) return;
    clearSelection();
  }, [clearSelectionToken]);

  if (!data || !metadata) {
    return <div>Loading Excel data...</div>;
  }

  const topSummaryRows = frozenRowCount > 0 ? rawRows.slice(0, frozenRowCount) : undefined;
  const rows = frozenRowCount > 0 ? rawRows.slice(frozenRowCount) : rawRows;

  const maxFrozenRows = Math.min(10, rawRows.length);
  const maxFrozenColumns = Math.min(10, metadata.columns);

  const handleCellMouseDown = ({ row, column }) => {
    if (!row || !column) return;
    const colIdx = Number(column.key);
    if (!Number.isFinite(colIdx)) return;
    const rowIdx = row.id;
    if (typeof rowIdx !== 'number') return;
    const anchor = { row: rowIdx, col: colIdx };
    setSelectionAnchor(anchor);
    setSelection({
      startRow: rowIdx,
      startCol: colIdx,
      endRow: rowIdx,
      endCol: colIdx
    });
    setIsSelecting(true);
  };

  return (
    <div className="excel-viewer">
      <div className="excel-header">
        <div className="excel-title-group">
          <button type="button" className="back-button" onClick={onBack} aria-label="Back to upload">
            <FiArrowLeft />
          </button>
          <h2>Excel Spreadsheet</h2>
        </div>
        <div className="excel-controls">
          <label className="excel-control-select">
            <span>Freeze Rows</span>
            <select
              value={frozenRowCount}
              onChange={(event) => setFrozenRowCount(Number(event.target.value))}
            >
              {Array.from({ length: maxFrozenRows + 1 }, (_, i) => (
                <option key={`freeze-rows-${i}`} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
          <label className="excel-control-select">
            <span>Freeze Columns</span>
            <select
              value={frozenColumnCount}
              onChange={(event) => setFrozenColumnCount(Number(event.target.value))}
            >
              {Array.from({ length: maxFrozenColumns + 1 }, (_, i) => (
                <option key={`freeze-cols-${i}`} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="excel-grid">
        <DataGrid
          columns={columns}
          rows={rows}
          rowHeight={35}
          summaryRowHeight={35}
          topSummaryRows={topSummaryRows}
          rowKeyGetter={(row) => row.id}
          className="rdg-light"
          onCellMouseDown={handleCellMouseDown}
        />
      </div>
    </div>
  );
};

export default ExcelViewer;
