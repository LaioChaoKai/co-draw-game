import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Load words
let wordsData = {
  baby: ["貓咪", "狗狗", "企鵝", "海豚", "大象"],
  advanced: ["長頸鹿", "無尾熊", "變色龍", "洗衣機"],
  idiom: ["畫蛇添足", "對牛彈琴", "亡羊補牢"],
  meme: ["杰哥不要", "阿姨我不想努力了", "山道猴子"]
};
try {
  const fileContent = fs.readFileSync(path.join(__dirname, 'words.json'), 'utf-8');
  wordsData = JSON.parse(fileContent);
  console.log('Words database loaded successfully.');
} catch (err) {
  console.error('Failed to load words.json, using fallback words:', err);
}

// Redis Integration (with reconnect limit so Render free tier doesn't hang)
const REDIS_URL = process.env.REDIS_URL || null;
let redisClient = null;
let subClient = null;

if (REDIS_URL) {
  try {
    const socketOptions = {
      reconnectStrategy: (retries) => {
        if (retries > 2) {
          return new Error('Redis connection failed after 3 retries');
        }
        return 1000; // wait 1s between retries
      },
      connectTimeout: 5000
    };

    redisClient = createClient({ url: REDIS_URL, socket: socketOptions });
    subClient = redisClient.duplicate();
    
    redisClient.on('error', (err) => console.log('Redis Client Error', err));
    subClient.on('error', (err) => console.log('Redis Sub Client Error', err));

    await redisClient.connect();
    await subClient.connect();
    
    io.adapter(createAdapter(redisClient, subClient));
    console.log('Redis Adapter integrated successfully.');
  } catch (err) {
    console.log('Redis not available, falling back to local memory adapter:', err.message);
    redisClient = null;
    subClient = null;
  }
} else {
  console.log('No REDIS_URL set, using local memory adapter (single-server mode).');
}


// Local Room State Store
const rooms = {};

// Points configuration based on difficulty class
const pointsConfig = {
  baby: { guesser: 100, drawer: 50 },
  advanced: { guesser: 100, drawer: 100 },
  idiom: { guesser: 100, drawer: 150 },
  meme: { guesser: 200, drawer: 200 }
};

// Reset game back to lobby state
function resetGameToLobby(roomId, message) {
  const room = rooms[roomId];
  if (!room) return;

  if (room.intervalId) {
    clearInterval(room.intervalId);
    room.intervalId = null;
  }

  room.game.status = 'LOBBY';
  room.game.drawerId = null;
  room.game.word = '';
  room.game.category = '';
  room.game.timer = 0;
  room.game.history = [];
  room.game.round = 0;
  room.game.totalRounds = 0;
  room.game.guessedUsers = [];
  room.game.wordOptions = [];

  room.users.forEach(u => {
    u.isDrawer = false;
    u.hasAskedAi = false;
    u.guessesLeftAfterAi = null;
  });

  io.to(roomId).emit('game_reset_lobby', {
    message: message || '遊戲返回大廳。',
    users: room.users
  });
}

// End a round
function endRound(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  if (room.intervalId) {
    clearInterval(room.intervalId);
    room.intervalId = null;
  }

  room.game.status = 'ROUND_END';
  
  // Send notification about the answer
  io.to(roomId).emit('round_ended', {
    word: room.game.word,
    scores: room.users.map(u => ({ id: u.id, username: u.username, score: u.score }))
  });

  // Start next round after 5 seconds
  setTimeout(() => {
    startNextRound(roomId);
  }, 5000);
}

