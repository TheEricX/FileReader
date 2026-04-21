import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { FiSettings } from 'react-icons/fi';
import FileUpload from './components/FileUpload';
import PdfUpload from './components/PdfUpload';
import DocUpload from './components/DocUpload';
import ExcelViewer from './components/ExcelViewer';
import PdfViewer from './components/PdfViewer';
import DocViewer from './components/DocViewer';
import ChatInterface from './components/ChatInterface';
import ModelSettingsPanel from './components/ModelSettingsPanel';
import './App.css';

const BASE_MODEL_OPTIONS = [
  {
    id: 'openai:gpt-4o',
    label: 'OpenAI GPT-4o',
    provider: 'openai',
    model: 'gpt-4o',
  },
  {
    id: 'openai:gpt-4.1',
    label: 'OpenAI GPT-4.1',
    provider: 'openai',
    model: 'gpt-4.1',
  },
  {
    id: 'openai:gpt-4.1-mini',
    label: 'OpenAI GPT-4.1 Mini',
    provider: 'openai',
    model: 'gpt-4.1-mini',
  },
  {
    id: 'openai:gpt-4o-mini',
    label: 'OpenAI GPT-4o Mini',
    provider: 'openai',
    model: 'gpt-4o-mini',
  },
  {
    id: 'bedrock:us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    label: 'AWS Bedrock Claude Sonnet 4.5',
    provider: 'bedrock',
    model: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  },
  {
    id: 'openai:custom',
    label: 'Custom OpenAI Model',
    provider: 'openai',
    custom: true,
    customKey: 'openai',
  },
  {
    id: 'bedrock:custom',
    label: 'Custom Bedrock Model',
    provider: 'bedrock',
    custom: true,
    customKey: 'bedrock',
  },
];

const BASE_GEMINI_MODEL_OPTIONS = [
  {
    id: 'gemini:gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
  },
  {
    id: 'gemini:gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'gemini',
    model: 'gemini-2.5-pro',
  },
  {
    id: 'gemini:gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    provider: 'gemini',
    model: 'gemini-2.0-flash',
  },
  {
    id: 'gemini:custom',
    label: 'Custom Gemini Model',
    provider: 'gemini',
    custom: true,
    customKey: 'gemini',
  },
];

