import React, { useState } from 'react';
import { Palette, LogIn, Plus } from 'lucide-react';

function Lobby({ onJoin }) {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [error, setError] = useState('');

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('請輸入使用者名稱！');
      return;
    }
    const generatedRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    onJoin({ roomId: generatedRoomId, username: username.trim(), geminiKey: geminiKey.trim() });
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('請輸入使用者名稱！');
      return;
    }
    if (!roomId.trim()) {
      setError('請輸入房號！');
      return;
    }
    onJoin({ roomId: roomId.trim().toUpperCase(), username: username.trim(), geminiKey: geminiKey.trim() });
  };

  return (
    <div className="lobby-container">
      <div className="glass-card lobby-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <Palette size={48} style={{ color: '#10b981', filter: 'drop-shadow(0 0 10px rgba(16,185,129,0.4))' }} />
        </div>
        <h1 className="lobby-title">CoDraw</h1>
        <p className="lobby-subtitle">多人即時協作畫布與你畫我猜小遊戲</p>

        {error && (
          <div style={{ 
            backgroundColor: 'rgba(239, 68, 68, 0.15)', 
            border: '1px solid rgba(239, 68, 68, 0.3)', 
            color: '#f87171', 
            padding: '0.75rem', 
            borderRadius: '8px', 
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            textAlign: 'left'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form className="lobby-form" onSubmit={(e) => e.preventDefault()}>
          <div className="form-group">
            <label className="form-label">使用者暱稱</label>
            <input
              type="text"
              className="input-field"
              placeholder="輸入你在遊戲中的稱呼"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              maxLength={12}
            />
          </div>

          {/* Gemini API Key (optional) */}
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🤖 請輸入您的 Gemini API Key
              <span style={{
                fontSize: '0.68rem',
                padding: '0.15rem 0.55rem',
                borderRadius: '999px',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                color: '#f59e0b',
                fontWeight: 700,
                letterSpacing: '0.03em'
              }}>選填</span>
            </label>
            <input
              id="gemini-api-key"
              type="password"
              className="input-field"
              placeholder="AIzaSy...（不填入則 AI 問答功能將鎖定）"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              style={{ fontFamily: 'monospace', fontSize: '0.88rem', letterSpacing: '0.05em' }}
            />
            <p style={{
              marginTop: '0.45rem',
              fontSize: '0.73rem',
              color: 'var(--text-muted)',
              lineHeight: 1.6
            }}>
              🔒 Key 僅用於本次連線，<strong style={{ color: 'var(--text-main)' }}>不會傳送或儲存在任何伺服器</strong>。
              沒有 Key 也可以遊玩，只是 AI 提示功能會關閉。
              可至 <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--secondary)', textDecoration: 'underline' }}
              >Google AI Studio</a> 免費取得。
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ flex: 1 }}
              onClick={handleCreateRoom}
            >
              <Plus size={18} /> 創建新房間
            </button>
          </div>

          <div className="lobby-divider">或者加入現有房間</div>

          <div className="form-group">
            <label className="form-label">房間號碼 (Room Code)</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="input-field"
                placeholder="輸入 6 位數房間代碼"
                style={{ flex: 1, textTransform: 'uppercase' }}
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value);
                  setError('');
                }}
                maxLength={8}
              />
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleJoinRoom}
              >
                <LogIn size={18} /> 加入
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Lobby;