// Start next round in the game loop
function startNextRound(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const onlineUsers = room.users.filter(u => u.online);
  if (onlineUsers.length < 2) {
    resetGameToLobby(roomId, '線上玩家不足2人，遊戲返回大廳。');
    return;
  }

  // Increment round counter
  room.game.round = (room.game.round || 0) + 1;

  // Check if game is over
  if (room.game.round > room.game.totalRounds) {
    const leaderboard = [...room.users].sort((a, b) => b.score - a.score);
    io.to(roomId).emit('game_over', {
      users: room.users,
      leaderboard: leaderboard
    });

    // Reset to lobby after 10 seconds
    setTimeout(() => {
      resetGameToLobby(roomId, '遊戲結束，返回大廳。');
    }, 10000);
    return;
  }

  // Rotate drawer
  let nextDrawerIndex = 0;
  const currentDrawerIndex = room.users.findIndex(u => u.id === room.game.drawerId);
  
  if (currentDrawerIndex !== -1) {
    let found = false;
    for (let i = 1; i <= room.users.length; i++) {
      const idx = (currentDrawerIndex + i) % room.users.length;
      if (room.users[idx].online) {
        nextDrawerIndex = idx;
        found = true;
        break;
      }
    }
  } else {
    nextDrawerIndex = room.users.findIndex(u => u.online);
  }

  // Update drawers status & reset AI helper state
  room.users.forEach((u, idx) => {
    u.isDrawer = idx === nextDrawerIndex;
    u.hasAskedAi = false;
    u.guessesLeftAfterAi = null;
  });

  const activeDrawer = room.users[nextDrawerIndex];
  room.game.drawerId = activeDrawer.id;
  room.game.status = 'SELECTING_WORD';
  room.game.timer = 15; // 15 seconds to select difficulty and word
  room.game.guessedUsers = [];
  room.game.word = '';
  room.game.category = '';
  room.game.wordOptions = [];

  io.to(roomId).emit('clear_canvas');
  io.to(roomId).emit('round_selecting', {
    drawerId: activeDrawer.id,
    drawerName: activeDrawer.username,
    timer: room.game.timer,
    users: room.users,
    round: room.game.round
  });

  // Countdown timer for selection phase
  room.intervalId = setInterval(() => {
    if (!rooms[roomId]) return;
    
    room.game.timer--;
    io.to(roomId).emit('timer_update', { timer: room.game.timer });

    if (room.game.timer <= 0) {
      clearInterval(room.intervalId);
      room.intervalId = null;
      autoSelectWord(roomId);
    }
  }, 1000);
}

// Start playing phase
function startPlaying(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  if (room.intervalId) {
    clearInterval(room.intervalId);
    room.intervalId = null;
  }

  room.game.status = 'PLAYING';
  room.game.timer = 120; // 120 seconds per round
  room.game.guessedUsers = [];
  room.game.history = []; // Clear drawing history for new round

  room.users.forEach(u => {
    u.hasAskedAi = false;
    u.guessesLeftAfterAi = null;
  });

  const activeDrawer = room.users.find(u => u.id === room.game.drawerId);

  io.to(roomId).emit('clear_canvas');
  io.to(roomId).emit('round_started', {
    drawerId: room.game.drawerId,
    drawerName: activeDrawer ? activeDrawer.username : '畫家',
    category: room.game.category,
    wordLength: room.game.word.length,
    timer: room.game.timer,
    users: room.users
  });

  if (activeDrawer) {
    io.to(activeDrawer.id).emit('secret_word', { word: room.game.word });
  }

  // Countdown timer for playing phase
  room.intervalId = setInterval(() => {
    if (!rooms[roomId]) return;
    
    room.game.timer--;
    io.to(roomId).emit('timer_update', { timer: room.game.timer });

    if (room.game.timer <= 0) {
      clearInterval(room.intervalId);
      room.intervalId = null;
      endRound(roomId);
    }
  }, 1000);
}

// Auto selection if drawer times out during selection phase
function autoSelectWord(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  let selectedWord = '';
  let selectedCategory = '';

  if (room.game.wordOptions && room.game.wordOptions.length > 0) {
    const randomOption = room.game.wordOptions[Math.floor(Math.random() * room.game.wordOptions.length)];
    selectedWord = randomOption.word;
    selectedCategory = randomOption.category;
  } else {
    const categories = Object.keys(wordsData);
    selectedCategory = categories[Math.floor(Math.random() * categories.length)];
    const wordsList = wordsData[selectedCategory];
    selectedWord = wordsList[Math.floor(Math.random() * wordsList.length)];
  }

  room.game.word = selectedWord;
  room.game.category = selectedCategory;

  startPlaying(roomId);
}

