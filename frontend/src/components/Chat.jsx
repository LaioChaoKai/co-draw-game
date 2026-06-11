import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Bot, Sparkles } from 'lucide-react';

function Chat({ 
  messages, 
  onSendMessage, 
  onSendAiQuestion, 
  isDrawer, 
  hasGuessed, 
  gameStatus,
  hasAskedAi,
  guessesLeftAfterAi,
  hasGeminiKey
}) {
  const [inputText, setInputText] = useState('');
  const [isAiMode, setIsAiMode] = useState(false);
  const messagesEndRef = useRef(null);

  // Turn off AI mode if game state is not PLAYING
  useEffect(() => {
    if (gameStatus !== 'PLAYING') {
      setIsAiMode(false);
    }
  }, [gameStatus]);

  // Turn off AI mode if player has asked AI
  useEffect(() => {
    if (hasAskedAi) {
      setIsAiMode(false);
    }
  }, [hasAskedAi]);

  // Auto-scroll to bottom of chat list
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (isAiMode) {
      onSendAiQuestion(inputText.trim());
    } else {
      onSendMessage(inputText.trim());
    }
    setInputText('');
  };

  // Determine input field state and placeholders
  const getInputPlaceholder = () => {
    if (gameStatus === 'SELECTING_WORD') {
      return '🎨 選詞階段中...';
    }
    if (gameStatus === 'GAME_OVER') {
      return '🏁 遊戲已結束！';
    }
    if (isDrawer) {
      return '🔒 你是畫家，本回合聊天與 AI 功能已鎖定！';
    }
    if (gameStatus === 'PLAYING') {
      if (guessesLeftAfterAi !== null && guessesLeftAfterAi <= 0) {
        return '❌ 已用盡本回合唯一一次作答機會！';
      }
      if (isAiMode) {
        return '🤖 問 AI：這幅畫畫了什麼？給我提示...';
      }
      if (hasGuessed) {
        return '🎉 答對囉！請等待其他玩家。';
      }
      if (hasAskedAi && guessesLeftAfterAi > 0) {
        return `⚠️ 剩餘最後 ${guessesLeftAfterAi} 次作答機會！`;
      }
      return '🧠 在此輸入你的猜測...';
    }
    return '💬 輸入聊天內容...';
  };

  const isInputDisabled = () => {
    if (gameStatus === 'SELECTING_WORD' || gameStatus === 'GAME_OVER') return true;
    if (isDrawer) return true;
    if (gameStatus === 'PLAYING') {
      if (guessesLeftAfterAi !== null && guessesLeftAfterAi <= 0) {
        return true;
      }
      if (isAiMode) return false;
      return hasGuessed;
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
          else if (msg.isAi) bubbleClass += ' chat-bubble-ai';

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
        {gameStatus === 'PLAYING' && (
          <button
            type="button"
            className={`btn btn-icon ${isAiMode ? 'active' : ''}`}
            onClick={() => setIsAiMode(!isAiMode)}
            disabled={!hasGeminiKey || hasAskedAi || isDrawer}
            style={{ 
              marginRight: '0.25rem', 
              borderColor: isAiMode ? 'var(--secondary)' : 'var(--border-glass)',
              background: isAiMode ? 'rgba(59, 130, 246, 0.2)' : '',
              color: isAiMode ? '#60a5fa' : (!hasGeminiKey ? '#4b5563' : ''),
              opacity: (!hasGeminiKey || hasAskedAi || isDrawer) ? 0.4 : 1,
              cursor: (!hasGeminiKey || hasAskedAi || isDrawer) ? 'not-allowed' : 'pointer'
            }}
            title={
              !hasGeminiKey ? '🔑 未設定 API Key，請回大廳輸入 Gemini API Key 後重新加入' :
              isDrawer ? '你是畫家，本回合不能使用 AI' :
              hasAskedAi ? '每回合只能提問 AI 一次！' :
              isAiMode ? '切換回一般聊天' : '切換至 AI 提問'
            }
          >
            <Bot size={18} />
          </button>
        )}
        <input
          type="text"
          className="input-field"
          style={{ 
            flex: 1,
            borderColor: isAiMode ? 'rgba(59, 130, 246, 0.4)' : '',
            boxShadow: isAiMode ? '0 0 0 3px rgba(59, 130, 246, 0.15)' : ''
          }}
          placeholder={getInputPlaceholder()}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isInputDisabled()}
          maxLength={100}
        />
        <button 
          type="submit" 
          className={`btn btn-icon ${isAiMode ? 'btn-secondary' : 'btn-primary'}`}
          disabled={isInputDisabled()}
          style={{
            background: isAiMode ? 'var(--secondary)' : '',
            boxShadow: isAiMode ? '0 4px 14px 0 var(--secondary-glow)' : ''
          }}
        >
          {isAiMode ? <Sparkles size={16} /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
}

export default Chat;