function App() {
  const GEMINI_MAX_IMAGE_COUNT = 4;
  const GEMINI_MAX_IMAGE_SIZE_MB = 5;
  const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  const configuredWsBase = (import.meta.env.VITE_WS_BASE_URL || '').trim().replace(/\/+$/, '');
  const defaultWsBase = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
  const wsBaseFromApi = (() => {
    if (!configuredApiBase) {
      return defaultWsBase;
    }
    try {
      const apiUrlValue = new URL(configuredApiBase, window.location.origin);
      apiUrlValue.protocol = apiUrlValue.protocol === 'https:' ? 'wss:' : 'ws:';
      apiUrlValue.pathname = '';
      apiUrlValue.search = '';
      apiUrlValue.hash = '';
      return apiUrlValue.toString().replace(/\/+$/, '');
    } catch (error) {
      console.warn('Invalid VITE_API_BASE_URL, fallback to current host WebSocket base.', error);
      return defaultWsBase;
    }
  })();
  const apiBase = configuredApiBase || '/api';
  const wsBase = configuredWsBase || wsBaseFromApi;
  const apiUrl = useCallback((path) => `${apiBase}${path}`, [apiBase]);
  const wsUrl = useCallback((path) => `${wsBase}${path}`, [wsBase]);
  const formatCustomModelLabel = (baseLabel, modelId) => (
    modelId ? `${baseLabel}: ${modelId}` : baseLabel
  );
  const readErrorMessage = async (response, fallbackMessage) => {
    const rawText = await response.text();
    if (!rawText) {
      return fallbackMessage;
    }

    try {
      const errorData = JSON.parse(rawText);
      if (errorData && typeof errorData.error === 'string' && errorData.error.trim()) {
        return errorData.error;
      }
    } catch (parseError) {
      // Fall back to plain text responses.
    }

    return rawText;
  };
  const getRequestErrorMessage = (error, fallbackMessage) => {
    const message = error?.message || '';
    if (
      error instanceof TypeError
      || /failed to fetch/i.test(message)
      || /networkerror/i.test(message)
      || /load failed/i.test(message)
    ) {
      return 'Cannot reach the backend. Make sure the FastAPI server is running on http://localhost:8000.';
    }
    return message || fallbackMessage;
  };
  const resolveFileUrl = useCallback((path) => {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    return apiUrl(path);
  }, [apiUrl]);
  const [clientId, setClientId] = useState(null);
  const [excelData, setExcelData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [customModelIds, setCustomModelIds] = useState(() => {
    try {
      const stored = localStorage.getItem('excelFlowCustomModelIds');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          return {
            openai: typeof parsed.openai === 'string' ? parsed.openai : '',
            bedrock: typeof parsed.bedrock === 'string' ? parsed.bedrock : '',
            gemini: typeof parsed.gemini === 'string' ? parsed.gemini : '',
          };
        }
      }
    } catch (error) {
      console.warn('Failed to load custom model ids', error);
    }
    return {
      openai: '',
      bedrock: '',
      gemini: '',
    };
  });
  const modelOptions = useMemo(
    () => BASE_MODEL_OPTIONS.map((model) => (
      model.custom
        ? {
            ...model,
            label: formatCustomModelLabel(model.label, customModelIds[model.customKey]),
          }
        : model
    )),
    [customModelIds]
  );
  const geminiModelOptions = useMemo(
    () => BASE_GEMINI_MODEL_OPTIONS.map((model) => (
      model.custom
        ? {
            ...model,
            label: formatCustomModelLabel(model.label, customModelIds[model.customKey]),
          }
        : model
    )),
    [customModelIds]
  );
  const [selectedModelId, setSelectedModelId] = useState(() => {
    try {
      const stored = localStorage.getItem('excelFlowSelectedModelId');
      if (stored && BASE_MODEL_OPTIONS.some((model) => model.id === stored)) {
        return stored;
      }
    } catch (error) {
      console.warn('Failed to load selected model', error);
    }
    return 'bedrock:us.anthropic.claude-sonnet-4-5-20250929-v1:0';
  });
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [geminiClientId, setGeminiClientId] = useState(null);
  const [geminiSessionMode, setGeminiSessionMode] = useState(null);
  const [geminiSocket, setGeminiSocket] = useState(null);
  const [geminiMessages, setGeminiMessages] = useState([]);
  const [geminiSelectedModelId, setGeminiSelectedModelId] = useState(() => {
    try {
      const stored = localStorage.getItem('excelFlowGeminiSelectedModelId');
      if (stored && BASE_GEMINI_MODEL_OPTIONS.some((model) => model.id === stored)) {
        return stored;
      }
    } catch (error) {
      console.warn('Failed to load selected Gemini model', error);
    }
    return BASE_GEMINI_MODEL_OPTIONS[0].id;
  });
  const [geminiPdfUrl, setGeminiPdfUrl] = useState(null);
  const [geminiFilename, setGeminiFilename] = useState('');
  const [geminiDocText, setGeminiDocText] = useState('');
  const [geminiExcelData, setGeminiExcelData] = useState(null);
  const [geminiChatDraft, setGeminiChatDraft] = useState('');
  const [geminiIsWaiting, setGeminiIsWaiting] = useState(false);
  const [geminiSelectedMode, setGeminiSelectedMode] = useState('spreadsheet');
  const [geminiRequestCounter, setGeminiRequestCounter] = useState(0);
  const [geminiImageAttachments, setGeminiImageAttachments] = useState([]);
  const geminiCanceledRequestIdsRef = useRef(new Set());
  const geminiPendingRequestIdRef = useRef(null);
  const geminiLatestRequestIdRef = useRef(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(68);
  const [isResizing, setIsResizing] = useState(false);
  const [selectedMode, setSelectedMode] = useState('spreadsheet');
  const [sessionMode, setSessionMode] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfFilename, setPdfFilename] = useState('');
  const [docText, setDocText] = useState('');
  const [uploadHistory, setUploadHistory] = useState([]);
  const [showHubUploadManager, setShowHubUploadManager] = useState(false);
  const [showUploadManager, setShowUploadManager] = useState(false);
  const [uploadSearch, setUploadSearch] = useState('');
  const [uploadFilterType, setUploadFilterType] = useState('all');
  const [uploadSort, setUploadSort] = useState('newest');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsModelId, setSettingsModelId] = useState(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const ignoreNextResponseRef = useRef(false);
  const [requestCounter, setRequestCounter] = useState(0);
  const canceledRequestIdsRef = useRef(new Set());
  const pendingRequestIdRef = useRef(null);
  const latestRequestIdRef = useRef(null);
  const [useBedrockAttachment, setUseBedrockAttachment] = useState(false);
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
      hint: 'Word documents (.docx)',
    },
  ];

  const loadUploads = useCallback(async (workspace = 'all') => {
    try {
      const response = await fetch(apiUrl(`/uploads?workspace=${workspace}`));
      if (!response.ok) {
        throw new Error('Failed to load upload history');
      }
      const data = await response.json();
      const uploads = Array.isArray(data.uploads) ? data.uploads : [];
      setUploadHistory(uploads.map((entry) => ({
        clientId: entry.client_id,
        filename: entry.filename || 'Untitled',
        type: entry.type,
        fileUrl: resolveFileUrl(entry.file_url),
        uploadedAt: entry.uploaded_at,
        workspace: entry.workspace || 'default'
      })));
    } catch (error) {
      console.warn('Failed to load upload history', error);
    }
  }, [apiUrl, resolveFileUrl]);

  useEffect(() => {
    loadUploads('all');
  }, [loadUploads]);

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
      const params = new URLSearchParams(window.location.search);
      if (params.get('bedrockAttachment') === '1') {
        setUseBedrockAttachment(true);
      }
    } catch (error) {
      console.warn('Failed to read bedrockAttachment flag', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('excelFlowSelectedModelId', selectedModelId);
    } catch (error) {
      console.warn('Failed to persist selected model', error);
    }
  }, [selectedModelId]);

  useEffect(() => {
    try {
      localStorage.setItem('excelFlowGeminiSelectedModelId', geminiSelectedModelId);
    } catch (error) {
      console.warn('Failed to persist selected Gemini model', error);
    }
  }, [geminiSelectedModelId]);

  useEffect(() => {
    try {
      localStorage.setItem('excelFlowCustomModelIds', JSON.stringify(customModelIds));
    } catch (error) {
      console.warn('Failed to persist custom model ids', error);
    }
  }, [customModelIds]);

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

  const fetchSessionMessages = async (clientIdToLoad) => {
    try {
      const response = await fetch(apiUrl(`/sessions/${clientIdToLoad}`));
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      if (!Array.isArray(data.messages)) return [];
      return data.messages.filter((msg) => msg.role !== 'system');
    } catch (error) {
      console.warn('Failed to load session messages', error);
      return [];
    }
  };

  const fetchGeminiSessionMessages = async (clientIdToLoad) => {
    try {
      const response = await fetch(apiUrl(`/sessions/gemini/${clientIdToLoad}`));
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      if (!Array.isArray(data.messages)) return [];
      return data.messages.filter((msg) => msg.role !== 'system');
    } catch (error) {
      console.warn('Failed to load Gemini session messages', error);
      return [];
    }
  };

  const removeUploadHistory = async (clientIdToRemove) => {
    try {
      const response = await fetch(apiUrl(`/uploads/${clientIdToRemove}`), {
        method: 'DELETE'
      });
      if (!response.ok && response.status !== 404) {
        const errorMessage = await readErrorMessage(response, 'Failed to delete upload.');
        throw new Error(errorMessage);
      }
      setUploadHistory((prev) => prev.filter((item) => item.clientId !== clientIdToRemove));
      if (!activeWorkspace) {
        await loadUploads('all');
      }
    } catch (error) {
      console.error('Error deleting upload:', error);
      setError(error?.message || 'Failed to delete upload. Please try again.');
    }
  };


  const openUploadSession = async (entry) => {
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
    setDocText('');
    setSelectionSummary(null);
    const history = await fetchSessionMessages(entry.clientId);
    if (history.length > 0) {
      setMessages(history);
    }
    if (entry.type === 'doc') {
      try {
        const response = await fetch(apiUrl(`/doc/${entry.clientId}/text`));
        if (response.ok) {
          const data = await response.json();
          setDocText(data.text || '');
        }
      } catch (error) {
        console.warn('Failed to load DOCX text', error);
      }
    }
  };

  const openGeminiUploadSession = async (entry) => {
    if (geminiSocket) {
      geminiSocket.close();
    }
    setGeminiSocket(null);
    setGeminiClientId(entry.clientId);
    setGeminiSessionMode(entry.type);
    setGeminiSelectedMode(entry.type);
    setGeminiMessages([]);
    setGeminiExcelData(null);
    setGeminiPdfUrl(entry.fileUrl || null);
    setGeminiFilename(entry.filename || '');
    setGeminiDocText('');
    setGeminiImageAttachments([]);
    const history = await fetchGeminiSessionMessages(entry.clientId);
    if (history.length > 0) {
      setGeminiMessages(history);
    }
    if (entry.type === 'doc') {
      try {
        const response = await fetch(apiUrl(`/doc/${entry.clientId}/text`));
        if (response.ok) {
          const data = await response.json();
          setGeminiDocText(data.text || '');
        }
      } catch (error) {
        console.warn('Failed to load DOCX text', error);
      }
    }
  };

  const filteredUploads = uploadHistory
    .filter((entry) => {
      if (uploadFilterType !== 'all' && entry.type !== uploadFilterType) {
        return false;
      }
      if (!uploadSearch.trim()) return true;
      const keyword = uploadSearch.trim().toLowerCase();
      return `${entry.filename} ${entry.type} ${entry.workspace || ''}`.toLowerCase().includes(keyword);
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
  const recentUploads = uploadHistory.slice(0, 2);

  const fetchExcelData = useCallback(async () => {
    if (!clientId) return;
    try {
      const response = await fetch(apiUrl(`/excel/${clientId}`));
      if (!response.ok) {
        throw new Error('Failed to fetch Excel data');
      }
      const data = await response.json();
      setExcelData(data);
    } catch (error) {
      console.error('Error fetching Excel data:', error);
      setError('Failed to load Excel data. Please try again.');
    }
  }, [apiUrl, clientId]);

  const fetchGeminiExcelData = useCallback(async (clientIdToLoad) => {
    try {
      const response = await fetch(apiUrl(`/excel/${clientIdToLoad}`));
      if (!response.ok) {
        throw new Error('Failed to fetch Excel data');
      }
      const data = await response.json();
      setGeminiExcelData(data);
    } catch (error) {
      console.error('Error fetching Gemini Excel data:', error);
      setError('Failed to load Excel data. Please try again.');
    }
  }, [apiUrl]);

  // Initialize WebSocket connection when clientId is set
  useEffect(() => {
    if (!clientId || !sessionMode) return;

    const socketUrl = sessionMode === 'pdf'
      ? wsUrl(`/ws/pdf/${clientId}`)
      : sessionMode === 'doc'
        ? wsUrl(`/ws/doc/${clientId}`)
        : wsUrl(`/ws/${clientId}`);
    const ws = new WebSocket(socketUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'canceled') {
        setIsWaiting(false);
        return;
      }

      if (data.request_id
        && latestRequestIdRef.current
        && data.request_id !== latestRequestIdRef.current
        && !canceledRequestIdsRef.current.has(data.request_id)) {
        return;
      }

      if (data.request_id && canceledRequestIdsRef.current.has(data.request_id)) {
        canceledRequestIdsRef.current.delete(data.request_id);
        setIsWaiting(false);
        return;
      }

      if (data.type === 'excel_update' && sessionMode === 'spreadsheet') {
        setExcelData({
          data: data.data,
          metadata: data.metadata
        });
      } else if (!ignoreNextResponseRef.current) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response
        }]);
        setIsWaiting(false);
        if (data.request_id && pendingRequestIdRef.current === data.request_id) {
          pendingRequestIdRef.current = null;
        }

        if (data.excel_modified && sessionMode === 'spreadsheet') {
          fetchExcelData();
        }
      }
      if (ignoreNextResponseRef.current) {
        ignoreNextResponseRef.current = false;
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsWaiting(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Connection error. Please try again.');
      setIsWaiting(false);
    };

    setSocket(ws);

    if (sessionMode === 'spreadsheet') {
      fetchExcelData();
    }

    return () => {
      ws.close();
    };
  }, [clientId, fetchExcelData, sessionMode, wsUrl]);

  useEffect(() => {
    if (!geminiClientId || !geminiSessionMode) return;

    const ws = new WebSocket(wsUrl(`/ws/gemini/${geminiClientId}`));

    ws.onopen = () => {
      console.log('Gemini WebSocket connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'canceled') {
        setGeminiIsWaiting(false);
        return;
      }

      if (data.request_id
        && geminiLatestRequestIdRef.current
        && data.request_id !== geminiLatestRequestIdRef.current
        && !geminiCanceledRequestIdsRef.current.has(data.request_id)) {
        return;
      }

      if (data.request_id && geminiCanceledRequestIdsRef.current.has(data.request_id)) {
        geminiCanceledRequestIdsRef.current.delete(data.request_id);
        setGeminiIsWaiting(false);
        return;
      }

      setGeminiMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response
      }]);
      setGeminiIsWaiting(false);
      if (data.request_id && geminiPendingRequestIdRef.current === data.request_id) {
        geminiPendingRequestIdRef.current = null;
      }
    };

    ws.onclose = () => {
      console.log('Gemini WebSocket disconnected');
      setGeminiIsWaiting(false);
    };

    ws.onerror = (error) => {
      console.error('Gemini WebSocket error:', error);
      setError('Gemini connection error. Please try again.');
      setGeminiIsWaiting(false);
    };

    setGeminiSocket(ws);

    if (geminiSessionMode === 'spreadsheet') {
      fetchGeminiExcelData(geminiClientId);
    }

    return () => {
      ws.close();
    };
  }, [fetchGeminiExcelData, geminiClientId, geminiSessionMode, wsUrl]);

  const readImageAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image.'));
    reader.readAsDataURL(file);
  });

  const handleGeminiAddAttachments = async (files) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (incoming.length === 0) return;
    const remainingSlots = Math.max(0, GEMINI_MAX_IMAGE_COUNT - geminiImageAttachments.length);
    if (remainingSlots === 0) {
      setError(`You can attach up to ${GEMINI_MAX_IMAGE_COUNT} images.`);
      return;
    }
    try {
      const accepted = incoming
        .filter((file) => {
          if (file.size <= GEMINI_MAX_IMAGE_SIZE_MB * 1024 * 1024) {
            return true;
          }
          setError(`Image "${file.name}" exceeds ${GEMINI_MAX_IMAGE_SIZE_MB}MB.`);
          return false;
        })
        .slice(0, remainingSlots);
      const processed = await Promise.all(
        accepted.map(async (file, index) => {
          const dataUrl = await readImageAsDataUrl(file);
          const base64 = typeof dataUrl === 'string' && dataUrl.includes(',')
            ? dataUrl.split(',')[1]
            : '';
          return {
            id: `${Date.now()}_${index}_${file.name}`,
            name: file.name,
            size: file.size,
            mimeType: file.type,
            previewUrl: dataUrl,
            base64
          };
        })
      );
      setGeminiImageAttachments((prev) => [...prev, ...processed]);
    } catch (error) {
      console.error('Failed to add image attachments', error);
      setError('Failed to load one of the images.');
    }
  };

  const handleGeminiRemoveAttachment = (id) => {
    setGeminiImageAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSpreadsheetUpload = async (file) => {
    console.log('Uploading file:', file.name);
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspace', 'default');
      
      console.log('Sending file to backend...');
      const response = await fetch(apiUrl('/upload'), {
        method: 'POST',
        body: formData,
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorMessage = await readErrorMessage(response, 'Failed to upload file. Please try again.');
        console.error('Error response:', errorMessage);
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log('Upload successful, client ID:', data.client_id);
      setClientId(data.client_id);
      setSessionMode('spreadsheet');
      setSelectionSummary(null);
      await loadUploads('default');
    } catch (error) {
      console.error('Error uploading file:', error);
      setError(getRequestErrorMessage(error, 'Failed to upload file. Please try again.'));
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
      formData.append('workspace', 'default');

      const response = await fetch(apiUrl('/upload/pdf'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorMessage = await readErrorMessage(response, 'Failed to upload PDF. Please try again.');
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
        setPdfUrl(resolveFileUrl(data.file_url));
      }
      await loadUploads('default');
    } catch (error) {
      console.error('Error uploading PDF:', error);
      setError(getRequestErrorMessage(error, 'Failed to upload PDF. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleDocUpload = async (file) => {
    console.log('Uploading DOCX:', file.name);
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspace', 'default');

      const response = await fetch(apiUrl('/upload/doc'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorMessage = await readErrorMessage(response, 'Failed to upload DOCX. Please try again.');
        console.error('Error response:', errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('DOCX upload successful, client ID:', data.client_id);
      setClientId(data.client_id);
      setSessionMode('doc');
      setSelectionSummary(null);
      setPdfFilename(data.filename || file.name);
      setDocText(data.text || '');
      await loadUploads('default');
    } catch (error) {
      console.error('Error uploading DOCX:', error);
      setError(getRequestErrorMessage(error, 'Failed to upload DOCX. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGeminiSpreadsheetUpload = async (file) => {
    console.log('Uploading file for Gemini:', file.name);
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspace', 'gemini');

      const response = await fetch(apiUrl('/upload'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorMessage = await readErrorMessage(response, 'Failed to upload file. Please try again.');
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setGeminiClientId(data.client_id);
      setGeminiSessionMode('spreadsheet');
      setGeminiExcelData(null);
      await loadUploads('gemini');
    } catch (error) {
      console.error('Error uploading Gemini file:', error);
      setError(getRequestErrorMessage(error, 'Failed to upload file. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGeminiPdfUpload = async (file) => {
    console.log('Uploading PDF for Gemini:', file.name);
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspace', 'gemini');

      const response = await fetch(apiUrl('/upload/pdf'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorMessage = await readErrorMessage(response, 'Failed to upload PDF. Please try again.');
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setGeminiClientId(data.client_id);
      setGeminiSessionMode('pdf');
      setGeminiFilename(data.filename || file.name);
      setGeminiPdfUrl(resolveFileUrl(data.file_url));
      await loadUploads('gemini');
    } catch (error) {
      console.error('Error uploading Gemini PDF:', error);
      setError(getRequestErrorMessage(error, 'Failed to upload PDF. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGeminiDocUpload = async (file) => {
    console.log('Uploading DOCX for Gemini:', file.name);
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspace', 'gemini');

      const response = await fetch(apiUrl('/upload/doc'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorMessage = await readErrorMessage(response, 'Failed to upload DOCX. Please try again.');
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setGeminiClientId(data.client_id);
      setGeminiSessionMode('doc');
      setGeminiDocText(data.text || '');
      setGeminiFilename(data.filename || file.name);
      await loadUploads('gemini');
    } catch (error) {
      console.error('Error uploading Gemini DOCX:', error);
      setError(getRequestErrorMessage(error, 'Failed to upload DOCX. Please try again.'));
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
    
    const selectedModel = getResolvedModelConfig(selectedModelId, modelOptions);
    if (!selectedModel?.model) {
      setError(`Enter a custom ${selectedModel?.provider || 'model'} model ID in Settings before sending a message.`);
      return;
    }

    const activeParams = modelParamsByModel[selectedModelId] || defaultModelParams;

    const useAttachment = sessionMode === 'spreadsheet'
      && selectedModel.provider === 'bedrock'
      && useBedrockAttachment;

    // Send message to the server
    const modelParams = {
      temperature: activeParams.temperature,
      max_tokens: activeParams.maxTokens,
      presence_penalty: activeParams.presencePenalty,
      frequency_penalty: activeParams.frequencyPenalty
    };
    if (useAttachment) {
      modelParams.bedrock_use_attachment = true;
    }
    if (selectedModel.provider !== 'bedrock') {
      modelParams.top_p = activeParams.topP;
    }

    const nextRequestId = `req_${Date.now()}_${requestCounter}`;
    setRequestCounter((prev) => prev + 1);
    pendingRequestIdRef.current = nextRequestId;
    latestRequestIdRef.current = nextRequestId;

    socket.send(JSON.stringify({
      message,
      request_id: nextRequestId,
      model_provider: selectedModel.provider,
      model_id: selectedModel.model,
      model_params: modelParams
    }));
    setIsWaiting(true);
  };

  const sendGeminiMessage = (message) => {
    if (!geminiSocket || geminiSocket.readyState !== WebSocket.OPEN) {
      setError('Gemini connection lost. Please refresh the page.');
      return;
    }

    const hasImages = geminiImageAttachments.length > 0;
    const trimmedMessage = message.trim();
    const finalMessage = trimmedMessage || (hasImages ? 'Describe the image.' : '');
    if (!finalMessage && !hasImages) return;

    const messageAttachments = geminiImageAttachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      previewUrl: attachment.previewUrl
    }));
    setGeminiMessages(prev => [...prev, {
      role: 'user',
      content: finalMessage,
      attachments: messageAttachments
    }]);

    const selectedModel = getResolvedModelConfig(geminiSelectedModelId, geminiModelOptions);
    if (!selectedModel?.model) {
      setError('Enter a custom Gemini model ID in Settings before sending a message.');
      return;
    }

    const nextRequestId = `gemini_req_${Date.now()}_${geminiRequestCounter}`;
    setGeminiRequestCounter((prev) => prev + 1);
    geminiPendingRequestIdRef.current = nextRequestId;
    geminiLatestRequestIdRef.current = nextRequestId;

    geminiSocket.send(JSON.stringify({
      message: finalMessage,
      request_id: nextRequestId,
      model_provider: selectedModel.provider,
      model_id: selectedModel.model,
      model_params: {},
      image_attachments: geminiImageAttachments.map((attachment) => ({
        mime_type: attachment.mimeType,
        data: attachment.base64
      }))
    }));
    setGeminiIsWaiting(true);
    if (hasImages) {
      setGeminiImageAttachments([]);
    }
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
    setDocText('');
    setSelectionSummary(null);
    setSelectedMode('spreadsheet');
  };

  const handleGeminiBackToUpload = () => {
    if (geminiSocket) {
      geminiSocket.close();
    }
    setGeminiSocket(null);
    setGeminiClientId(null);
    setGeminiExcelData(null);
    setGeminiMessages([]);
    setGeminiSessionMode(null);
    setGeminiPdfUrl(null);
    setGeminiFilename('');
    setGeminiDocText('');
    setGeminiSelectedMode('spreadsheet');
    setGeminiImageAttachments([]);
  };

  const resetWorkspaceSessions = () => {
    if (socket) {
      socket.close();
    }
    if (geminiSocket) {
      geminiSocket.close();
    }

    setSocket(null);
    setClientId(null);
    setExcelData(null);
    setMessages([]);
    setSessionMode(null);
    setPdfUrl(null);
    setPdfFilename('');
    setDocText('');
    setSelectionSummary(null);
    setChatDraft('');
    setShowUploadManager(false);
    setShowSettings(false);
    setSelectedMode('spreadsheet');

    setGeminiSocket(null);
    setGeminiClientId(null);
    setGeminiExcelData(null);
    setGeminiMessages([]);
    setGeminiSessionMode(null);
    setGeminiPdfUrl(null);
    setGeminiFilename('');
    setGeminiDocText('');
    setGeminiChatDraft('');
    setGeminiSelectedMode('spreadsheet');
    setGeminiImageAttachments([]);
  };

  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleEnterWorkspace = async (workspace) => {
    resetWorkspaceSessions();
    setActiveWorkspace(workspace);
    setShowHubUploadManager(false);
    setError(null);
    await loadUploads(workspace);
  };

  const handleBackToHome = async () => {
    resetWorkspaceSessions();
    setActiveWorkspace(null);
    setShowHubUploadManager(false);
    setError(null);
    await loadUploads('all');
  };

  const openUploadFromHub = async (entry) => {
    if (entry.workspace === 'gemini') {
      setActiveWorkspace('gemini');
      setShowHubUploadManager(false);
      await loadUploads('gemini');
      await openGeminiUploadSession(entry);
      return;
    }
    setActiveWorkspace('default');
    setShowHubUploadManager(false);
    await loadUploads('default');
    await openUploadSession(entry);
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
      const targetModelId = settingsModelId || (activeWorkspace === 'gemini' ? geminiSelectedModelId : selectedModelId);
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

  const getResolvedModelConfig = (selectedId, options) => {
    const selectedOption = options.find((model) => model.id === selectedId) || options[0];
    if (!selectedOption) return null;
    if (!selectedOption.custom) return selectedOption;
    return {
      ...selectedOption,
      model: (customModelIds[selectedOption.customKey] || '').trim(),
    };
  };

  const handleCustomModelIdChange = (providerKey, value) => {
    setCustomModelIds((prev) => ({
      ...prev,
      [providerKey]: value,
    }));
  };

  const groupedModelOptions = useMemo(() => {
    const groups = [
      {
        id: 'openai',
        title: 'OpenAI',
        models: modelOptions.filter((model) => model.provider === 'openai' && !model.custom),
      },
      {
        id: 'bedrock',
        title: 'Bedrock',
        models: modelOptions.filter((model) => model.provider === 'bedrock' && !model.custom),
      },
      {
        id: 'custom',
        title: 'Custom',
        models: modelOptions.filter((model) => model.custom),
      },
    ];
    return groups.filter((group) => group.models.length > 0);
  }, [modelOptions]);

  const groupedGeminiModelOptions = useMemo(() => {
    const groups = [
      {
        id: 'gemini',
        title: 'Gemini',
        models: geminiModelOptions.filter((model) => model.provider === 'gemini' && !model.custom),
      },
      {
        id: 'custom',
        title: 'Custom',
        models: geminiModelOptions.filter((model) => model.custom),
      },
    ];
    return groups.filter((group) => group.models.length > 0);
  }, [geminiModelOptions]);

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
      {!activeWorkspace ? (
        showHubUploadManager ? (
          <section className="hub-uploads-page" aria-label="All uploads">
            <div className="hub-uploads-header">
              <div className="hub-uploads-topbar">
                <button
                  type="button"
                  className="workspace-hub-button"
                  onClick={() => setShowHubUploadManager(false)}
                >
                  Back to Workspace Selection
                </button>
                <span className="hub-uploads-count">{uploadHistory.length} files</span>
              </div>
              <div className="hub-uploads-title">
                <h1>All Uploads</h1>
                <p>View and reopen uploads across all workspaces.</p>
              </div>
            </div>
            <div className="hub-uploads-panel">
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
                  <button
                    type="button"
                    className={uploadFilterType === 'doc' ? 'active' : ''}
                    onClick={() => setUploadFilterType('doc')}
                  >
                    DOCX
                  </button>
                </div>
                <div className="upload-sort">
                  <label htmlFor="upload-sort-home">Sort</label>
                  <select
                    id="upload-sort-home"
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
                {uploadHistory.length} uploads total. Showing {filteredUploads.length}.
              </div>
              {filteredUploads.length === 0 ? (
                <div className="upload-manager-empty">No uploads match your search.</div>
              ) : (
                <div className="upload-manager-list">
                  {filteredUploads.map((entry) => (
                    <div className="upload-manager-item hub-upload-item" key={entry.clientId}>
                      <div className="hub-upload-main">
                        <strong className="hub-upload-name">{entry.filename}</strong>
                        <div className="hub-upload-meta">
                          <span className={`upload-type ${entry.type}`}>{entry.type}</span>
                          <span className={`upload-type workspace ${entry.workspace}`}>{entry.workspace}</span>
                          <span className="upload-time">{formatUploadTime(entry.uploadedAt)}</span>
                        </div>
                      </div>
                      <div className="upload-actions hub-upload-actions">
                        <button type="button" className="upload-open" onClick={() => openUploadFromHub(entry)}>
                          Open
                        </button>
                        <button type="button" className="upload-remove" onClick={() => removeUploadHistory(entry.clientId)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="workspace-hub" aria-label="Workspace selection">
            <div className="workspace-hub-header">
              <h1>Choose Your Workspace</h1>
              <p>Select an environment first, then upload files and start analysis inside it.</p>
            </div>
            <div className="workspace-grid">
              <button
                type="button"
                className="workspace-card"
                onClick={() => handleEnterWorkspace('default')}
              >
                <span className="workspace-card-kicker">Standard</span>
                <h2>ExcelFlow</h2>
                <p>OpenAI and Bedrock workspace for spreadsheet editing, PDF and DOC analysis.</p>
              </button>
              <button
                type="button"
                className="workspace-card"
                onClick={() => handleEnterWorkspace('gemini')}
              >
                <span className="workspace-card-kicker">Multimodal</span>
                <h2>Gemini</h2>
                <p>Gemini workspace with image input support and focused spreadsheet/document analysis.</p>
              </button>
            </div>
            <div className="workspace-preview">
              <div className="workspace-preview-header">
                <h3>Recent Uploads</h3>
                <span>{uploadHistory.length} total</span>
              </div>
              {recentUploads.length === 0 ? (
                <div className="workspace-preview-empty">No uploads yet.</div>
              ) : (
                <div className="workspace-preview-list">
                  {recentUploads.map((entry) => (
                    <div className="workspace-preview-item" key={entry.clientId}>
                      <div className="workspace-preview-main">
                        <div className="workspace-preview-tags">
                          <span className={`upload-type ${entry.type}`}>{entry.type}</span>
                          <span className={`upload-type workspace ${entry.workspace}`}>{entry.workspace}</span>
                        </div>
                        <strong>{entry.filename}</strong>
                        <span className="upload-time">{formatUploadTime(entry.uploadedAt)}</span>
                      </div>
                      <button type="button" onClick={() => openUploadFromHub(entry)}>
                        Open
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="workspace-hub-actions">
              <button
                type="button"
                className="workspace-hub-button"
                onClick={async () => {
                  await loadUploads('all');
                  setShowHubUploadManager(true);
                }}
              >
                Browse All Uploads
              </button>
            </div>
          </section>
        )
      ) : (
        <>
          <header className="app-nav">
            <div className="app-nav-left">
              <button
                type="button"
                className="app-nav-button"
                onClick={handleBackToHome}
              >
                Back to Home
              </button>
            </div>
            <div className="app-nav-center">
              <span className="app-nav-title">
                {activeWorkspace === 'gemini' ? 'Gemini' : 'ExcelFlow'}
              </span>
            </div>
            <div className="app-nav-right">
              <span className="app-nav-status">
                Current Workspace: <strong>{activeWorkspace === 'gemini' ? 'Gemini' : 'ExcelFlow'}</strong>
              </span>
            </div>
          </header>
          {activeWorkspace === 'gemini' ? (
        !geminiClientId ? (
          <div className="upload-shell">
            <aside className="side-nav" aria-label="Gemini upload modes">
              <h3>Gemini Upload</h3>
              <div className="nav-items">
                {uploadModes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={geminiSelectedMode === mode.id && !showUploadManager ? 'active' : ''}
                    onClick={() => setGeminiSelectedMode(mode.id)}
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
                      onClick={async () => {
                        await loadUploads('gemini');
                        setShowUploadManager(true);
                      }}
                    >
                      Manage
                    </button>
                  </div>
                </div>
                <p>{uploadHistory.length} uploads</p>
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
                <ModelSettingsPanel
                  title="Model Settings"
                  description="Choose a Gemini model, then customize its parameters."
                  groupedModelOptions={groupedGeminiModelOptions}
                  modelOptions={geminiModelOptions}
                  settingsModelId={settingsModelId}
                  onSelectModel={setSettingsModelId}
                  onClose={() => setShowSettings(false)}
                  onBack={() => setSettingsModelId(null)}
                  onReset={() =>
                    setModelParamsByModel((prev) => ({
                      ...prev,
                      [settingsModelId]: { ...defaultModelParams }
                    }))
                  }
                  currentSettings={modelParamsByModel[settingsModelId] || defaultModelParams}
                  customModelIds={customModelIds}
                  onCustomModelIdChange={handleCustomModelIdChange}
                  onParamChange={handleParamChange}
                  noteText="Gemini uses temperature, top_p, and max_output_tokens."
                />
              ) : showUploadManager ? (
                <div className="upload-manager">
                  <div className="upload-manager-header">
                    <div>
                      <h2>Workspace Uploads</h2>
                      <p>Search and reopen uploads from Gemini only.</p>
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
                      <button
                        type="button"
                        className={uploadFilterType === 'doc' ? 'active' : ''}
                        onClick={() => setUploadFilterType('doc')}
                      >
                        DOCX
                      </button>
                    </div>
                    <div className="upload-sort">
                      <label htmlFor="upload-sort-gemini">Sort</label>
                      <select
                        id="upload-sort-gemini"
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
                    {uploadHistory.length} uploads in this workspace. Showing {filteredUploads.length}.
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
                            <button type="button" onClick={() => openGeminiUploadSession(entry)}>
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
              ) : geminiSelectedMode === 'spreadsheet' ? (
                <FileUpload onFileUpload={handleGeminiSpreadsheetUpload} loading={loading} error={error} />
              ) : geminiSelectedMode === 'pdf' ? (
                <PdfUpload onFileUpload={handleGeminiPdfUpload} loading={loading} error={error} />
              ) : geminiSelectedMode === 'doc' ? (
                <DocUpload onFileUpload={handleGeminiDocUpload} loading={loading} error={error} />
              ) : (
                <div className="mode-placeholder">
                  <h2>{uploadModes.find((mode) => mode.id === geminiSelectedMode)?.label}</h2>
                  <p>This upload type is not available yet.</p>
                  <p>Select Spreadsheet to continue.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="main-content">
            <div className="excel-container" style={{ flexBasis: `${leftPanelWidth}%` }}>
              {geminiSessionMode === 'spreadsheet' ? (
                geminiExcelData ? (
                  <ExcelViewer
                    data={geminiExcelData.data}
                    metadata={geminiExcelData.metadata}
                    onBack={handleGeminiBackToUpload}
                    onSelectionSummaryChange={() => {}}
                    clearSelectionToken={0}
                  />
                ) : (
                  <div className="loading">Loading Excel data...</div>
                )
              ) : (
                geminiSessionMode === 'doc' ? (
                  <DocViewer
                    filename={geminiFilename}
                    text={geminiDocText}
                    onBack={handleGeminiBackToUpload}
                  />
                ) : (
                  <PdfViewer
                    pdfUrl={geminiPdfUrl}
                    filename={geminiFilename}
                    onBack={handleGeminiBackToUpload}
                  />
                )
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
                messages={geminiMessages}
                onSendMessage={sendGeminiMessage}
                modelOptions={geminiModelOptions}
                selectedModelId={geminiSelectedModelId}
                onModelChange={setGeminiSelectedModelId}
                inputValue={geminiChatDraft}
                onInputChange={setGeminiChatDraft}
                isWaiting={geminiIsWaiting}
                onStop={() => {
                  const pendingId = geminiPendingRequestIdRef.current;
                  if (pendingId && geminiSocket && geminiSocket.readyState === WebSocket.OPEN) {
                    geminiSocket.send(JSON.stringify({
                      type: 'cancel',
                      request_id: pendingId
                    }));
                  }
                  if (pendingId) {
                    geminiCanceledRequestIdsRef.current.add(pendingId);
                  }
                  setGeminiIsWaiting(false);
                }}
                allowImageUpload
                attachments={geminiImageAttachments}
                onAddAttachments={handleGeminiAddAttachments}
                onRemoveAttachment={handleGeminiRemoveAttachment}
                modeBadge="Gemini"
                onClearMessages={async () => {
                  if (!geminiClientId) {
                    setGeminiMessages([]);
                    return;
                  }
                  try {
                    const response = await fetch(apiUrl(`/sessions/gemini/${geminiClientId}`), {
                      method: 'DELETE'
                    });
                    if (!response.ok && response.status !== 404) {
                      throw new Error('Failed to clear session');
                    }
                  } catch (error) {
                    console.error('Error clearing Gemini session:', error);
                  }
                  setGeminiMessages([]);
                }}
                title={geminiSessionMode === 'pdf'
                  ? 'Gemini PDF Analyst'
                  : geminiSessionMode === 'doc'
                    ? 'Gemini Document Analyst'
                    : 'Gemini Spreadsheet Analyst'}
                placeholder={geminiSessionMode === 'pdf'
                  ? 'Ask about your PDF...'
                  : geminiSessionMode === 'doc'
                    ? 'Ask about your document...'
                    : 'Ask about your spreadsheet...'}
                emptyStateText={geminiSessionMode === 'pdf'
                  ? 'Start chatting with Gemini about the PDF'
                  : geminiSessionMode === 'doc'
                    ? 'Start chatting with Gemini about the document'
                    : 'Start chatting with Gemini about the spreadsheet'
                }
              />
            </div>
          </div>
        )
      ) : (
        !clientId ? (
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
              <div className="test-toggle">
                <div className="test-toggle-row">
                  <span>Bedrock attachment test</span>
                  {useBedrockAttachment && <span className="test-toggle-status">Active</span>}
                </div>
                <small>Send Excel as base64 attachment (Bedrock only).</small>
                <div className="test-toggle-actions">
                  <button
                    type="button"
                    className="test-toggle-button"
                    disabled={selectedMode !== 'spreadsheet'}
                    onClick={() => {
                      try {
                        const url = new URL(window.location.href);
                        url.searchParams.set('bedrockAttachment', '1');
                        window.open(url.toString(), '_blank', 'noopener');
                      } catch (error) {
                        console.warn('Failed to open test window', error);
                      }
                    }}
                  >
                    Open test window
                  </button>
                  {useBedrockAttachment && (
                    <button
                      type="button"
                      className="test-toggle-button"
                      onClick={() => {
                        try {
                          const url = new URL(window.location.href);
                          url.searchParams.delete('bedrockAttachment');
                          window.location.href = url.toString();
                        } catch (error) {
                          console.warn('Failed to disable test mode', error);
                        }
                      }}
                    >
                      Disable
                    </button>
                  )}
                </div>
              </div>
              <div className="upload-history">
                <div className="upload-history-header">
                  <h4>Recent Uploads</h4>
                  <div className="upload-history-actions">
                    <button
                      type="button"
                      className={showUploadManager ? 'active' : ''}
                      onClick={() => {
                        loadUploads('default');
                        setShowUploadManager(true);
                        setShowSettings(false);
                      }}
                    >
                      Manage
                    </button>
                  </div>
                </div>
                <p>{uploadHistory.length} uploads</p>
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
                <ModelSettingsPanel
                  title="Model Settings"
                  description="Choose a model, then customize its parameters."
                  groupedModelOptions={groupedModelOptions}
                  modelOptions={modelOptions}
                  settingsModelId={settingsModelId}
                  onSelectModel={setSettingsModelId}
                  onClose={() => setShowSettings(false)}
                  onBack={() => setSettingsModelId(null)}
                  onReset={() =>
                    setModelParamsByModel((prev) => ({
                      ...prev,
                      [settingsModelId]: { ...defaultModelParams }
                    }))
                  }
                  currentSettings={modelParamsByModel[settingsModelId] || defaultModelParams}
                  customModelIds={customModelIds}
                  onCustomModelIdChange={handleCustomModelIdChange}
                  onParamChange={handleParamChange}
                  noteText="Penalties apply to OpenAI models. Bedrock uses temperature or top_p plus max_tokens."
                />
              ) : showUploadManager ? (
                <div className="upload-manager">
                <div className="upload-manager-header">
                  <div>
                    <h2>Workspace Uploads</h2>
                    <p>Search and reopen uploads from ExcelFlow only.</p>
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
                    <button
                      type="button"
                      className={uploadFilterType === 'doc' ? 'active' : ''}
                      onClick={() => setUploadFilterType('doc')}
                    >
                      DOCX
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
                  {uploadHistory.length} uploads in this workspace. Showing {filteredUploads.length}.
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
              ) : selectedMode === 'doc' ? (
                <DocUpload onFileUpload={handleDocUpload} loading={loading} error={error} />
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
                sessionMode === 'doc' ? (
                  <DocViewer
                    filename={pdfFilename}
                    text={docText}
                    onBack={handleBackToUpload}
                  />
                ) : (
                  <PdfViewer
                    pdfUrl={pdfUrl}
                    filename={pdfFilename}
                    onBack={handleBackToUpload}
                  />
                )
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
                isWaiting={isWaiting}
                onStop={() => {
                  const pendingId = pendingRequestIdRef.current;
                  if (pendingId && socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({
                      type: 'cancel',
                      request_id: pendingId
                    }));
                  }
                  if (pendingId) {
                    canceledRequestIdsRef.current.add(pendingId);
                  } else {
                    ignoreNextResponseRef.current = true;
                  }
                  setIsWaiting(false);
                }}
                modeBadge={useBedrockAttachment
                  ? 'Bedrock Attachment Test'
                  : 'Standard'}
                focusToken={focusInputToken}
                onClearMessages={async () => {
                  if (!clientId) {
                    setMessages([]);
                    return;
                  }
                  try {
                    const response = await fetch(apiUrl(`/sessions/${clientId}`), {
                      method: 'DELETE'
                    });
                    if (!response.ok && response.status !== 404) {
                      throw new Error('Failed to clear session');
                    }
                  } catch (error) {
                    console.error('Error clearing session:', error);
                  }
                  setMessages([]);
                }}
                title={sessionMode === 'pdf'
                  ? 'PDF Analyst Chat'
                  : sessionMode === 'doc'
                    ? 'Document Analyst Chat'
                    : 'Excel Agent Chat'}
                placeholder={sessionMode === 'pdf'
                  ? 'Ask about your PDF...'
                  : sessionMode === 'doc'
                    ? 'Ask about your document...'
                    : 'Ask about your Excel data...'}
                emptyStateText={sessionMode === 'pdf'
                  ? 'Start chatting with the PDF analyst'
                  : sessionMode === 'doc'
                    ? 'Start chatting with the document analyst'
                    : 'Start chatting with the Excel Agent'
                }
                selectionSummary={sessionMode === 'spreadsheet' ? selectionSummary : null}
                onReferenceSelection={handleReferenceSelection}
                onClearSelection={handleClearSelection}
              />
            </div>
          </div>
        )
      )}
        </>
      )}
    </div>
  );
}

export default App;
