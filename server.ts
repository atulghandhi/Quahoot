import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Server } from 'socket.io';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  const PORT = 3000;

  // Real-time Game State
  const games = new Map<string, any>(); // Map code -> state

  function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  io.on('connection', (socket) => {
    // --- Host actions ---
    socket.on('create_game', ({ questions }) => {
      const code = generateCode();
      games.set(code, {
        code,
        status: 'lobby',
        hostId: socket.id,
        players: {},
        questions,
        currentQuestionIndex: 0,
        questionStartTime: null,
      });
      socket.join(`game-${code}`);
      socket.join(`host-${code}`);
      socket.emit('game_created', { code });
      io.to(`game-${code}`).emit('game_state', games.get(code));
    });

    socket.on('start_game', ({ code }) => {
      const game = games.get(code);
      if (!game || game.hostId !== socket.id) return;
      game.status = 'countdown';
      
      for (const pId in game.players) {
        game.players[pId].hasAnswered = false;
        game.players[pId].lastAnswerCorrect = false;
        game.players[pId].lastScoreAdded = 0;
      }

      io.to(`game-${code}`).emit('game_state', game);
      
      let count = 3;
      const interval = setInterval(() => {
        count--;
        io.to(`game-${code}`).emit('countdown', count);
        if (count === 0) {
          clearInterval(interval);
          game.status = 'question_active';
          game.questionStartTime = Date.now();
          io.to(`game-${code}`).emit('game_state', game);
        }
      }, 1000);
    });

    socket.on('next_question', ({ code }) => {
      const game = games.get(code);
      if (!game || game.hostId !== socket.id) return;
      
      game.currentQuestionIndex++;
      
      // Reset player answer states
      for (const pId in game.players) {
        game.players[pId].hasAnswered = false;
        game.players[pId].lastAnswerCorrect = false;
        game.players[pId].lastScoreAdded = 0;
      }

      if (game.currentQuestionIndex >= game.questions.length) {
        game.status = 'podium';
        io.to(`game-${code}`).emit('game_state', game);
      } else {
        game.status = 'countdown';
        io.to(`game-${code}`).emit('game_state', game);
        
        let count = 3;
        const interval = setInterval(() => {
          count--;
          io.to(`game-${code}`).emit('countdown', count);
          if (count === 0) {
            clearInterval(interval);
            game.status = 'question_active';
            game.questionStartTime = Date.now();
            io.to(`game-${code}`).emit('game_state', game);
          }
        }, 1000);
      }
    });

    socket.on('show_leaderboard', ({ code }) => {
      const game = games.get(code);
      if (!game || game.hostId !== socket.id) return;
      game.status = 'leaderboard';
      io.to(`game-${code}`).emit('game_state', game);
    });

    socket.on('end_game', ({ code }) => {
       const game = games.get(code);
       if (!game || game.hostId !== socket.id) return;
       game.status = 'podium';
       io.to(`game-${code}`).emit('game_state', game);
    });


    // --- Player actions ---
    socket.on('join_game', ({ code, name }) => {
      const game = games.get(code);
      if (!game || game.status !== 'lobby') {
        socket.emit('error', 'Game not found or already started');
        return;
      }
      const playerId = socket.id;
      game.players[playerId] = { id: playerId, name, score: 0, lastScoreAdded: 0, hasAnswered: false, lastAnswerCorrect: false };
      socket.join(`game-${code}`);
      io.to(`game-${code}`).emit('game_state', game);
      socket.emit('joined', { playerId, code });
    });

    socket.on('submit_answer', ({ code, answerIndex }) => {
      const game = games.get(code);
      const playerId = socket.id;
      if (!game || game.status !== 'question_active') return;
      if (!game.players[playerId] || game.players[playerId].hasAnswered) return;
      
      const q = game.questions[game.currentQuestionIndex];
      const elapsed = Date.now() - (game.questionStartTime || Date.now());
      const maxTime = (q.timeLimit || 20) * 1000;
      
      let points = 0;
      let correct = false;
      if (answerIndex === q.correctIndex) {
        correct = true;
        // Max 100 points, decreased by time taken
        const ratio = Math.max(0, maxTime - elapsed) / maxTime;
        points = Math.floor(ratio * 100) + 10; // min 10 points for correct
        if (points > 100) points = 100;
      }
      
      game.players[playerId].hasAnswered = true;
      game.players[playerId].lastAnswerCorrect = correct;
      game.players[playerId].lastScoreAdded = points;
      game.players[playerId].score += points;
      
      socket.emit('answer_result', { correct, points });
      io.to(`game-${code}`).emit('game_state', game);
    });

    socket.on('disconnect', () => {
      // Basic cleanup (in real-world would be more robust)
      for (const [code, game] of games.entries()) {
        if (game.hostId === socket.id) {
          game.status = 'ended';
          io.to(`game-${code}`).emit('game_state', game);
          games.delete(code);
        } else if (game.players[socket.id]) {
          delete game.players[socket.id];
          io.to(`game-${code}`).emit('game_state', game);
        }
      }
    });
  });

  // API middleware
  app.use(express.json());
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
