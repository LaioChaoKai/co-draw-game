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
  animals: ["貓咪", "狗狗", "企鵝", "海豚", "大象"],
  food: ["珍珠奶茶", "披薩", "漢堡", "火鍋"],
  life: ["手機", "電腦", "馬桶", "雨傘"],
  school: ["鉛筆", "黑板", "書包", "考卷"]
};
try {
  const fileContent = fs.readFileSync(path.join(__dirname, 'words.json'), 'utf-8');
  wordsData = JSON.parse(fileContent);
  console.log('Words database loaded successfully.');
} catch (err) {
  console.error('Failed to load words.json, using fallback words:', err);
}

// Redis Integration
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
let redisClient = null;
let subClient = null;

try {
  redisClient = createClient({ url: REDIS_URL });
  subClient = redisClient.duplicate();
  
  redisClient.on('error', (err) => console.log('Redis Client Error', err));
  subClient.on('error', (err) => console.log('Redis Sub Client Error', err));

  await redisClient.connect();
  await subClient.connect();
  
  io.adapter(createAdapter(redisClient, subClient));
  console.log('Redis Adapter integrated successfully.');
} catch (err) {
  console.log('Redis not available, falling back to local memory adapter.');
}

// Local Room State Store
// structure: rooms[roomId] = { id, users: [{id, username, score, isDrawer, online}], game: { status, drawerId, word, category, timer, guessedUsers: [], round, totalRounds, history: [] }, intervalId }
const rooms = {};

// Get random word
function getRandomWord() {
  const categories = Object.keys(wordsData);
  const category = categories[Math.floor(Math.random() * categories.length)];
  const wordsList = wordsData[category];
  const word = wordsList[Math.floor(Math.random() * wordsList.length)];
  return { category, word };
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
    // Reset to lobby if not enough active players
    room.game.status = 'LOBBY';
    room.game.drawerId = null;
    room.game.word = '';
    room.game.category = '';
    room.game.timer = 0;
    room.game.history = [];
    io.to(roomId).emit('game_reset_lobby', {
      message: '線上玩家不足2人，遊戲返回大廳。',
      users: room.users
    });
    return;
  }

  // Rotate drawer
  let nextDrawerIndex = 0;
  const currentDrawerIndex = room.users.findIndex(u => u.id === room.game.drawerId);
  
  if (currentDrawerIndex !== -1) {
    // Try to find the next online player
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
    // Find first online player
    nextDrawerIndex = room.users.findIndex(u => u.online);
  }

  // Update drawers status
  room.users.forEach((u, idx) => {
    u.isDrawer = idx === nextDrawerIndex;
  });

  const activeDrawer = room.users[nextDrawerIndex];
  room.game.drawerId = activeDrawer.id;
  
  // Pick new word
  const { category, word } = getRandomWord();
  room.game.word = word;
  room.game.category = category;
  room.game.status = 'PLAYING';
  room.game.timer = 60; // 60 seconds per round
  room.game.guessedUsers = [];
  room.game.history = []; // Clear drawing history for new round

  io.to(roomId).emit('clear_canvas');
  io.to(roomId).emit('round_started', {
    drawerId: activeDrawer.id,
    drawerName: activeDrawer.username,
    category: category,
    timer: room.game.timer,
    users: room.users
  });

  // Send the word specifically to the drawer
  io.to(activeDrawer.id).emit('secret_word', { word: word });

  // Countdown timer
  room.intervalId = setInterval(() => {
    if (!rooms[roomId]) return;
    
    room.game.timer--;
    io.to(roomId).emit('timer_update', { timer: room.game.timer });

    if (room.game.timer <= 0) {
      endRound(roomId);
    }
  }, 1000);
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
          history: []
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
        online: true
      };
      room.users.push(user);
    }

    console.log(`User ${username} (${socket.id}) joined room ${roomId}`);

    // Emit updated user list to everyone
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

    // If currently playing, notify user of round info
    if (room.game.status === 'PLAYING') {
      socket.emit('round_started', {
        drawerId: room.game.drawerId,
        drawerName: room.users.find(u => u.id === room.game.drawerId)?.username || '畫家',
        category: room.game.category,
        timer: room.game.timer,
        users: room.users
      });
      // If this user is the drawer, send them the secret word
      if (user.isDrawer) {
        socket.emit('secret_word', { word: room.game.word });
      }
    }
  });

  // Real-time Drawing Events
  socket.on('draw', (drawData) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    
    // Safety check: only the drawer can draw in PLAYING state
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

      if (isCorrect) {
        if (isDrawer) {
          // Drawer cannot guess their own word
          socket.emit('system_message', { text: '❌ 你是畫家，不能猜答案喔！' });
          return;
        }
        if (alreadyGuessed) {
          socket.emit('system_message', { text: 'ℹ️ 你已經猜對囉，請等待其他玩家！' });
          return;
        }

        // Award points
        room.game.guessedUsers.push(socket.id);
        const guesserCount = room.game.guessedUsers.length;
        
        // Guesser points: 1st place gets 100, others get 70
        const pointsEarned = guesserCount === 1 ? 100 : 70;
        user.score += pointsEarned;

        // Drawer gets 20 points per correct guess (capped at 60)
        const drawer = room.users.find(u => u.id === room.game.drawerId);
        if (drawer && room.game.guessedUsers.length <= 3) {
          drawer.score += 20;
        }

        io.to(currentRoomId).emit('correct_guess', {
          userId: socket.id,
          username: user.username,
          points: pointsEarned,
          users: room.users
        });

        io.to(currentRoomId).emit('system_message', {
          text: `🎉 恭喜 ${user.username} 猜對了答案！ (+${pointsEarned}分)`
        });

        // Check if all active players (except drawer) have guessed
        const activeGuessers = room.users.filter(u => u.online && u.id !== room.game.drawerId);
        if (room.game.guessedUsers.length >= activeGuessers.length && activeGuessers.length > 0) {
          io.to(currentRoomId).emit('system_message', { text: '💡 所有人都猜對了！回合提早結束。' });
          endRound(currentRoomId);
        }
        return;
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
    
    // Only start if not already playing and has at least 2 online players
    const onlineUsers = room.users.filter(u => u.online);
    if (room.game.status === 'LOBBY' && onlineUsers.length >= 2) {
      // Reset all scores
      room.users.forEach(u => u.score = 0);
      io.to(currentRoomId).emit('system_message', { text: '🚀 遊戲開始！正在選取畫家...' });
      startNextRound(currentRoomId);
    } else {
      socket.emit('system_message', { text: '❌ 需要至少 2 位玩家在線上才能開始遊戲！' });
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

      // If drawer disconnected during play
      if (room.game.status === 'PLAYING' && socket.id === room.game.drawerId) {
        io.to(currentRoomId).emit('system_message', {
          text: '⚠️ 畫家中途離線，本回合提早結束。'
        });
        endRound(currentRoomId);
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`WebSocket server is running on port ${PORT}`);
});
