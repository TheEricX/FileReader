import React, { useState, useEffect, useMemo } from 'react';
import { FiSettings } from 'react-icons/fi';
import FileUpload from './components/FileUpload';
import PdfUpload from './components/PdfUpload';
import ExcelViewer from './components/ExcelViewer';
import PdfViewer from './components/PdfViewer';
import ChatInterface from './components/ChatInterface';
import './App.css';

function App() {
  const modelOptions = [
    {
      id: 'openai:gpt-4o',
      label: 'OpenAI GPT-4o',
      provider: 'openai',
      model: 'gpt-4o',
    },
    {
      id: 'bedrock:us.anthropic.claude-sonnet-4-5-20250929-v1:0',
      label: 'AWS Bedrock Claude Sonnet 4.5',
      provider: 'bedrock',
      model: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    },
  ];
  const [clientId, setClientId] = useState(null);
  const [excelData, setExcelData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState(modelOptions[0].id);
  const [leftPanelWidth, setLeftPanelWidth] = useState(68);
  const [isResizing, setIsResizing] = useState(false);
  const [selectedMode, setSelectedMode] = useState('spreadsheet');
  const [sessionMode, setSessionMode] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfFilename, setPdfFilename] = useState('');
  const [uploadHistory, setUploadHistory] = useState([]);
  const [showUploadManager, setShowUploadManager] = useState(false);
  const [uploadSearch, setUploadSearch] = useState('');
  const [uploadFilterType, setUploadFilterType] = useState('all');
  const [uploadSort, setUploadSort] = useState('newest');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsModelId, setSettingsModelId] = useState(null);
  const defaultModelParams = useMemo(() => ({
    temperature: 0.2,
    maxTokens: 2048,
    topP: 1,
    presencePenalty: 0,
    frequencyPenalty: 0
  }), []);
  const [modelParamsByModel, setModelParamsByModel] = useState({});
  const [chatDraft, setChatDraft] = useState('');
  const [focusInputToken, setFocusInputToken] = useState(0);
  const [selectionSummary, setSelectionSummary] = useState(null);
  const [clearSelectionToken, setClearSelectionToken] = useState(0);

  const uploadModes = [
    {
      id: 'spreadsheet',
      label: 'Spreadsheet',
      hint: 'XLSX, XLS, CSV, TSV, ODS',
    },
    {
      id: 'pdf',
      label: 'PDF',
      hint: 'PDF documents',
    },
    {
      id: 'doc',
      label: 'DOC',
      hint: 'Word documents',
      comingSoon: true,
    },
  ];

  // Initialize WebSocket connection when clientId is set
  useEffect(() => {
    if (!clientId || !sessionMode) return;

    // For WebSocket connections, we still need to use the full URL
    const wsUrl = sessionMode === 'pdf'
      ? `ws://localhost:8000/ws/pdf/${clientId}`
      : `ws://localhost:8000/ws/${clientId}`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'excel_update' && sessionMode === 'spreadsheet') {
        // Update Excel data when changes are made
        setExcelData({
          data: data.data,
          metadata: data.metadata
        });
      } else {
        // Handle chat messages
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response
        }]);
        
        // If Excel was modified, fetch the latest data
        if (data.excel_modified && sessionMode === 'spreadsheet') {
          fetchExcelData();
        }
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Connection error. Please try again.');
    };
    
    setSocket(ws);
    
    // Fetch initial Excel data
    if (sessionMode === 'spreadsheet') {
      fetchExcelData();
    }
    
    // Clean up WebSocket connection on component unmount
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [clientId, sessionMode]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('excelFlowUploads');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setUploadHistory(parsed);
        }
      }
    } catch (error) {
      console.warn('Failed to load upload history', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('excelFlowUploads', JSON.stringify(uploadHistory));
    } catch (error) {
      console.warn('Failed to persist upload history', error);
    }
  }, [uploadHistory]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('excelFlowModelParamsByModel');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          setModelParamsByModel(parsed);
        }
      }
    } catch (error) {
      console.warn('Failed to load model params', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('excelFlowModelParamsByModel', JSON.stringify(modelParamsByModel));
    } catch (error) {
      console.warn('Failed to persist model params', error);
    }
  }, [modelParamsByModel]);

  useEffect(() => {
    setModelParamsByModel((prev) => {
      if (prev[selectedModelId]) return prev;
      return {
        ...prev,
        [selectedModelId]: { ...defaultModelParams }
      };
    });
  }, [selectedModelId, defaultModelParams]);

  const addUploadHistory = (entry) => {
    setUploadHistory((prev) => {
      const next = [entry, ...prev.filter((item) => item.clientId !== entry.clientId)];
      return next.slice(0, 20);
    });
  };

  const removeUploadHistory = (clientIdToRemove) => {
    setUploadHistory((prev) => prev.filter((item) => item.clientId !== clientIdToRemove));
  };

  const clearUploadHistory = () => {
    setUploadHistory([]);
  };

  const openUploadSession = (entry) => {
    if (socket) {
      socket.close();
    }
    setSocket(null);
    setClientId(entry.clientId);
    setSessionMode(entry.type);
    setSelectedMode(entry.type);
    setMessages([]);
    setError(null);
    setExcelData(null);
    setPdfUrl(entry.fileUrl || null);
    setPdfFilename(entry.filename || '');
    setSelectionSummary(null);
  };

  const filteredUploads = uploadHistory
    .filter((entry) => {
      if (uploadFilterType !== 'all' && entry.type !== uploadFilterType) {
        return false;
      }
      if (!uploadSearch.trim()) return true;
      const keyword = uploadSearch.trim().toLowerCase();
      return `${entry.filename} ${entry.type}`.toLowerCase().includes(keyword);
    })
    .sort((a, b) => {
      if (uploadSort === 'name') {
        return (a.filename || '').localeCompare(b.filename || '');
      }
      if (uploadSort === 'oldest') {
        return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      }
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    });

  const fetchExcelData = async () => {
    try {
      const response = await fetch(`http://localhost:8000/excel/${clientId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch Excel data');
      }
      const data = await response.json();
      setExcelData(data);
    } catch (error) {
      console.error('Error fetching Excel data:', error);
      setError('Failed to load Excel data. Please try again.');
    }
  };

  const handleSpreadsheetUpload = async (file) => {
    console.log('Uploading file:', file.name);
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      console.log('Sending file to backend...');
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        let errorMessage = 'Failed to upload file. Please try again.';
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseError) {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        }
        console.error('Error response:', errorMessage);
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log('Upload successful, client ID:', data.client_id);
      setClientId(data.client_id);
      setSessionMode('spreadsheet');
      setSelectionSummary(null);
      addUploadHistory({
        clientId: data.client_id,
        filename: file.name,
        type: 'spreadsheet',
        uploadedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      setError(error?.message || 'Failed to upload file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePdfUpload = async (file) => {
    console.log('Uploading PDF:', file.name);
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:8000/upload/pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Failed to upload PDF. Please try again.';
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseError) {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        }
        console.error('Error response:', errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('PDF upload successful, client ID:', data.client_id);
      setClientId(data.client_id);
      setSessionMode('pdf');
      setSelectionSummary(null);
      setPdfFilename(data.filename || file.name);
      if (data.file_url) {
        setPdfUrl(`http://localhost:8000${data.file_url}`);
      }
      addUploadHistory({
        clientId: data.client_id,
        filename: data.filename || file.name,
        type: 'pdf',
        fileUrl: data.file_url ? `http://localhost:8000${data.file_url}` : null,
        uploadedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error uploading PDF:', error);
      setError(error?.message || 'Failed to upload PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = (message) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError('Connection lost. Please refresh the page.');
      return;
    }
    
    // Add user message to the chat
    setMessages(prev => [...prev, {
      role: 'user',
      content: message
    }]);
    
    const selectedModel = modelOptions.find((model) => model.id === selectedModelId) || modelOptions[0];

    const activeParams = modelParamsByModel[selectedModelId] || defaultModelParams;

    // Send message to the server
    socket.send(JSON.stringify({
      message,
      model_provider: selectedModel.provider,
      model_id: selectedModel.model,
      model_params: {
        temperature: activeParams.temperature,
        max_tokens: activeParams.maxTokens,
        top_p: activeParams.topP,
        presence_penalty: activeParams.presencePenalty,
        frequency_penalty: activeParams.frequencyPenalty
      }
    }));
  };

  const handleInsertReference = (text) => {
    setChatDraft((prev) => {
      if (!prev) return text;
      const separator = prev.endsWith('\n') ? '' : '\n';
      return `${prev}${separator}${text}`;
    });
    setFocusInputToken((value) => value + 1);
  };

  const buildReferenceText = (summary) => {
    if (!summary) return '';
    const rowsLabel = summary.minRow === summary.maxRow
      ? `${summary.minRow + 1}`
      : `${summary.minRow + 1}-${summary.maxRow + 1}`;
    const colsLabel = summary.minCol === summary.maxCol
      ? `${summary.startCell.replace(/\d+/g, '')}`
      : `${summary.startCell.replace(/\d+/g, '')}-${summary.endCell.replace(/\d+/g, '')}`;
    return `Reference range ${summary.rangeLabel} (rows ${rowsLabel}, columns ${colsLabel})`;
  };

  const handleReferenceSelection = () => {
    if (!selectionSummary) return;
    const text = buildReferenceText(selectionSummary);
    handleInsertReference(text);
  };

  const handleClearSelection = () => {
    setSelectionSummary(null);
    setClearSelectionToken((value) => value + 1);
  };

  const handleBackToUpload = () => {
    if (socket) {
      socket.close();
    }
    setSocket(null);
    setClientId(null);
    setExcelData(null);
    setMessages([]);
    setError(null);
    setSessionMode(null);
    setPdfUrl(null);
    setPdfFilename('');
    setSelectionSummary(null);
    setSelectedMode('spreadsheet');
  };

  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const formatUploadTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
  };

  const handleParamChange = (key, value, cast = 'float') => {
    const nextValue = cast === 'int' ? Number.parseInt(value, 10) : Number.parseFloat(value);
    setModelParamsByModel((prev) => {
      const targetModelId = settingsModelId || selectedModelId;
      const current = prev[targetModelId] || defaultModelParams;
      return {
        ...prev,
        [targetModelId]: {
          ...current,
          [key]: Number.isNaN(nextValue) ? current[key] : nextValue
        }
      };
    });
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleResize = (e) => {
      const container = document.querySelector('.main-content');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const nextWidth = ((e.clientX - rect.left) / rect.width) * 100;
      const clampedWidth = Math.min(80, Math.max(40, nextWidth));
      setLeftPanelWidth(clampedWidth);
    };

    const handleResizeEnd = () => setIsResizing(false);

    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', handleResizeEnd);
    window.addEventListener('mouseleave', handleResizeEnd);

    return () => {
      window.removeEventListener('mousemove', handleResize);
      window.removeEventListener('mouseup', handleResizeEnd);
      window.removeEventListener('mouseleave', handleResizeEnd);
    };
  }, [isResizing]);

  return (
    <div className={`app-container ${isResizing ? 'is-resizing' : ''}`}>
      {!clientId ? (
        <div className="upload-shell">
          <aside className="side-nav" aria-label="Upload modes">
            <h3>Upload Modes</h3>
            <div className="nav-items">
              {uploadModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={selectedMode === mode.id && !showUploadManager && !showSettings ? 'active' : ''}
                  onClick={() => setSelectedMode(mode.id)}
                >
                  <span>{mode.label}</span>
                  <small>{mode.hint}</small>
                  {mode.comingSoon && <em>Coming soon</em>}
                </button>
              ))}
            </div>
            <div className="upload-history">
              <div className="upload-history-header">
                <h4>Recent Uploads</h4>
                <div className="upload-history-actions">
                  <button
                    type="button"
                    className={showUploadManager ? 'active' : ''}
                    onClick={() => {
                      setShowUploadManager(true);
                      setShowSettings(false);
                    }}
                  >
                    Manage
                  </button>
                  {uploadHistory.length > 0 && (
                    <button type="button" onClick={clearUploadHistory}>
                      Clear All
                    </button>
                  )}
                </div>
              </div>
              {uploadHistory.length === 0 ? (
                <p>No uploads yet.</p>
              ) : (
                <ul className="upload-history-list">
                  {uploadHistory.map((entry) => (
                    <li key={entry.clientId}>
                      <div className="upload-history-main">
                        <span className={`upload-type ${entry.type}`}>{entry.type}</span>
                        <strong>{entry.filename}</strong>
                      </div>
                      <span className="upload-time">{formatUploadTime(entry.uploadedAt)}</span>
                      <div className="upload-actions">
                        <button type="button" onClick={() => openUploadSession(entry)}>
                          Open
                        </button>
                        <button type="button" onClick={() => removeUploadHistory(entry.clientId)}>
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              className={`settings-button ${showSettings ? 'active' : ''}`}
              onClick={() => {
                setShowSettings(true);
                setShowUploadManager(false);
                setSettingsModelId(null);
              }}
            >
              <FiSettings />
              Settings
            </button>
          </aside>
          <div className="upload-content">
            {showSettings ? (
              <div className="model-settings-panel">
                <div className="model-settings-header">
                  <div>
                    <h2>Model Settings</h2>
                    <p>Choose a model, then customize its parameters.</p>
                  </div>
                  <button type="button" onClick={() => setShowSettings(false)}>
                    Close
                  </button>
                </div>
                {!settingsModelId ? (
                  <div className="model-settings-chooser">
                    {modelOptions.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        className="model-option"
                        onClick={() => setSettingsModelId(model.id)}
                      >
                        <span>{model.label}</span>
                        <small>{model.provider}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="model-settings-controls">
                      <button
                        type="button"
                        className="model-settings-back"
                        onClick={() => setSettingsModelId(null)}
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        className="model-settings-reset"
                        onClick={() =>
                          setModelParamsByModel((prev) => ({
                            ...prev,
                            [settingsModelId]: { ...defaultModelParams }
                          }))
                        }
                      >
                        Reset to default
                      </button>
                    </div>
                    <div className="model-setting-row">
                      <label htmlFor="param-temperature">Temperature</label>
                      <input
                        id="param-temperature"
                        type="number"
                        min="0"
                        max="2"
                        step="0.1"
                        value={(modelParamsByModel[settingsModelId] || defaultModelParams).temperature}
                        onChange={(event) => handleParamChange('temperature', event.target.value, 'float')}
                      />
                    </div>
                    <div className="model-setting-row">
                      <label htmlFor="param-maxTokens">Max tokens</label>
                      <input
                        id="param-maxTokens"
                        type="number"
                        min="256"
                        max="8192"
                        step="128"
                        value={(modelParamsByModel[settingsModelId] || defaultModelParams).maxTokens}
                        onChange={(event) => handleParamChange('maxTokens', event.target.value, 'int')}
                      />
                    </div>
                    <div className="model-setting-row">
                      <label htmlFor="param-topP">Top P</label>
                      <input
                        id="param-topP"
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        value={(modelParamsByModel[settingsModelId] || defaultModelParams).topP}
                        onChange={(event) => handleParamChange('topP', event.target.value, 'float')}
                      />
                    </div>
                    <div className="model-setting-row">
                      <label htmlFor="param-presencePenalty">Presence penalty</label>
                      <input
                        id="param-presencePenalty"
                        type="number"
                        min="-2"
                        max="2"
                        step="0.1"
                        value={(modelParamsByModel[settingsModelId] || defaultModelParams).presencePenalty}
                        onChange={(event) => handleParamChange('presencePenalty', event.target.value, 'float')}
                      />
                    </div>
                    <div className="model-setting-row">
                      <label htmlFor="param-frequencyPenalty">Frequency penalty</label>
                      <input
                        id="param-frequencyPenalty"
                        type="number"
                        min="-2"
                        max="2"
                        step="0.1"
                        value={(modelParamsByModel[settingsModelId] || defaultModelParams).frequencyPenalty}
                        onChange={(event) => handleParamChange('frequencyPenalty', event.target.value, 'float')}
                      />
                    </div>
                    <p className="model-settings-note">
                      Penalties apply to OpenAI models. Bedrock uses temperature, top_p, and max_tokens.
                    </p>
                  </>
                )}
              </div>
            ) : showUploadManager ? (
              <div className="upload-manager">
              <div className="upload-manager-header">
                <div>
                  <h2>All Uploads</h2>
                  <p>Search and reopen any uploaded file.</p>
                </div>
                <button type="button" onClick={() => setShowUploadManager(false)}>
                  Close
                </button>
              </div>
              <div className="upload-manager-search">
                <input
                  type="text"
                  placeholder="Search by filename or type"
                  value={uploadSearch}
                  onChange={(event) => setUploadSearch(event.target.value)}
                />
              </div>
              <div className="upload-manager-controls">
                <div className="upload-filter">
                  <button
                    type="button"
                    className={uploadFilterType === 'all' ? 'active' : ''}
                    onClick={() => setUploadFilterType('all')}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={uploadFilterType === 'spreadsheet' ? 'active' : ''}
                    onClick={() => setUploadFilterType('spreadsheet')}
                  >
                    Spreadsheets
                  </button>
                  <button
                    type="button"
                    className={uploadFilterType === 'pdf' ? 'active' : ''}
                    onClick={() => setUploadFilterType('pdf')}
                  >
                    PDFs
                  </button>
                </div>
                <div className="upload-sort">
                  <label htmlFor="upload-sort">Sort</label>
                  <select
                    id="upload-sort"
                    value={uploadSort}
                    onChange={(event) => setUploadSort(event.target.value)}
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="name">A–Z</option>
                  </select>
                </div>
              </div>
              <div className="upload-manager-meta">
                Showing {filteredUploads.length} of {uploadHistory.length}
              </div>
              {filteredUploads.length === 0 ? (
                <div className="upload-manager-empty">No uploads match your search.</div>
              ) : (
                  <div className="upload-manager-list">
                    {filteredUploads.map((entry) => (
                      <div className="upload-manager-item" key={entry.clientId}>
                        <div className="upload-history-main">
                          <span className={`upload-type ${entry.type}`}>{entry.type}</span>
                          <strong>{entry.filename}</strong>
                        </div>
                        <span className="upload-time">{formatUploadTime(entry.uploadedAt)}</span>
                        <div className="upload-actions">
                          <button type="button" onClick={() => openUploadSession(entry)}>
                            Open
                          </button>
                          <button type="button" onClick={() => removeUploadHistory(entry.clientId)}>
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : selectedMode === 'spreadsheet' ? (
              <FileUpload onFileUpload={handleSpreadsheetUpload} loading={loading} error={error} />
            ) : selectedMode === 'pdf' ? (
              <PdfUpload onFileUpload={handlePdfUpload} loading={loading} error={error} />
            ) : (
              <div className="mode-placeholder">
                <h2>{uploadModes.find((mode) => mode.id === selectedMode)?.label}</h2>
                <p>This upload type is not available yet.</p>
                <p>Select Spreadsheet to continue.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="main-content">
          <div className="excel-container" style={{ flexBasis: `${leftPanelWidth}%` }}>
            {sessionMode === 'spreadsheet' ? (
              excelData ? (
                <ExcelViewer
                  data={excelData.data}
                  metadata={excelData.metadata}
                  onBack={handleBackToUpload}
                  onSelectionSummaryChange={setSelectionSummary}
                  clearSelectionToken={clearSelectionToken}
                />
              ) : (
                <div className="loading">Loading Excel data...</div>
              )
            ) : (
              <PdfViewer
                pdfUrl={pdfUrl}
                filename={pdfFilename}
                onBack={handleBackToUpload}
              />
            )}
          </div>
          <div
            className="resize-handle"
            role="separator"
            aria-label="Resize panels"
            onMouseDown={handleResizeStart}
          />
          <div className="chat-sidebar">
            <ChatInterface 
              messages={messages} 
              onSendMessage={sendMessage}
              modelOptions={modelOptions}
              selectedModelId={selectedModelId}
              onModelChange={setSelectedModelId}
              inputValue={chatDraft}
              onInputChange={setChatDraft}
              focusToken={focusInputToken}
              onClearMessages={() => setMessages([])}
              title={sessionMode === 'pdf' ? 'PDF Analyst Chat' : 'Excel Agent Chat'}
              placeholder={sessionMode === 'pdf' ? 'Ask about your PDF...' : 'Ask about your Excel data...'}
              emptyStateText={sessionMode === 'pdf'
                ? 'Start chatting with the PDF analyst'
                : 'Start chatting with the Excel Agent'
              }
              selectionSummary={sessionMode === 'spreadsheet' ? selectionSummary : null}
              onReferenceSelection={handleReferenceSelection}
              onClearSelection={handleClearSelection}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
