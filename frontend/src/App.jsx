import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import ExcelViewer from './components/ExcelViewer';
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
      comingSoon: true,
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
    if (!clientId) return;

    // For WebSocket connections, we still need to use the full URL
    const ws = new WebSocket(`ws://localhost:8000/ws/${clientId}`);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'excel_update') {
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
        if (data.excel_modified) {
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
    fetchExcelData();
    
    // Clean up WebSocket connection on component unmount
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [clientId]);

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

  const handleFileUpload = async (file) => {
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
    } catch (error) {
      console.error('Error uploading file:', error);
      setError(error?.message || 'Failed to upload file. Please try again.');
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

    // Send message to the server
    socket.send(JSON.stringify({
      message,
      model_provider: selectedModel.provider,
      model_id: selectedModel.model
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
    setSelectedMode('spreadsheet');
  };

  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
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
                  className={selectedMode === mode.id ? 'active' : ''}
                  onClick={() => setSelectedMode(mode.id)}
                >
                  <span>{mode.label}</span>
                  <small>{mode.hint}</small>
                  {mode.comingSoon && <em>Coming soon</em>}
                </button>
              ))}
            </div>
          </aside>
          <div className="upload-content">
            {selectedMode === 'spreadsheet' ? (
              <FileUpload onFileUpload={handleFileUpload} loading={loading} error={error} />
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
            {excelData ? (
              <ExcelViewer
                data={excelData.data}
                metadata={excelData.metadata}
                onBack={handleBackToUpload}
                onSelectionSummaryChange={setSelectionSummary}
                clearSelectionToken={clearSelectionToken}
              />
            ) : (
              <div className="loading">Loading Excel data...</div>
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
              selectionSummary={selectionSummary}
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
