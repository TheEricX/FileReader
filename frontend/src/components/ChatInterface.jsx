import React, { useRef, useEffect } from 'react';
import { FiSend } from 'react-icons/fi';

const ChatInterface = ({
  messages,
  onSendMessage,
  modelOptions,
  selectedModelId,
  onModelChange,
  inputValue,
  onInputChange,
  focusToken,
  selectionSummary,
  onReferenceSelection,
  onClearSelection
}) => {
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (focusToken === undefined) return;
    inputRef.current?.focus();
  }, [focusToken]);

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
    <div className="chat-container">
      <div className="chat-header">
        <h2 className="chat-title">Excel Agent Chat</h2>
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
      </div>
      
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>Start chatting with the Excel Agent</p>
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
        <div ref={messagesEndRef} />
      </div>
      
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
          placeholder="Ask about your Excel data..."
          aria-label="Message input"
          rows={2}
        />
        <button type="submit" aria-label="Send message">
          <FiSend />
        </button>
      </form>
    </div>
  );
};

export default ChatInterface;
