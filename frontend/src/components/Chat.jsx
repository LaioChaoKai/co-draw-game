import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';

function Chat({ messages, onSendMessage, isDrawer, hasGuessed, gameStatus }) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat list
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    onSendMessage(inputText.trim());
    setInputText('');
  };

  // Determine input field state and placeholders
  const getInputPlaceholder = () => {
    if (gameStatus === 'PLAYING') {
      if (isDrawer) return '🎨 你是畫家，請專心作畫，不能透露答案！';
      if (hasGuessed) return '🎉 答對囉！請等待其他玩家。';
      return '🧠 在此輸入你的猜測...';
    }
    return '💬 輸入聊天內容...';
  };

  const isInputDisabled = () => {
    if (gameStatus === 'PLAYING') {
      return isDrawer || hasGuessed;
    }
    return false;
  };

  return (
    <div className="glass-card chat-container">
      {/* Header */}
      <div className="chat-header">
        <MessageSquare size={18} style={{ color: 'var(--primary)' }} />
        <span>聊天與猜題</span>
      </div>

      {/* Messages list */}
      <div className="chat-messages">
        {messages.map((msg, index) => {
          let bubbleClass = 'chat-bubble';
          if (msg.isSystem) bubbleClass += ' chat-bubble-system';
          else if (msg.isSelf) bubbleClass += ' chat-bubble-self';

          return (
            <div key={msg.id || index} className={bubbleClass}>
              {!msg.isSystem && (
                <span className="chat-message-sender">
                  {msg.sender}:
                </span>
              )}
              <span>{msg.text}</span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="chat-input-area">
        <input
          type="text"
          className="input-field"
          style={{ flex: 1 }}
          placeholder={getInputPlaceholder()}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isInputDisabled()}
          maxLength={100}
        />
        <button 
          type="submit" 
          className="btn btn-icon btn-primary"
          disabled={isInputDisabled()}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

export default Chat;
