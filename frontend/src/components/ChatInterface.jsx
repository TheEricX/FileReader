import React, { useState, useRef, useEffect } from 'react';
import { FiSend } from 'react-icons/fi';

const ChatInterface = ({ messages, onSendMessage, modelOptions, selectedModelId, onModelChange }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2 className="text-xl font-bold p-4 border-b border-gray-700">Excel Agent Chat</h2>
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
      
      <form onSubmit={handleSubmit} className="message-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your Excel data..."
          aria-label="Message input"
        />
        <button type="submit" aria-label="Send message">
          <FiSend />
        </button>
      </form>
    </div>
  );
};

export default ChatInterface;
