import React, { useState, useRef } from 'react';
import { FiUpload } from 'react-icons/fi';

const PdfUpload = ({ onFileUpload, loading, error }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const isFileSupported = (file) => {
    if (file.type === 'application/pdf') return true;
    const extension = file.name.toLowerCase().split('.').pop();
    return extension === 'pdf';
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && isFileSupported(file)) {
      setSelectedFile(file);
      onFileUpload(file);
    } else {
      setSelectedFile(null);
      alert('Please select a valid PDF file (.pdf)');
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && isFileSupported(file)) {
      setSelectedFile(file);
    } else {
      alert('Please drop a valid PDF file (.pdf)');
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      fileInputRef.current?.click();
      return;
    }
    onFileUpload(selectedFile);
  };

  const uploadButtonLabel = loading
    ? 'Uploading...'
    : (selectedFile ? 'Upload' : 'Choose File');

  return (
    <div
      className="file-upload"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf"
        id="pdf-input"
      />
      <label htmlFor="pdf-input">
        <FiUpload />
        <h2>Upload PDF</h2>
        <p>Drag & drop your PDF here or click to browse</p>
        <p className="supported-formats">
          Supported format: PDF
        </p>
        {selectedFile && (
          <p className="selected-file">Selected: {selectedFile.name}</p>
        )}
      </label>
      {error && <p className="error">{error}</p>}
      <button
        onClick={handleUpload}
        disabled={loading}
      >
        {uploadButtonLabel}
      </button>
    </div>
  );
};

export default PdfUpload;
