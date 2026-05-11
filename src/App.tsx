import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, Question, cn } from './types';
import conf from 'canvas-confetti';
import { Trophy, Medal, Play, Users, Check, X, Timer, Copy, MedalIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const socket: Socket = io('/', { transports: ['websocket'] }); // Connects to the same host/port

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [view, setView] = useState<'home' | 'create' | 'join'>('home');
  const [role, setRole] = useState<'none' | 'host' | 'player'>('none');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(3);
  const [answerResult, setAnswerResult] = useState<{correct: boolean, points: number} | null>(null);

  // Connection handling
  useEffect(() => {
    socket.on('game_state', (state: GameState) => {
      setGameState(state);
    });

    socket.on('countdown', (count: number) => {
      setCountdown(count);
    });

    socket.on('game_created', ({ code }: { code: string }) => {
      setRole('host');
      setView('home'); // or lobby, but game_state will render lobby
    });

    socket.on('joined', ({ playerId, code }: { playerId: string, code: string }) => {
      setRole('player');
      setPlayerId(playerId);
      setView('home');
    });

    socket.on('answer_result', (res: {correct: boolean, points: number}) => {
      setAnswerResult(res);
      if (res.correct) {
        conf({
          particleCount: 50,
          spread: 60,
          colors: ['#22c55e', '#ffffff']
        });
      }
    });

    return () => {
      socket.off('game_state');
      socket.off('countdown');
      socket.off('game_created');
      socket.off('joined');
      socket.off('answer_result');
    };
  }, []);

  if (!gameState) {
    if (view === 'home') {
      return (
        <div className="min-h-screen bg-[#46178F] relative overflow-hidden font-sans flex flex-col items-center justify-center p-4">
          <div className="absolute -top-20 -left-20 w-[400px] h-[400px] bg-pink-500 rounded-full mix-blend-multiply filter blur-[80px] opacity-30 pointer-events-none"></div>
          <div className="absolute top-40 -right-20 w-[500px] h-[500px] bg-blue-500 rounded-full mix-blend-screen filter blur-[100px] opacity-40 pointer-events-none"></div>
          <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-teal-400 rounded-full mix-blend-overlay filter blur-[120px] opacity-20 pointer-events-none"></div>

          <motion.div initial={{ scale: 0.9, y: -20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} className="flex flex-col items-center z-10">
            <div className="w-32 h-32 bg-white flex items-center justify-center rounded-3xl rotate-3 shadow-2xl mb-6 border-b-8 border-gray-200">
               <span className="text-[#46178F] font-black text-7xl">Q!</span>
            </div>
            <h1 className="text-6xl md:text-8xl text-white mb-12 font-black tracking-tight drop-shadow-sm text-center">
              Let's play!
            </h1>
          </motion.div>
          
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="w-full max-w-sm flex flex-col gap-4 z-10 backdrop-blur-xl bg-white/10 border border-white/20 p-8 rounded-3xl shadow-2xl">
            <button 
              onClick={() => setView('join')}
              className="bg-white text-[#46178F] text-2xl font-black flex items-center justify-center gap-3 py-4 px-6 rounded-xl shadow-[0_6px_0_#d8b4fe] hover:bg-gray-50 active:translate-y-[6px] active:shadow-none transition-all w-full border border-gray-200"
            >
              Enter Game PIN
            </button>
            
            <div className="relative flex items-center py-4">
              <div className="flex-grow border-t border-white/30"></div>
              <span className="flex-shrink-0 mx-4 text-white/60 font-bold uppercase tracking-widest text-sm">OR</span>
              <div className="flex-grow border-t border-white/30"></div>
            </div>

            <button 
              onClick={() => setView('create')}
              className="bg-purple-600 border border-purple-500 text-white text-xl font-bold flex items-center justify-center gap-3 py-4 px-6 rounded-xl shadow-[0_4px_15px_rgba(147,51,234,0.4)] hover:bg-purple-500 active:translate-y-[2px] active:scale-[0.98] transition-all w-full"
            >
              Host a Game <Play size={18} className="fill-white" />
            </button>
          </motion.div>
        </div>
      );
    }
    
    if (view === 'join') {
      return <JoinGame />;
    }

    if (view === 'create') {
      return <CreateGame />;
    }
  }

  // Active game rendering
  return (
    <div className="min-h-screen font-sans bg-gray-100 flex flex-col">
      {gameState?.status === 'lobby' && <Lobby state={gameState} role={role} />}
      {gameState?.status === 'countdown' && <CountdownView count={countdown} />}
      {gameState?.status === 'question_active' && <QuestionView state={gameState} role={role} playerId={playerId} answerResult={answerResult} />}
      {gameState?.status === 'leaderboard' && <Leaderboard state={gameState} role={role} />}
      {gameState?.status === 'podium' && <Podium state={gameState} />}
    </div>
  );
}

function JoinGame() {
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin && name) {
      socket.emit('join_game', { code: pin, name });
    }
  };

  return (
    <div className="min-h-screen bg-[#46178F] relative overflow-hidden font-sans flex flex-col items-center justify-center p-4">
      <div className="absolute -top-20 -left-20 w-[400px] h-[400px] bg-pink-500 rounded-full mix-blend-multiply filter blur-[80px] opacity-30 pointer-events-none"></div>
      <div className="absolute top-40 -right-20 w-[500px] h-[500px] bg-blue-500 rounded-full mix-blend-screen filter blur-[100px] opacity-40 pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl z-10"
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-white flex items-center justify-center rounded-2xl rotate-3 shadow-lg">
            <span className="text-[#46178F] font-black text-4xl">Q!</span>
          </div>
        </div>
        
        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <input 
            type="text" 
            placeholder="Game PIN" 
            className="w-full text-center text-xl font-bold p-4 bg-white/80 border border-white/50 rounded-xl focus:border-white focus:bg-white focus:ring-4 focus:ring-white/20 outline-none text-gray-800 placeholder-gray-500 transition-all shadow-inner"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            maxLength={6}
          />
          <input 
            type="text" 
            placeholder="Nickname" 
            className="w-full text-center text-xl font-bold p-4 bg-white/80 border border-white/50 rounded-xl focus:border-white focus:bg-white focus:ring-4 focus:ring-white/20 outline-none text-gray-800 placeholder-gray-500 transition-all shadow-inner"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={15}
          />
          <button 
            type="submit"
            className="w-full mt-4 bg-gray-900 border border-white/10 text-white text-xl font-black py-4 rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.5)] hover:bg-black active:translate-y-[2px] active:scale-[0.98] active:shadow-none transition-all flex items-center justify-center gap-2"
          >
            Enter Options <Play size={20} className="fill-white" />
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function CreateGame() {
  const [questions, setQuestions] = useState<Question[]>([
    { id: '1', text: 'What is 2 + 2?', options: ['3', '4', '5', '6'], correctIndex: 1, timeLimit: 20 }
  ]);

  const addQuestion = () => {
    setQuestions([...questions, { id: Math.random().toString(), text: '', options: ['', '', '', ''], correctIndex: 0, timeLimit: 20 }]);
  };

  const startHosting = () => {
    socket.emit('create_game', { questions });
  };

  return (
    <div className="min-h-screen bg-[#46178F] relative font-sans text-white pb-20">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-pink-500 mix-blend-multiply filter blur-[100px] opacity-30"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-blue-500 mix-blend-screen filter blur-[120px] opacity-40"></div>
      </div>

      <nav className="sticky top-0 z-20 backdrop-blur-xl bg-white/10 border-b border-white/20 px-8 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white flex items-center justify-center rounded-lg shadow-md rotate-3">
             <span className="text-[#46178F] font-black text-xl">Q!</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight drop-shadow-sm">HOST GAME</h1>
        </div>
        <button 
          onClick={startHosting}
          className="bg-emerald-500 border border-white/20 text-white font-bold py-3 px-8 rounded-xl shadow-[0_4px_15px_rgba(16,185,129,0.4)] hover:bg-emerald-400 active:translate-y-[2px] active:scale-[0.98] transition-all flex items-center gap-2"
        >
          Start Hosting <Play size={20} className="fill-white" />
        </button>
      </nav>

      <div className="max-w-4xl mx-auto mt-12 px-6 relative z-10 space-y-8">
        {questions.map((q, qIndex) => (
          <div key={q.id} className="backdrop-blur-xl bg-white/10 border border-white/20 p-8 rounded-3xl shadow-xl transition-all hover:bg-white/15">
            <input 
              type="text" 
              placeholder="Start typing your question" 
              className="w-full text-3xl font-black bg-transparent border-b-2 border-white/20 focus:border-white outline-none mb-8 pb-4 text-center placeholder-white/40 transition-colors"
              value={q.text}
              onChange={(e) => {
                const newQ = [...questions];
                newQ[qIndex].text = e.target.value;
                setQuestions(newQ);
              }}
            />
            
            <div className="grid grid-cols-2 gap-6">
              {q.options.map((opt, oIndex) => (
                <div key={oIndex} className={`relative flex items-center p-4 rounded-xl shadow-inner border border-white/30 backdrop-blur-md overflow-hidden ${oIndex === 0 ? 'bg-red-500/40' : oIndex === 1 ? 'bg-blue-500/40' : oIndex === 2 ? 'bg-yellow-500/40' : 'bg-emerald-500/40'}`}>
                   <button 
                     onClick={() => {
                        const newQ = [...questions];
                        newQ[qIndex].correctIndex = oIndex;
                        setQuestions(newQ);
                     }}
                     className={`absolute right-4 w-8 h-8 rounded-full border-4 flex items-center justify-center transition-all ${q.correctIndex === oIndex ? 'bg-emerald-500 border-white scale-110 shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 'border-white/40 hover:border-white hover:bg-white/20'}`}
                   >
                     {q.correctIndex === oIndex && <Check size={16} strokeWidth={4} className="text-white" />}
                   </button>
                   <input 
                    type="text" 
                    placeholder={`Answer ${oIndex + 1}`}
                    className="w-full bg-transparent font-bold text-xl outline-none placeholder-white/60 pr-12 drop-shadow-sm"
                    value={opt}
                    onChange={(e) => {
                      const newQ = [...questions];
                      newQ[qIndex].options[oIndex] = e.target.value;
                      setQuestions(newQ);
                    }}
                  />
                </div>
              ))}
            </div>
            
            <div className="mt-8 pt-4 border-t border-white/20 flex justify-between items-center">
              <span className="text-white/60 font-bold uppercase tracking-widest text-sm">Question {qIndex + 1}</span>
              <div className="flex items-center gap-3 bg-black/20 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/5">
                <Timer size={20} className="text-white/70" />
                <span className="font-bold text-white/90">Time Limit</span>
                <select 
                  className="bg-white/10 font-black px-3 py-1 rounded text-white border border-white/20 outline-none hover:bg-white/20 transition-colors"
                  value={q.timeLimit}
                  onChange={(e) => {
                    const newQ = [...questions];
                    newQ[qIndex].timeLimit = Number(e.target.value);
                    setQuestions(newQ);
                  }}
                >
                  <option value={10} className="text-black">10s</option>
                  <option value={20} className="text-black">20s</option>
                  <option value={30} className="text-black">30s</option>
                  <option value={60} className="text-black">60s</option>
                </select>
              </div>
            </div>
          </div>
        ))}
        
        <button 
          onClick={addQuestion}
          className="w-full py-8 backdrop-blur-sm bg-white/5 border-2 border-dashed border-white/30 rounded-3xl text-white/70 font-black text-2xl hover:bg-white/10 hover:text-white transition-all shadow-sm flex items-center justify-center gap-3"
        >
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">+</div>
          Add Question
        </button>
      </div>
    </div>
  );
}

function Lobby({ state, role }: { state: GameState, role: 'host' | 'player' | 'none' }) {
  const playersList = Object.values(state.players);

  return (
    <div className="min-h-screen bg-[#46178F] relative overflow-hidden font-sans text-white flex flex-col">
      <div className="absolute -top-20 -left-20 w-[400px] h-[400px] bg-pink-500 rounded-full mix-blend-multiply filter blur-[80px] opacity-30 pointer-events-none"></div>
      <div className="absolute top-40 -right-20 w-[500px] h-[500px] bg-blue-500 rounded-full mix-blend-screen filter blur-[100px] opacity-40 pointer-events-none"></div>
      <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-teal-400 rounded-full mix-blend-overlay filter blur-[120px] opacity-20 pointer-events-none"></div>

      <nav className="relative z-10 backdrop-blur-xl bg-white/10 border-b border-white/20 px-8 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white flex items-center justify-center rounded-lg shadow-md rotate-3">
             <span className="text-[#46178F] font-black text-xl">Q!</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight drop-shadow-sm">WAITING ROOM</h1>
        </div>
        {role === 'host' && (
          <button 
            onClick={() => socket.emit('start_game', { code: state.code })}
            className="bg-emerald-500 border border-white/20 text-white font-bold py-3 px-8 rounded-xl shadow-[0_4px_15px_rgba(16,185,129,0.4)] hover:bg-emerald-400 active:translate-y-[2px] active:scale-[0.98] transition-all flex items-center gap-2"
          >
            Start Game <Play size={20} className="fill-white" />
          </button>
        )}
      </nav>
      
      <main className="flex-grow z-10 flex flex-col items-center justify-center p-8">
        <div className="text-center mb-16">
          <p className="text-white/80 text-xl font-bold mb-4 uppercase tracking-widest drop-shadow-sm">Join with Game PIN</p>
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 inline-block px-16 py-6 rounded-3xl shadow-2xl">
            <h1 className="text-7xl md:text-9xl font-black tracking-widest drop-shadow-lg scale-y-110" style={{ letterSpacing: '0.1em' }}>{state.code}</h1>
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-6 max-w-5xl w-full">
           <div className="flex items-center gap-3 bg-black/20 px-6 py-2 rounded-full border border-white/10">
              <Users className="text-white/80" size={20} />
              <span className="text-white font-bold text-xl">{playersList.length} Players</span>
           </div>

           <div className="flex flex-wrap items-center justify-center gap-4 w-full">
            <AnimatePresence>
              {playersList.map(p => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.5, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  key={p.id} 
                  className="text-xl font-bold bg-white text-[#46178F] px-6 py-3 rounded-xl shadow-lg border-b-4 border-gray-300"
                >
                  {p.name}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

function CountdownView({ count }: { count: number }) {
  return (
    <div className="min-h-screen bg-[#46178F] relative overflow-hidden font-sans flex items-center justify-center">
      <div className="absolute -top-20 -left-20 w-[400px] h-[400px] bg-pink-500 rounded-full mix-blend-multiply filter blur-[80px] opacity-30 pointer-events-none"></div>
      <div className="absolute top-40 -right-20 w-[500px] h-[500px] bg-blue-500 rounded-full mix-blend-screen filter blur-[100px] opacity-40 pointer-events-none"></div>

      <motion.div
        key={count}
        initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        exit={{ scale: 1.5, opacity: 0, rotate: 10 }}
        className="w-64 h-64 md:w-96 md:h-96 rounded-full backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl flex items-center justify-center z-10 box-border"
      >
        <h1 className="text-white text-[15vw] md:text-[8rem] font-black drop-shadow-2xl">{count}</h1>
      </motion.div>
    </div>
  );
}

function QuestionView({ state, role, playerId, answerResult }: { state: GameState, role: string, playerId: string | null, answerResult: any }) {
  const q = state.questions[state.currentQuestionIndex];
  const [timeLeft, setTimeLeft] = useState(q.timeLimit);
  
  useEffect(() => {
    const elapsed = Date.now() - (state.questionStartTime || Date.now());
    let remaining = Math.max(0, q.timeLimit - Math.floor(elapsed / 1000));
    setTimeLeft(remaining);

    const int = setInterval(() => {
      const el = Date.now() - (state.questionStartTime || Date.now());
      const r = Math.max(0, q.timeLimit - Math.floor(el / 1000));
      setTimeLeft(r);
      if (r <= 0) {
        clearInterval(int);
        if (role === 'host') {
           setTimeout(() => socket.emit('show_leaderboard', { code: state.code }), 2000);
        }
      }
    }, 1000);
    return () => clearInterval(int);
  }, [state.questionStartTime, q.timeLimit, role, state.code]);

  const shapeClasses = [
    "bg-red-500",
    "bg-blue-500",
    "bg-yellow-500",
    "bg-emerald-500"
  ];

  const shapeBorders = [
    "border-red-400",
    "border-blue-400",
    "border-yellow-400",
    "border-emerald-400"
  ];

  const SVGS = [
    <svg viewBox="0 0 100 100" className="fill-white w-10 h-10 md:w-16 md:h-16 drop-shadow-md"><polygon points="50,15 100,100 0,100"/></svg>,
    <svg viewBox="0 0 100 100" className="fill-white w-10 h-10 md:w-16 md:h-16 drop-shadow-md"><polygon points="50,0 100,50 50,100 0,50"/></svg>,
    <svg viewBox="0 0 100 100" className="fill-white w-10 h-10 md:w-16 md:h-16 drop-shadow-md"><circle cx="50" cy="50" r="40"/></svg>,
    <svg viewBox="0 0 100 100" className="fill-white w-10 h-10 md:w-16 md:h-16 drop-shadow-md"><rect x="15" y="15" width="70" height="70"/></svg>,
  ];

  if (role === 'player') {
    const myPlayer = playerId ? state.players[playerId] : null;
    const answered = myPlayer?.hasAnswered;

    if (answered && answerResult) {
      return (
        <div className={cn("min-h-screen flex flex-col items-center justify-center p-6 text-white text-center font-sans", answerResult.correct ? "bg-[#22c55e]" : "bg-[#ef4444]")}>
           <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: answerResult.correct ? 360 : 0 }}>
             {answerResult.correct ? 
                <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/40 shadow-2xl">
                    <Check size={80} strokeWidth={4} className="text-white drop-shadow-lg" />
                </div> 
                : 
                <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/40 shadow-2xl">
                    <X size={80} strokeWidth={4} className="text-white drop-shadow-lg" />
                </div>
             }
           </motion.div>
           <h1 className="text-6xl font-black mt-8 text-white drop-shadow-md tracking-tight">
             {answerResult.correct ? "Correct!" : "Incorrect"}
           </h1>
           <div className="mt-8 bg-black/20 backdrop-blur-md px-8 py-4 rounded-2xl flex items-center gap-4 border border-white/10 shadow-lg">
             <span className="text-xl font-bold opacity-80 uppercase tracking-widest gap-2">Points</span>
             <span className="text-4xl font-black">+{answerResult.points}</span>
           </div>
           {answerResult.correct && (
             <div className="mt-6 text-lg font-bold bg-white/20 px-6 py-3 rounded-full border border-white/30 backdrop-blur-md shadow-inner">
               Current Score: {myPlayer?.score}
             </div>
           )}
           <p className="mt-auto text-xl font-bold opacity-80 mb-8 bg-black/10 px-6 py-2 rounded-full">Waiting for next question...</p>
        </div>
      );
    }
    
    if (answered && !answerResult) {
       return (
         <div className="min-h-screen bg-[#46178F] relative overflow-hidden font-sans flex flex-col items-center justify-center p-6 text-white text-center">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-white rounded-full mix-blend-overlay filter blur-[100px] opacity-20 pointer-events-none"></div>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: "linear" }} className="mb-8 opacity-80">
                <SpinnerIcon className="w-20 h-20" />
            </motion.div>
            <h1 className="text-4xl font-black drop-shadow-sm tracking-tight opacity-90">Waiting for others...</h1>
         </div>
       );
    }

    if (timeLeft <= 0) {
      return (
        <div className="min-h-screen bg-gray-900 border-t-8 border-gray-700 relative overflow-hidden font-sans flex flex-col items-center justify-center text-white p-6">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-red-500/20 rounded-full mix-blend-overlay filter blur-[100px] pointer-events-none"></div>
            <Timer size={80} className="mb-6 opacity-80 text-gray-400" />
            <h1 className="text-5xl font-black tracking-tight drop-shadow-md">Time's Up!</h1>
        </div>
      );
    }

    return (
      <div className="min-h-[100dvh] bg-[#f2f2f2] font-sans flex flex-col">
        <div className="bg-white p-6 md:p-8 shadow-sm text-center relative flex-shrink-0 z-10 border-b border-gray-200">
          <h2 className="text-2xl md:text-3xl font-black text-gray-800 drop-shadow-sm leading-tight max-w-4xl mx-auto">{q.text}</h2>
        </div>
        
        <div className="bg-gray-100 flex-grow grid grid-cols-2 grid-rows-2 gap-3 md:gap-4 p-3 md:p-4 z-0">
          {q.options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => socket.emit('submit_answer', { code: state.code, answerIndex: idx })}
              className={cn(`flex flex-col items-center justify-center gap-4 text-white p-4 md:p-8 shadow-[inset_0_-8px_0_rgba(0,0,0,0.15)] active:shadow-none active:translate-y-[8px] transition-all rounded-xl relative overflow-hidden border`, shapeClasses[idx], shapeBorders[idx])}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
              {SVGS[idx]}
              <span className="text-xl md:text-3xl font-black drop-shadow-md text-center line-clamp-3 leading-tight z-10">{opt}</span>
            </button>
          ))}
        </div>
        
        <div className="bg-white p-4 flex justify-between items-center shadow-[0_-4px_15px_rgba(0,0,0,0.05)] border-t border-gray-200 z-10">
           <span className="font-black text-xl text-gray-800 bg-gray-100 px-4 py-2 rounded-lg">{myPlayer?.name}</span>
           <div className="flex items-center gap-3">
              <span className="font-black w-12 h-12 bg-[#46178F] rounded-full flex items-center justify-center text-white text-xl shadow-inner border-2 border-violet-400">{timeLeft}</span>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f2f2f2] font-sans">
      <div className="bg-white shadow-md py-10 px-10 text-center relative flex-shrink-0 border-b border-gray-200 z-10 flex flex-col justify-center min-h-[30vh]">
         {role === 'host' && (
           <div className="absolute top-4 right-6 flex items-center gap-4">
              <span className="text-gray-400 font-bold uppercase tracking-widest text-sm">PIN: {state.code}</span>
              <button 
                onClick={() => socket.emit('show_leaderboard', { code: state.code })}
                className="bg-blue-500 border border-blue-400 text-white font-bold py-2 px-6 rounded-xl shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:bg-blue-400 active:translate-y-[2px] active:scale-[0.98] transition-all flex items-center gap-2"
              >
                Skip <Play size={16} className="fill-white" />
              </button>
           </div>
         )}

         <h1 className="text-4xl md:text-6xl font-black text-gray-800 drop-shadow-sm max-w-5xl mx-auto leading-tight">{q.text}</h1>
      </div>

      <div className="flex-grow flex items-center justify-center p-8 relative flex-col">
         <div className="absolute left-10 top-1/2 -translate-y-1/2">
           <div className="w-24 h-24 bg-[#46178F] rounded-full flex items-center justify-center text-white text-5xl font-black shadow-[inset_0_-6px_0_rgba(0,0,0,0.2)] border-2 border-violet-400">
             {timeLeft}
           </div>
         </div>

        <div className="absolute right-10 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center w-24 h-24 bg-white rounded-xl shadow-lg border border-gray-200">
           <span className="text-4xl font-black text-gray-800">{Object.values(state.players).filter(p => p.hasAnswered).length}</span>
           <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Answers</span>
        </div>
      </div>

      <div className="grid grid-cols-2 grid-rows-2 gap-4 p-6 md:p-8 flex-shrink-0 h-[45vh] bg-gray-100/50">
        {q.options.map((opt, idx) => (
          <div key={idx} className={cn(`relative flex items-center gap-6 p-4 md:p-8 rounded-xl shadow-[inset_0_-8px_0_rgba(0,0,0,0.2)] text-white overflow-hidden border`, shapeClasses[idx], shapeBorders[idx])}>
             <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-transparent pointer-events-none"></div>
             <div className="flex-shrink-0 opacity-90 relative z-10">{SVGS[idx]}</div>
             <div className="text-2xl md:text-4xl font-black drop-shadow-md leading-tight relative z-10 truncate">{opt}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const SpinnerIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity=".25"/>
    <path d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z" fill="#ffffff" />
  </svg>
)

function Leaderboard({ state, role }: { state: GameState, role: string }) {
  const topList = Object.values(state.players).sort((a, b) => b.score - a.score).slice(0, 5);
  
  const medals = ['🥇', '🥈', '🥉'];
  
  return (
    <div className="min-h-screen bg-[#46178F] relative overflow-hidden font-sans text-white flex flex-col">
      <div className="absolute -top-20 -left-20 w-[400px] h-[400px] bg-pink-500 rounded-full mix-blend-multiply filter blur-[80px] opacity-30 pointer-events-none"></div>
      <div className="absolute top-40 -right-20 w-[500px] h-[500px] bg-blue-500 rounded-full mix-blend-screen filter blur-[100px] opacity-40 pointer-events-none"></div>

      <nav className="sticky top-0 z-20 backdrop-blur-xl bg-white/10 border-b border-white/20 px-8 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white flex items-center justify-center rounded-lg shadow-md rotate-3">
             <span className="text-[#46178F] font-black text-xl">Q!</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight drop-shadow-sm">LEADERBOARD</h1>
        </div>
        {role === 'host' && (
          <button 
            onClick={() => socket.emit('next_question', { code: state.code })}
            className="bg-blue-500 border border-blue-400 text-white font-bold py-3 px-8 rounded-xl shadow-[0_4px_15px_rgba(59,130,246,0.4)] hover:bg-blue-400 active:translate-y-[2px] active:scale-[0.98] transition-all flex items-center gap-2"
          >
            Next <Play size={20} className="fill-white" />
          </button>
        )}
      </nav>
      
      <main className="flex-grow flex flex-col items-center p-8 max-w-3xl mx-auto w-full z-10">
        <div className="w-full flex flex-col gap-4 mt-8">
           <AnimatePresence>
             {topList.map((p, idx) => (
               <motion.div 
                 initial={{ x: -50, opacity: 0 }}
                 animate={{ x: 0, opacity: 1 }}
                 transition={{ delay: idx * 0.1 }}
                 key={p.id} 
                 className={`backdrop-blur-xl bg-white/10 border p-4 px-6 rounded-2xl shadow-lg flex justify-between items-center relative overflow-hidden transition-all hover:bg-white/15 ${idx === 0 ? 'border-yellow-400 border-2' : idx === 1 ? 'border-gray-300 border-2' : idx === 2 ? 'border-orange-500 border-2' : 'border-white/20'}`}
               >
                 <div className="flex items-center gap-6">
                   <div className="font-black text-3xl flex items-center justify-center w-10">
                      {idx < 3 ? medals[idx] : <span className="opacity-50 text-white/50">{idx + 1}</span>}
                   </div>
                   <div className="font-black text-2xl text-white tracking-wide truncate max-w-[200px] md:max-w-[300px]">{p.name}</div>
                 </div>
                 
                 <div className="flex items-center gap-6">
                   {p.lastAnswerCorrect && p.lastScoreAdded > 0 && (
                     <motion.div 
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       className="text-emerald-300 font-bold text-lg flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 rounded-full backdrop-blur-sm"
                     >
                       +{p.lastScoreAdded}
                     </motion.div>
                   )}
                   <div className="font-black text-3xl text-white w-24 text-right tracking-tight bg-black/20 px-3 py-1 rounded-xl">
                     {p.score}
                   </div>
                 </div>
               </motion.div>
             ))}
           </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function Podium({ state }: { state: GameState }) {
  useEffect(() => {
    conf({ particleCount: 150, spread: 180, origin: { y: 0.1 }, colors: ['#a855f7', '#3b82f6', '#ec4899', '#eab308'] });
    const int = setInterval(() => {
      conf({ particleCount: 50, spread: 120, origin: { x: Math.random(), y: Math.random() - 0.2 }, colors: ['#a855f7', '#3b82f6', '#ec4899', '#eab308'] });
    }, 2000);
    return () => clearInterval(int);
  }, []);

  const sorted = Object.values(state.players).sort((a, b) => b.score - a.score);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  const heights = ['h-64', 'h-48', 'h-32'];
  const colors = [
    'from-yellow-500/80 to-transparent',
    'from-gray-400/80 to-transparent',
    'from-orange-700/80 to-transparent'
  ];
  const borderColors = [
    'border-yellow-400',
    'border-gray-300',
    'border-orange-600'
  ];
  const medalColors = [
    'from-yellow-500 to-yellow-200',
    'from-gray-400 to-gray-200',
    'from-orange-700 to-orange-400'
  ];
  const medals = ['🥇', '🥈', '🥉'];
  
  const displayOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] : 
                       top3.length === 2 ? [top3[1], top3[0]] : 
                       top3;
  const indices = top3.length === 3 ? [1, 0, 2] : 
                  top3.length === 2 ? [1, 0] : 
                  [0];

  return (
    <div className="min-h-screen bg-[#46178F] relative overflow-hidden font-sans text-white flex flex-col pt-20">
      <div className="absolute -top-20 -left-20 w-[400px] h-[400px] bg-pink-500 rounded-full mix-blend-multiply filter blur-[80px] opacity-30 pointer-events-none"></div>
      <div className="absolute top-40 -right-20 w-[500px] h-[500px] bg-blue-500 rounded-full mix-blend-screen filter blur-[100px] opacity-40 pointer-events-none"></div>
      <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-teal-400 rounded-full mix-blend-overlay filter blur-[120px] opacity-20 pointer-events-none"></div>

      <nav className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center px-12 py-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white flex items-center justify-center rounded-xl rotate-3 shadow-lg">
            <span className="text-[#46178F] font-black text-2xl">Q!</span>
          </div>
          <div>
             <h1 className="text-2xl font-black tracking-tight drop-shadow-sm">PODIUM</h1>
             <p className="text-xs font-bold text-white/80 tracking-widest uppercase drop-shadow-sm">Final Results</p>
          </div>
        </div>
      </nav>

      <div className="flex-grow z-10 flex flex-col items-center justify-start pt-12 px-4 relative">
        <div className="flex items-end justify-center w-full max-w-4xl gap-6 mb-12">
          {displayOrder.map((p, i) => {
            const rankIndex = indices[i];
            const pHeight = heights[rankIndex];
            const pGradient = colors[rankIndex];
            const pBorder = borderColors[rankIndex];
            const pMedalGradient = medalColors[rankIndex];
            const pMedal = medals[rankIndex];
            const isFirst = rankIndex === 0;

            return (
              <motion.div 
                key={p.id}
                initial={{ y: 200, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', delay: (2 - rankIndex) * 0.4, bounce: 0.4 }}
                className={`flex flex-col items-center flex-1 max-w-[220px] ${isFirst ? '-translate-y-8' : ''}`}
              >
                <div className="mb-4 text-center flex flex-col items-center">
                  <div className={`w-24 h-24 ${isFirst ? 'w-32 h-32' : ''} rounded-full border-4 ${pBorder} p-1 mb-2 shadow-xl bg-white/10`}>
                    <div className={`w-full h-full rounded-full bg-gradient-to-tr ${pMedalGradient} flex items-center justify-center text-${isFirst ? '5xl' : '4xl'}`}>
                      {pMedal}
                    </div>
                  </div>
                  <p className={`font-black truncate w-full px-2 ${isFirst ? 'text-2xl' : 'text-xl'}`}>{p.name}</p>
                  <p className="text-yellow-300 font-bold tracking-wider">{p.score}</p>
                </div>
                <div className={`w-full ${pHeight} bg-gradient-to-b ${pGradient} backdrop-blur-md rounded-t-2xl flex items-center justify-center border-t border-x border-white/30`}>
                   <span className={`font-black text-white/20 ${isFirst ? 'text-9xl' : 'text-7xl'}`}>{rankIndex + 1}</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {rest.length > 0 && (
          <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 2.5 }}
             className="w-full max-w-2xl backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 shadow-2xl mb-8 flex flex-col max-h-[220px]"
          >
            <div className="flex justify-between items-center mb-4 px-4">
               <h3 className="font-black tracking-widest text-sm uppercase opacity-70">All Participants</h3>
               <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full">{Object.values(state.players).length} Players Total</span>
            </div>
            <div className="overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {rest.map((p, idx) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center gap-4">
                    <span className="font-black text-lg opacity-40 w-6">{idx + 4}</span>
                    <span className="font-bold">{p.name}</span>
                  </div>
                  <span className="font-black text-white/60">{p.score} pts</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
