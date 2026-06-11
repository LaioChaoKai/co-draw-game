import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import confetti from 'canvas-confetti';
import { Palette, Copy, LogOut, Heart } from 'lucide-react';
import Lobby from './components/Lobby';
import Board from './components/Board';
import GameStatus from './components/GameStatus';
import Chat from './components/Chat';
import SOCKET_URL from './api';
import {
  playCorrectGuess,
  playChatMessage,
  playRoundEnd,
  playGameOver,
  playTimerTick,
  playAiBlip,
  playRoundStart,
  playError
} from './utils/sounds';

function App() {
  const [joined, setJoined] = useState(false);
  const [roomInfo, setRoomInfo] = useState({ roomId: '', username: '' });
  const [users, setUsers] = useState([]);
  const [gameStatus, setGameStatus] = useState('LOBBY'); // 'LOBBY', 'SELECTING_WORD', 'PLAYING', 'ROUND_END', 'GAME_OVER'
  const [drawerId, setDrawerId] = useState(null);
  const [drawerName, setDrawerName] = useState('');
  const [category, setCategory] = useState('');
  const [word, setWord] = useState('');
  const [wordLength, setWordLength] = useState(0);
  const [timer, setTimer] = useState(0);
  const [guessedUsers, setGuessedUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [copyText, setCopyText] = useState('複製房號');
  const [wordOptions, setWordOptions] = useState([]);
  const [round, setRound] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [geminiKey, setGeminiKey] = useState(''); // Player's own Gemini API key

  const socketRef = useRef(null);
  const canvasRef = useRef(null);
  const prevTimerRef = useRef(null); // for timer tick detection

  // Clean up socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const handleJoin = ({ roomId, username, geminiKey: key = '' }) => {
    setGeminiKey(key);
    setRoomInfo({ roomId, username });
    
    // Connect to WebSocket server
    socketRef.current = io(SOCKET_URL);

    // Join room
    socketRef.current.emit('join_room', { roomId, username });
    setJoined(true);

    // Setup event listeners
    socketRef.current.on('room_data', (data) => {
      setUsers(data.users);
      setGameStatus(data.gameStatus);
      setDrawerId(data.drawerId);
      setCategory(data.category);
      setTimer(data.timer);
      setGuessedUsers(data.guessedUsers || []);
      
      const drawer = data.users.find(u => u.id === data.drawerId);
      if (drawer) {
        setDrawerName(drawer.username);
      }
    });

    socketRef.current.on('round_selecting', (data) => {
      setGameStatus('SELECTING_WORD');
      setDrawerId(data.drawerId);
      setDrawerName(data.drawerName);
      setTimer(data.timer);
      setUsers(data.users);
      setWord('');
      setRound(data.round);
    });

    socketRef.current.on('word_options', (data) => {
      setWordOptions(data.options);
    });

    socketRef.current.on('round_started', (data) => {
      setGameStatus('PLAYING');
      setDrawerId(data.drawerId);
      setDrawerName(data.drawerName);
      setCategory(data.category);
      setTimer(data.timer);
      setUsers(data.users);
      setWord(''); // Clear old word for guessers
      setWordLength(data.wordLength || 0); // Set word length for guessers
      setWordOptions([]); // Clear options once playing starts
      setGuessedUsers([]);
      
      setMessages(prev => [...prev, {
        id: Date.now() + Math.random(),
        isSystem: true,
        text: `🎨 新回合開始！現在輪到 ${data.drawerName} 作畫。`
      }]);
    });

    socketRef.current.on('secret_word', (data) => {
      setWord(data.word);
      setWordLength(data.word.length);
    });

    socketRef.current.on('timer_update', (data) => {
      setTimer(data.timer);
      // Play tick in final 10 seconds (only once per tick, not when paused)
      if (data.timer <= 10 && data.timer > 0 && data.timer !== prevTimerRef.current) {
        playTimerTick();
      }
      prevTimerRef.current = data.timer;
    });

    socketRef.current.on('correct_guess', (data) => {
      setUsers(data.users);
      setGuessedUsers(prev => [...prev, data.userId]);
      playCorrectGuess();

      // If the current user guessed correctly, trigger confetti!
      if (data.userId === socketRef.current.id) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    });

    socketRef.current.on('round_ended', (data) => {
      setGameStatus('ROUND_END');
      setWord(data.word);
      
      setMessages(prev => [...prev, {
        id: Date.now() + Math.random(),
        isSystem: true,
        text: `⏰ 回合結束！正確答案是：【${data.word}】。`
      }]);
    });

    socketRef.current.on('chat_message', (msg) => {
      playChatMessage();
      setMessages(prev => [...prev, {
        id: Date.now() + Math.random(),
        sender: msg.username,
        text: msg.text,
        isSelf: msg.userId === socketRef.current.id
      }]);
    });

    socketRef.current.on('system_message', (msg) => {
      setMessages(prev => [...prev, {
        id: Date.now() + Math.random(),
        isSystem: true,
        text: msg.text
      }]);
    });

    socketRef.current.on('game_reset_lobby', (data) => {
      setGameStatus('LOBBY');
      setDrawerId(null);
      setDrawerName('');
      setCategory('');
      setWord('');
      setTimer(0);
      setGuessedUsers([]);
      setUsers(data.users);
      
      setMessages(prev => [...prev, {
        id: Date.now() + Math.random(),
        isSystem: true,
        text: `⚠️ ${data.message}`
      }]);
    });

    socketRef.current.on('game_over', (data) => {
      setGameStatus('GAME_OVER');
      setUsers(data.users);
      setLeaderboard(data.leaderboard || []);
      
      setMessages(prev => [...prev, {
        id: Date.now() + Math.random(),
        isSystem: true,
        text: `🚩 遊戲結束！第一名是：【${data.leaderboard?.[0]?.username || '無'}】！`
      }]);

      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.5 }
      });
    });

    socketRef.current.on('user_left', (data) => {
      setUsers(data.users);
    });

    socketRef.current.on('ai_thinking', (data) => {
      setMessages(prev => [...prev, {
        id: Date.now() + Math.random(),
        isSystem: true,
        isAiThinking: true,
        text: `🤖 ${data.username} 正在向 AI 助手提問：『${data.question}』... (AI 思考中)`
      }]);
    });

    socketRef.current.on('ai_response', (data) => {
      playAiBlip();
      setMessages(prev => {
        const filtered = prev.filter(msg => !(msg.isAiThinking && msg.text.includes(data.username)));
        return [...filtered, {
          id: Date.now() + Math.random(),
          isAi: true,
          sender: `${data.username} 的問答`,
          text: `🤖 AI 回覆：${data.answer}`
        }];
      });
    });

    socketRef.current.on('ai_private_done', (data) => {
      setMessages(prev => {
        const filtered = prev.filter(msg => !(msg.isAiThinking && msg.text.includes(data.username)));
        return [...filtered, {
          id: Date.now() + Math.random(),
          isSystem: true,
          text: `🤫 AI 已私下給予了 ${data.username} 提示。`
        }];
      });
    });
  };

  const handleSendMessage = (text) => {
    if (socketRef.current) {
      socketRef.current.emit('chat_message', text);
    }
  };

  const handleSelectClass = (difficultyClass) => {
    if (socketRef.current) {
      socketRef.current.emit('select_class', { difficultyClass });
    }
  };

  const handleSelectWord = (selectedWord) => {
    if (socketRef.current) {
      socketRef.current.emit('select_word', { word: selectedWord });
    }
  };

  const handleSendAiQuestion = (text) => {
    if (!socketRef.current || !canvasRef.current) return;

    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      socketRef.current.emit('ask_ai', {
        question: text,
        image: dataUrl,
        geminiKey: geminiKey // pass player's own key to the backend
      });
    } catch (err) {
      console.error("Failed to capture canvas image:", err);
      setMessages(prev => [...prev, {
        id: Date.now() + Math.random(),
        isSystem: true,
        text: "❌ 無法擷取畫布，可能畫布尚未載入。"
      }]);
    }
  };

  const handleLeave = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setJoined(false);
    setRoomInfo({ roomId: '', username: '' });
    setUsers([]);
    setGameStatus('LOBBY');
    setDrawerId(null);
    setDrawerName('');
    setCategory('');
    setWord('');
    setTimer(0);
    setGuessedUsers([]);
    setMessages([]);
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomInfo.roomId);
    setCopyText('已複製！');
    setTimeout(() => {
      setCopyText('複製房號');
    }, 2000);
  };

  const currentUser = users.find(u => u.id === (socketRef.current ? socketRef.current.id : null));
  const isDrawer = socketRef.current && socketRef.current.id === drawerId;
  const hasGuessed = socketRef.current && guessedUsers.includes(socketRef.current.id);

  return (
    <div className="app-container">
      {/* Dynamic logo color gradient */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </svg>

      <header className="app-header">
        <div className="app-logo">
          <Palette size={28} />
          <span>CoDraw</span>
        </div>

        {joined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="room-badge" onClick={copyRoomId} style={{ cursor: 'pointer', background: 'rgba(16, 185, 129, 0.1)' }}>
              <span>房號: {roomInfo.roomId}</span>
              <Copy size={14} />
              <span style={{ fontSize: '0.75rem', opacity: 0.8, marginLeft: '0.2rem' }}>({copyText})</span>
            </button>
            <button className="btn btn-outline" onClick={handleLeave} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
              <LogOut size={14} /> 離開房間
            </button>
          </div>
        )}
      </header>

      {joined ? (
        <div className="workspace">
          {/* Main draw area (scores & whiteboard) */}
          <div className="main-area">
            <GameStatus
              users={users}
              gameStatus={gameStatus}
              drawerId={drawerId}
              category={category}
              word={word}
              wordLength={wordLength}
              timer={timer}
              socket={socketRef.current}
              currentUserSocketId={socketRef.current ? socketRef.current.id : null}
            />
            <Board
              socket={socketRef.current}
              isDrawer={isDrawer}
              gameStatus={gameStatus}
              drawerName={drawerName}
              canvasRef={canvasRef}
            />
          </div>

          {/* Right sidebar area (chat and guessing log) */}
          <div className="side-area">
            <Chat
              messages={messages}
              onSendMessage={handleSendMessage}
              onSendAiQuestion={handleSendAiQuestion}
              isDrawer={isDrawer}
              hasGuessed={hasGuessed}
              gameStatus={gameStatus}
              hasAskedAi={currentUser?.hasAskedAi}
              guessesLeftAfterAi={currentUser?.guessesLeftAfterAi}
              hasGeminiKey={!!geminiKey}
            />

          </div>

          {gameStatus === 'SELECTING_WORD' && (
            <div className="game-overlay">
              <div className="overlay-card" style={{ maxWidth: '550px', width: '90%' }}>
                <h3 style={{ fontSize: '1.4rem', color: '#ffffff', margin: 0 }}>🎨 回合 {round}：選擇一個題目來畫</h3>
                {isDrawer ? (
                  wordOptions.length === 0 ? (
                    <>
                      <p className="overlay-desc">請先選擇題目難度（班級）：</p>
                      <div className="word-options-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                        <button className="word-option-btn" onClick={() => handleSelectClass('baby')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0.85rem 1.25rem' }}>
                          <span style={{ fontWeight: 600 }}>👶 幼幼2字班</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>(猜對: 猜題+100 / 畫家+50)</span>
                        </button>
                        <button className="word-option-btn" onClick={() => handleSelectClass('advanced')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0.85rem 1.25rem' }}>
                          <span style={{ fontWeight: 600 }}>🚀 進階3字班</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>(猜對: 猜題+100 / 畫家+100)</span>
                        </button>
                        <button className="word-option-btn" onClick={() => handleSelectClass('idiom')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0.85rem 1.25rem' }}>
                          <span style={{ fontWeight: 600 }}>📚 成語4字班</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>(猜對: 猜題+100 / 畫家+150)</span>
                        </button>
                        <button className="word-option-btn" onClick={() => handleSelectClass('meme')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0.85rem 1.25rem' }}>
                          <span style={{ fontWeight: 600 }}>🤡 迷因班</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>(猜對: 雙方皆得 +200)</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="overlay-desc">請從該難度中點選一個題目：</p>
                      <div className="word-options-container" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', width: '100%' }}>
                        {wordOptions.map((opt, i) => (
                          <button
                            key={opt.word || i}
                            className="word-option-btn"
                            onClick={() => handleSelectWord(opt.word)}
                            style={{ padding: '1rem' }}
                          >
                            <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{opt.word}</span>
                            <span className="word-category" style={{ fontSize: '0.8rem', opacity: 0.7, marginLeft: '0.5rem' }}>
                              ({opt.category === 'baby' ? '幼幼2字班' : opt.category === 'advanced' ? '進階3字班' : opt.category === 'idiom' ? '成語4字班' : '迷因班'})
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )
                ) : (
                  <>
                    <div className="loading-spinner"></div>
                    <p className="overlay-desc">正在等待畫家 <strong>{drawerName}</strong> 選詞...</p>
                  </>
                )}
                <div className="overlay-timer" style={{ marginTop: '1rem' }}>⏰ 剩餘選擇時間：{timer} 秒</div>
              </div>
            </div>
          )}

          {gameStatus === 'GAME_OVER' && (
            <div className="game-overlay">
              <div className="overlay-card">
                <h2 style={{ fontSize: '1.6rem', color: '#f59e0b', margin: 0 }}>🏆 遊戲結束！</h2>
                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>第一名：{leaderboard[0]?.username || '無'} 👑</h3>
                <p className="overlay-desc">倒數 10 秒後自動回到遊戲大廳...</p>
                <div className="leaderboard-container">
                  {leaderboard.slice(0, 5).map((player, idx) => (
                    <div key={player.id || idx} className={`leaderboard-item rank-${idx + 1}`}>
                      <span className="rank-num">#{idx + 1}</span>
                      <span className="rank-name">{player.username} {socketRef.current?.id === player.id ? ' (你)' : ''}</span>
                      <span className="rank-score">{player.score} 分</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <Lobby onJoin={handleJoin} />
      )}

      <footer style={{ textAlign: 'center', padding: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-glass)', background: 'rgba(11, 15, 25, 0.5)' }}>
        Made with <Heart size={12} style={{ color: '#ef4444', display: 'inline', fill: '#ef4444' }} /> for Git & Docker School Project | CoDraw © 2026
      </footer>
    </div>
  );
}

export default App;
