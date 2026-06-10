import React, { useState } from 'react';
import { Palette, LogIn, Plus } from 'lucide-react';

function Lobby({ onJoin }) {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('請輸入使用者名稱！');
      return;
    }
    // Generate a random 6-character room code
    const generatedRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    onJoin({ roomId: generatedRoomId, username: username.trim() });
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
    onJoin({ roomId: roomId.trim().toUpperCase(), username: username.trim() });
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

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
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
