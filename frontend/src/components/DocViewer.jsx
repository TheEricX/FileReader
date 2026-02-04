import React from 'react';
import { FiArrowLeft } from 'react-icons/fi';

const DocViewer = ({ filename, text, onBack }) => {
  return (
    <div className="doc-viewer">
      <div className="pdf-header">
        <div className="pdf-title-group">
          <button type="button" className="back-button" onClick={onBack} aria-label="Back to upload">
            <FiArrowLeft />
          </button>
          <div>
            <h2>Word Document</h2>
            {filename && <p className="pdf-filename">{filename}</p>}
          </div>
        </div>
      </div>
      <div className="doc-frame">
        {text ? (
          text.split('\n').map((line, index) => (
            <p key={`${index}-${line.slice(0, 8)}`} className="doc-line">
              {line || '\u00A0'}
            </p>
          ))
        ) : (
          <div className="loading">Loading document...</div>
        )}
      </div>
    </div>
  );
};

export default DocViewer;
