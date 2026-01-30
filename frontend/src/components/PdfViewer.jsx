import React from 'react';
import { FiArrowLeft } from 'react-icons/fi';

const PdfViewer = ({ pdfUrl, filename, onBack }) => {
  return (
    <div className="pdf-viewer">
      <div className="pdf-header">
        <div className="pdf-title-group">
          <button type="button" className="back-button" onClick={onBack} aria-label="Back to upload">
            <FiArrowLeft />
          </button>
          <div>
            <h2>PDF Document</h2>
            {filename && <p className="pdf-filename">{filename}</p>}
          </div>
        </div>
      </div>
      <div className="pdf-frame">
        {pdfUrl ? (
          <iframe title="PDF preview" src={pdfUrl} />
        ) : (
          <div className="loading">Loading PDF...</div>
        )}
      </div>
    </div>
  );
};

export default PdfViewer;
