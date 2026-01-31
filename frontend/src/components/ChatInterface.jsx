import React, { useRef, useEffect, useState } from 'react';
import { FiSend, FiTrash2 } from 'react-icons/fi';

const ChatInterface = ({
  messages,
  onSendMessage,
  modelOptions,
  selectedModelId,
  onModelChange,
  inputValue,
  onInputChange,
  isWaiting = false,
  onStop,
  modeBadge,
  focusToken,
  title = 'Excel Agent Chat',
  placeholder = 'Ask about your Excel data...',
  emptyStateText = 'Start chatting with the Excel Agent',
  onClearMessages,
  selectionSummary,
  onReferenceSelection,
  onClearSelection
}) => {
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatContainerRef = useRef(null);
  const headerRef = useRef(null);
  const resizeHandleRef = useRef(null);
  const inputAreaRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);
  const [messagesHeight, setMessagesHeight] = useState(null);
  const [inputHeight, setInputHeight] = useState(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (focusToken === undefined) return;
    inputRef.current?.focus();
  }, [focusToken]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (e) => {
      const container = chatContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const nextHeight = e.clientY - rect.top;
      const headerHeight = headerRef.current?.getBoundingClientRect().height ?? 0;
      const handleHeight = resizeHandleRef.current?.getBoundingClientRect().height ?? 0;
      const available = rect.height - headerHeight - handleHeight;
      const minMessages = 160;
      const minInput = 120;
      const maxMessages = Math.max(minMessages, available - minInput);
      const clampedMessages = Math.min(Math.max(nextHeight - headerHeight, minMessages), maxMessages);
      const nextInput = Math.max(minInput, available - clampedMessages);
      setMessagesHeight(clampedMessages);
      setInputHeight(nextInput);
    };
    const handleUp = () => setIsResizing(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('mouseleave', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('mouseleave', handleUp);
    };
  }, [isResizing]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      onInputChange('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    handleSubmit(e);
  };

  return (
    <div className="chat-container" ref={chatContainerRef}>
      <div className="chat-header" ref={headerRef}>
        <div className="chat-title-row">
          <h2 className="chat-title">{title}</h2>
          {modeBadge && <span className="chat-mode-badge">{modeBadge}</span>}
        </div>
        <div className="model-select">
          <label htmlFor="model-select">Model</label>
          <select
            id="model-select"
            value={selectedModelId}
            onChange={(e) => onModelChange(e.target.value)}
          >
            {modelOptions.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="chat-clear chat-clear-header"
          onClick={onClearMessages}
          disabled={!messages.length}
          aria-label="Clear chat"
        >
          <FiTrash2 />
          Clear
        </button>
      </div>
      
      <div
        className="messages-container"
        style={messagesHeight ? { height: `${messagesHeight}px` } : undefined}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>{emptyStateText}</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={index} 
              className={`message ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`}
            >
              {msg.content}
            </div>
          ))
        )}
        {isWaiting && (
          <div className="message assistant-message typing-message">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-label">Assistant is thinking</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div
        className="chat-resize-handle"
        role="separator"
        aria-label="Resize chat panels"
        ref={resizeHandleRef}
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
      />

      <div
        className="chat-input-area"
        ref={inputAreaRef}
        style={inputHeight ? { height: `${inputHeight}px` } : undefined}
      >
        {selectionSummary && (
          <div className="chat-reference-banner" aria-live="polite">
            <span>Reference range {selectionSummary.rangeLabel}?</span>
            <button type="button" onClick={onReferenceSelection}>
              Reference
            </button>
            <button type="button" onClick={onClearSelection}>
              Dismiss
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="message-input">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label="Message input"
            rows={2}
            disabled={isWaiting}
          />
          {isWaiting ? (
            <button type="button" className="message-stop" onClick={onStop} aria-label="Stop response">
              Stop
            </button>
          ) : (
            <button type="submit" aria-label="Send message">
              <FiSend />
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
