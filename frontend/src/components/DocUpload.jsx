import React, { useState } from 'react';
import { FiUpload } from 'react-icons/fi';

const DocUpload = ({ onFileUpload, loading, error }) => {
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
    if (file) {
      onFileUpload(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      onFileUpload(selectedFile);
    }
  };

  const uploadButtonLabel = loading
    ? 'Uploading...'
    : (selectedFile ? 'Upload' : 'Choose File');

  return (
    <div className="file-upload">
      <label htmlFor="doc-upload">
        <FiUpload />
        <h2>Upload Word Document</h2>
        <p>Drag & drop your .docx here or click to browse</p>
        <p>Supported format: DOCX</p>
      </label>
      <input
        id="doc-upload"
        type="file"
        accept=".docx"
        onChange={handleFileChange}
      />
      <button type="button" onClick={handleUpload} disabled={loading}>
        {uploadButtonLabel}
      </button>
      {error && <p className="upload-error">{error}</p>}
    </div>
  );
};

export default DocUpload;
