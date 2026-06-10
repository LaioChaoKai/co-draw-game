import React from 'react';
import { Timer, Trophy, Play, Info, Sparkles } from 'lucide-react';

function GameStatus({ users, gameStatus, drawerId, category, word, timer, socket, currentUserSocketId }) {
  const isDrawer = currentUserSocketId === drawerId;
  
  // Sort users by score descending
  const sortedUsers = [...users].sort((a, b) => b.score - a.score);
  
  // Count active online users
  const activeCount = users.filter(u => u.online).length;

  const handleStartGame = () => {
    if (socket) {
      socket.emit('start_game');
    }
  };

  // Helper to generate the word indicator for guessers
  const getObscuredWord = () => {
    if (isDrawer) return word;
    if (!word) {
      // If word is not sent to guessers, we can check its length (often sent via system info or category)
      return `❓ ❓ ❓`; // fallback
    }
    return word; // If we get the word, but in our design guessers don't get the 'word' prop from App.jsx unless it's over!
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Game Info Dashboard */}
      <div className="glass-card game-info-card">
        {gameStatus === 'LOBBY' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Info size={20} style={{ color: 'var(--secondary)' }} />
              <div>
                <div style={{ fontWeight: 600 }}>等待遊戲開始...</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>需要至少 2 人在線上 (目前: {activeCount} 人)</div>
              </div>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={handleStartGame}
              disabled={activeCount < 2}
            >
              <Play size={16} /> 開始遊戲
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            {/* Timer */}
            <div className={`timer-box ${timer <= 10 ? 'timer-alert' : 'timer-running'}`}>
              <Timer size={20} />
              <span>{timer}s</span>
            </div>

            {/* Word details */}
            <div className="word-box">
              <span style={{ fontSize: '0.8rem', opacity: 0.7, fontWeight: 500 }}>
                [{category || '分類'}]
              </span>
              <span>
                {gameStatus === 'ROUND_END' ? (
                  <span style={{ color: 'var(--accent)' }}>答案: {word}</span>
                ) : isDrawer ? (
                  <span style={{ color: 'var(--primary)' }}>繪製: {word}</span>
                ) : (
                  <span>猜我！({word ? word.length : 0} 個字)</span>
                )}
              </span>
            </div>
            
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {isDrawer ? '🎨 你是畫家，請作畫！' : '🧠 觀察畫布，在聊天室輸入答案！'}
            </div>
          </div>
        )}
      </div>

      {/* Leaderboard / Scores */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
          <Trophy size={18} style={{ color: '#f59e0b' }} />
          玩家積分榜
        </h3>
        <div className="scoreboard-container">
          {sortedUsers.map((user, index) => {
            const userIsDrawer = user.id === drawerId && gameStatus === 'PLAYING';
            // Wait, we can check if user is in guessed list (we could pass guessedUsers)
            // Let's check how to style drawers/guessers
            return (
              <div 
                key={user.id} 
                className={`scoreboard-user ${userIsDrawer ? 'drawer' : ''} ${!user.online ? 'offline' : ''}`}
                style={{
                  borderLeft: userIsDrawer 
                    ? '3px solid var(--accent)' 
                    : user.id === currentUserSocketId 
                      ? '3px solid var(--secondary)' 
                      : '3px solid transparent'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', opacity: 0.6, width: '12px' }}>{index + 1}</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {user.username} {user.id === currentUserSocketId && <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>(你)</span>}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {userIsDrawer ? '🎨 畫家中' : !user.online ? '💤 斷線中' : '🧠 猜題中'}
                    </span>
                  </div>
                </div>
                <div className="user-score-badge">
                  {user.score} pts
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default GameStatus;