// Check if round should end early (if all active guessers guessed correctly or exhausted their guesses)
function checkRoundEnd(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const activeGuessers = room.users.filter(u => u.online && u.id !== room.game.drawerId);
  if (activeGuessers.length === 0) return;

  const allFinished = activeGuessers.every(u => {
    const hasGuessed = room.game.guessedUsers.includes(u.id);
    const hasExhaustedGuesses = u.hasAskedAi && (u.guessesLeftAfterAi !== null && u.guessesLeftAfterAi <= 0);
    return hasGuessed || hasExhaustedGuesses;
  });

  if (allFinished) {
    io.to(roomId).emit('system_message', { text: '💡 所有玩家已猜對或用盡答題次數，回合提前結束。' });
    endRound(roomId);
  }
}

// Gemini API integration with retry logic (exponential backoff)
async function callGeminiWithRetry(promptText, base64Data, mimeType, apiKey, retries = 3, delay = 1000) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ]
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[AI] Calling Gemini API (attempt ${attempt}/${retries})...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return text;
        }
        throw new Error('Invalid response structure from Gemini API');
      }

      console.warn(`[AI] Gemini API returned status ${response.status} on attempt ${attempt}`);
      
      // Retry for transient status codes
      if (response.status === 429 || response.status >= 500) {
        if (attempt < retries) {
          const waitTime = delay * Math.pow(2, attempt - 1);
          console.log(`[AI] Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
      
      const errText = await response.text();
      throw new Error(`API error: ${response.status} - ${errText}`);
    } catch (err) {
      console.error(`[AI] Attempt ${attempt} failed:`, err.message);
      if (attempt === retries) {
        throw err;
      }
      const waitTime = delay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  let currentRoomId = null;
  let currentUserId = socket.id;

  // Join or Create Room
  socket.on('join_room', ({ roomId, username }) => {
    currentRoomId = roomId;
    socket.join(roomId);

    // Create room state if not exists
    if (!rooms[roomId]) {
      rooms[roomId] = {
        id: roomId,
        users: [],
        game: {
          status: 'LOBBY',
          drawerId: null,
          word: '',
          category: '',
          timer: 0,
          guessedUsers: [],
          history: [],
          round: 0,
          totalRounds: 0,
          wordOptions: []
        },
        intervalId: null
      };
    }

    const room = rooms[roomId];

    // Check if user already exists (e.g. reconnect)
    let user = room.users.find(u => u.username === username);
    if (user) {
      user.id = socket.id; // update ID to new socket ID
      user.online = true;
      currentUserId = socket.id;
    } else {
      user = {
        id: socket.id,
        username: username,
        score: 0,
        isDrawer: false,
        online: true,
        hasAskedAi: false,
        guessesLeftAfterAi: null
      };
      room.users.push(user);
    }

    console.log(`User ${username} (${socket.id}) joined room ${roomId}`);

    // Emit updated room details to everyone
    io.to(roomId).emit('room_data', {
      roomId,
      users: room.users,
      gameStatus: room.game.status,
      drawerId: room.game.drawerId,
      category: room.game.category,
      timer: room.game.timer,
      guessedUsers: room.game.guessedUsers
    });

    // Send drawing history to the newly joined user
    if (room.game.history && room.game.history.length > 0) {
      socket.emit('draw_history', room.game.history);
    }

    // System message
    io.to(roomId).emit('system_message', {
      text: `📢 ${username} 進入了遊戲房！`
    });

    // Handle ongoing game phase syncs
    if (room.game.status === 'PLAYING') {
      socket.emit('round_started', {
        drawerId: room.game.drawerId,
        drawerName: room.users.find(u => u.id === room.game.drawerId)?.username || '畫家',
        category: room.game.category,
        wordLength: room.game.word.length,
        timer: room.game.timer,
        users: room.users
      });
      if (user.isDrawer) {
        socket.emit('secret_word', { word: room.game.word });
      }
    } else if (room.game.status === 'SELECTING_WORD') {
      socket.emit('round_selecting', {
        drawerId: room.game.drawerId,
        drawerName: room.users.find(u => u.id === room.game.drawerId)?.username || '畫家',
        timer: room.game.timer,
        users: room.users,
        round: room.game.round
      });
      if (user.isDrawer && room.game.wordOptions && room.game.wordOptions.length > 0) {
        socket.emit('word_options', { options: room.game.wordOptions });
      }
    }
  });

  // Real-time Drawing Events
  socket.on('draw', (drawData) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    
    if (room.game.status === 'PLAYING' && socket.id !== room.game.drawerId) {
      return;
    }

    room.game.history.push(drawData);
    socket.to(currentRoomId).emit('draw', drawData);
  });

  // Clear Canvas
  socket.on('clear_canvas', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];

    if (room.game.status === 'PLAYING' && socket.id !== room.game.drawerId) {
      return;
    }

    room.game.history = [];
    io.to(currentRoomId).emit('clear_canvas');
  });

  // Select difficulty class (Drawer only, in SELECTING_WORD state)
  socket.on('select_class', ({ difficultyClass }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    
    if (room.game.status !== 'SELECTING_WORD' || socket.id !== room.game.drawerId) {
      return;
    }

    const wordsList = wordsData[difficultyClass];
    if (!wordsList) return;

    // Pick 3 unique random words
    const shuffled = [...wordsList].sort(() => 0.5 - Math.random());
    const selectedWords = shuffled.slice(0, 3);

    const options = selectedWords.map(w => ({
      word: w,
      category: difficultyClass
    }));

    room.game.wordOptions = options;
    socket.emit('word_options', { options });
  });

  // Select word (Drawer only, in SELECTING_WORD state)
  socket.on('select_word', ({ word }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];

    if (room.game.status !== 'SELECTING_WORD' || socket.id !== room.game.drawerId) {
      return;
    }

    const option = room.game.wordOptions?.find(opt => opt.word === word);
    if (!option) return;

    room.game.word = option.word;
    room.game.category = option.category;

    startPlaying(currentRoomId);
  });

  // Chat message / Guess word
  socket.on('chat_message', (text) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    const user = room.users.find(u => u.id === socket.id);
    if (!user) return;

    const trimmedText = text.trim();
    if (!trimmedText) return;

    // Check if it's a guess in PLAYING state
    if (room.game.status === 'PLAYING') {
      const isDrawer = socket.id === room.game.drawerId;
      const alreadyGuessed = room.game.guessedUsers.includes(socket.id);
      const isCorrect = trimmedText.toLowerCase() === room.game.word.toLowerCase();

      if (isDrawer) {
        socket.emit('system_message', { text: '❌ 你是畫家，不能在聊天室發言或猜答案喔！' });
        return;
      }

      // Check guess limit if they asked AI
      if (user.hasAskedAi && (user.guessesLeftAfterAi !== null && user.guessesLeftAfterAi <= 0)) {
        socket.emit('system_message', { text: '❌ 你已用盡本回合唯一一次作答機會！' });
        return;
      }

      if (isCorrect) {
        if (alreadyGuessed) {
          socket.emit('system_message', { text: 'ℹ️ 你已經猜對囉，請等待其他玩家！' });
          return;
        }

        // Award points based on class
        room.game.guessedUsers.push(socket.id);
        
        const category = room.game.category;
        const config = pointsConfig[category] || { guesser: 100, drawer: 50 };
        
        user.score += config.guesser;
        const drawer = room.users.find(u => u.id === room.game.drawerId);
        if (drawer) {
          drawer.score += config.drawer;
        }

        io.to(currentRoomId).emit('correct_guess', {
          userId: socket.id,
          username: user.username,
          points: config.guesser,
          users: room.users
        });

        io.to(currentRoomId).emit('system_message', {
          text: `🎉 恭喜 ${user.username} 猜對了答案！ (+${config.guesser}分)`
        });

        // Sync room data to update guessed list
        io.to(currentRoomId).emit('room_data', {
          roomId: currentRoomId,
          users: room.users,
          gameStatus: room.game.status,
          drawerId: room.game.drawerId,
          category: room.game.category,
          timer: room.game.timer,
          guessedUsers: room.game.guessedUsers
        });

        // Check if all players guessed or failed
        checkRoundEnd(currentRoomId);
        return;
      } else {
        // Incorrect guess
        if (user.hasAskedAi && user.guessesLeftAfterAi !== null) {
          user.guessesLeftAfterAi--;
          
          // Sync room data to update input locked state immediately
          io.to(currentRoomId).emit('room_data', {
            roomId: currentRoomId,
            users: room.users,
            gameStatus: room.game.status,
            drawerId: room.game.drawerId,
            category: room.game.category,
            timer: room.game.timer,
            guessedUsers: room.game.guessedUsers
          });

          if (user.guessesLeftAfterAi <= 0) {
            socket.emit('system_message', { text: '❌ 猜錯了！你已用盡本回合唯一的作答機會。' });
            checkRoundEnd(currentRoomId);
          } else {
            socket.emit('system_message', { text: `❌ 猜錯了！剩餘 ${user.guessesLeftAfterAi} 次作答機會。` });
          }
        }
      }
    }

    // Normal chat broadcast
    io.to(currentRoomId).emit('chat_message', {
      userId: socket.id,
      username: user.username,
      text: trimmedText
    });
  });

  // Start Game Trigger
  socket.on('start_game', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    
    const onlineUsers = room.users.filter(u => u.online);
    if (room.game.status === 'LOBBY' && onlineUsers.length >= 2) {
      // Reset all scores and game variables
      room.users.forEach(u => {
        u.score = 0;
        u.isDrawer = false;
        u.hasAskedAi = false;
        u.guessesLeftAfterAi = null;
      });
      room.game.round = 0;
      room.game.totalRounds = 10; // Fixed 10 rounds per game

      
      io.to(currentRoomId).emit('system_message', { text: '🚀 遊戲開始！正在選取畫家...' });
      startNextRound(currentRoomId);
    } else {
      socket.emit('system_message', { text: '❌ 需要至少 2 位玩家在線上才能開始遊戲！' });
    }
  });

  // AI Q&A Assistant socket event handler
  socket.on('ask_ai', async ({ question, image, geminiKey }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    
    if (room.game.status !== 'PLAYING') {
      socket.emit('system_message', { text: '❌ 目前不是遊戲進行階段，無法使用 AI 功能。' });
      return;
    }

    const user = room.users.find(u => u.id === socket.id);
    if (!user) return;

    if (user.isDrawer) {
      socket.emit('system_message', { text: '❌ 你是畫家，本回合不能使用 AI 助手功能！' });
      return;
    }

    if (user.hasAskedAi) {
      socket.emit('system_message', { text: '❌ 每回合只能提問 AI 一次！' });
      return;
    }

    // Validate that a key was actually provided
    const apiKey = geminiKey ? geminiKey.trim() : null;
    if (!apiKey) {
      socket.emit('system_message', { text: '❌ 請先在大廳輸入你的 Gemini API Key 才能使用 AI 功能！' });
      return;
    }

    user.hasAskedAi = true;
    user.guessesLeftAfterAi = 1; // 1 guess allowed after asking AI
    
    // Sync room data to update UI buttons immediately
    io.to(currentRoomId).emit('room_data', {
      roomId: currentRoomId,
      users: room.users,
      gameStatus: room.game.status,
      drawerId: room.game.drawerId,
      category: room.game.category,
      timer: room.game.timer,
      guessedUsers: room.game.guessedUsers
    });

    // Broadcast thinking state
    io.to(currentRoomId).emit('ai_thinking', {
      username: user.username,
      question: question
    });

    try {
      const base64Data = image.split(',')[1];
      const mimeType = image.split(';')[0].split(':')[1] || 'image/png';

      const wordLen = room.game.word.length;
      const promptText = `你是一個實時「你畫我猜」遊戲的 AI 畫布助手。你完全不知道正確答案是什麼，你只能根據畫布圖案和問題來推斷。
目前遊戲狀態：
- 答案字數：${wordLen} 個字（這是你唯一知道的線索）
- 發問者：${user.username}（猜題者）
- 發問者的問題：「${question}」

請根據畫家在畫布上畫出的圖案（附帶圖片）來回答。

必須遵守的嚴格規則：
1. 【看不懂模式】：如果畫布是空白的、極度不完整、或根本看不出在畫什麼，你必須判定為「看不懂」。此時，你的回答必須以「【看不懂】」開頭，並用搞笑毒舌的台灣流行語（笑死、到底在畫三小、可憐啊、無情、超派）來吐槽嘲諷畫家。
2. 如果畫布可以看懂，給出你對畫布內容的主觀猜測或模糊描述，幫助發問者縮小範圍，但不要直接說出你猜到的詞。
3. 你可以提示「答案是 ${wordLen} 個字」。
4. 回答必須是正體中文，簡短有力（50字以內），語氣要像個鬼靈精的搞笑助手。`;

      const responseText = await callGeminiWithRetry(promptText, base64Data, mimeType, apiKey);

      console.log(`[AI Response] Requester: ${user.username}, Answer: ${responseText}`);

      if (responseText.includes('【看不懂】')) {
        io.to(currentRoomId).emit('ai_response', {
          username: user.username,
          answer: responseText
        });
      } else {
        socket.emit('ai_response', {
          username: user.username,
          answer: responseText
        });
        socket.to(currentRoomId).emit('ai_private_done', {
          username: user.username
        });
      }
    } catch (err) {
      console.error('[AI Error]', err);
      socket.emit('system_message', {
        text: `❌ AI 服務暫時無法使用：${err.message || '未知錯誤'}`
      });
      io.to(currentRoomId).emit('ai_private_done', { username: user.username });
    }
  });

  // Disconnection handler
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    if (!currentRoomId || !rooms[currentRoomId]) return;

    const room = rooms[currentRoomId];
    const userIndex = room.users.findIndex(u => u.id === socket.id);
    
    if (userIndex !== -1) {
      const user = room.users[userIndex];
      user.online = false; // Mark user offline
      
      io.to(currentRoomId).emit('system_message', {
        text: `💤 ${user.username} 斷開了連線。`
      });

      // Update room user list
      io.to(currentRoomId).emit('user_left', {
        userId: socket.id,
        users: room.users
      });

      const onlineUsers = room.users.filter(u => u.online);

      // Clean up room if empty
      if (onlineUsers.length === 0) {
        if (room.intervalId) {
          clearInterval(room.intervalId);
        }
        delete rooms[currentRoomId];
        console.log(`Room ${currentRoomId} is empty. Deleted room state.`);
        return;
      }

      // If drawer disconnected during play or selection
      if ((room.game.status === 'PLAYING' || room.game.status === 'SELECTING_WORD') && socket.id === room.game.drawerId) {
        io.to(currentRoomId).emit('system_message', {
          text: '⚠️ 畫家中途離線，本回合提早結束。'
        });
        endRound(currentRoomId);
      } else {
        // If guesser disconnected, check if remaining players have finished guessing
        checkRoundEnd(currentRoomId);
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`WebSocket server is running on port ${PORT}`);
});
