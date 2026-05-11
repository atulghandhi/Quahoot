import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, Question, cn } from './types';
import conf from 'canvas-confetti';
import { Trophy, Medal, Play, Users, Check, X, Timer, Copy, MedalIcon, ChevronLeft, Image as ImageIcon, Upload, RotateCcw, Youtube, Clock, LogIn, LogOut, Save, FolderOpen, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SOUNDS, soundManager } from './lib/SoundManager';
// @ts-ignore
import ReactPlayerComponent from 'react-player';
const ReactPlayer = ReactPlayerComponent as any;
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc, serverTimestamp, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const socket: Socket = io('/', { transports: ['websocket'] }); // Connects to the same host/port

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [view, setView] = useState<'home' | 'create' | 'join'>('home');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Connection to Firestore test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  
  // Custom navigation handler
  const navigateTo = (newView: 'home' | 'create' | 'join') => {
    if (newView !== view) {
      window.history.pushState({ view: newView }, '', '');
      setView(newView);
    }
  };

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.view) {
        if (event.state.view !== 'game' && gameState) {
          // If we are navigating away from a game, we should disconnect/reset
          socket.disconnect();
          socket.connect();
          setGameState(null);
          setRole('none');
          setPlayerId(null);
          setAnswerResult(null);
        }
        setView(event.state.view);
      } else {
        if (gameState) {
          socket.disconnect();
          socket.connect();
          setGameState(null);
          setRole('none');
          setPlayerId(null);
          setAnswerResult(null);
        }
        setView('home');
      }
    };
    
    // Initial state
    window.history.replaceState({ view: 'home' }, '', '');
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
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
      setView('home'); 
      window.history.pushState({ view: 'game', code }, '', '');
    });

    socket.on('joined', ({ playerId, code }: { playerId: string, code: string }) => {
      setRole('player');
      setPlayerId(playerId);
      setView('home');
      window.history.pushState({ view: 'game', code }, '', '');
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

          <motion.div initial={{ scale: 0.9, y: -20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} className="flex flex-col items-center z-10 w-full max-w-sm">
            <div className="w-full flex justify-end mb-4">
              {user ? (
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
                  <img src={user.photoURL || ''} className="w-6 h-6 rounded-full" alt="avatar" />
                  <span className="text-white text-xs font-bold">{user.displayName}</span>
                  <button onClick={logout} className="text-white/50 hover:text-white transition-colors"><LogOut size={14}/></button>
                </div>
              ) : (
                <button onClick={login} className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20 text-white text-xs font-bold hover:bg-white/20 transition-all">
                  <LogIn size={14} /> Sign In
                </button>
              )}
            </div>

            <div className="w-32 h-32 bg-white flex items-center justify-center rounded-3xl rotate-3 shadow-2xl mb-6 border-b-8 border-gray-200">
               <span className="text-[#46178F] font-black text-7xl">Q!</span>
            </div>
            <h1 className="text-6xl md:text-8xl text-white mb-12 font-black tracking-tight drop-shadow-sm text-center">
              Let's host!
            </h1>
          </motion.div>
          
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="w-full max-w-sm flex flex-col gap-4 z-10 backdrop-blur-xl bg-white/10 border border-white/20 p-8 rounded-3xl shadow-2xl">
            <button 
              onClick={() => navigateTo('join')}
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
              onClick={() => navigateTo('create')}
              className="bg-purple-600 border border-purple-500 text-white text-xl font-bold flex items-center justify-center gap-3 py-4 px-6 rounded-xl shadow-[0_4px_15px_rgba(147,51,234,0.4)] hover:bg-purple-500 active:translate-y-[2px] active:scale-[0.98] transition-all w-full"
            >
              Host a Game <Play size={18} className="fill-white" />
            </button>
          </motion.div>
        </div>
      );
    }
    
    if (view === 'join') {
      return <JoinGame onBack={() => {
        window.history.back();
      }} />;
    }

    if (view === 'create') {
      return <CreateGame user={user} onBack={() => {
        window.history.back();
      }} />;
    }
  }

  const leaveGame = () => {
    socket.disconnect();
    socket.connect();
    setGameState(null);
    setRole('none');
    setPlayerId(null);
    setAnswerResult(null);
    navigateTo('home');
  };

  // Active game rendering
  return (
    <div className="min-h-screen font-sans bg-gray-100 flex flex-col">
      {gameState?.status === 'lobby' && <Lobby state={gameState} role={role} onBack={leaveGame} />}
      {gameState?.status === 'countdown' && <CountdownView count={countdown} role={role} />}
      {gameState?.status === 'question_active' && <QuestionView state={gameState} role={role} playerId={playerId} answerResult={answerResult} />}
      {gameState?.status === 'question_result' && <ResultsView state={gameState} role={role} playerId={playerId} answerResult={answerResult} />}
      {gameState?.status === 'leaderboard' && <Leaderboard state={gameState} role={role} />}
      {gameState?.status === 'podium' && <Podium state={gameState} onHome={() => {
        setGameState(null);
        setRole('none');
        setPlayerId(null);
        setAnswerResult(null);
        navigateTo('home');
      }} />}
    </div>
  );
}

function JoinGame({ onBack }: { onBack: () => void }) {
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');

  const generateNickname = () => {
    const adjectives = ['Cool', 'Awesome', 'Speedy', 'Brainy', 'Epic', 'Super', 'Hyper', 'Magic', 'Dancing', 'Funny'];
    const nouns = ['Panda', 'Tiger', 'Falcon', 'Owl', 'Koala', 'Lion', 'Wizard', 'Ninja', 'Cookie', 'Star'];
    const randomName = adjectives[Math.floor(Math.random() * adjectives.length)] + 
                      nouns[Math.floor(Math.random() * nouns.length)] + 
                      Math.floor(Math.random() * 100);
    setName(randomName);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin && name) {
      socket.emit('join_game', { code: pin, name });
    }
  };

  return (
    <div className="min-h-screen bg-[#46178F] relative overflow-hidden font-sans flex flex-col items-center justify-center p-4">
      <div className="absolute top-8 left-8 z-20">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors font-bold bg-white/10 px-4 py-2 rounded-xl backdrop-blur-md border border-white/20 shadow-lg"
        >
          <ChevronLeft size={20} /> Back
        </button>
      </div>

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
          <div className="relative">
            <input 
              type="text" 
              placeholder="Nickname" 
              className="w-full text-center text-xl font-bold p-4 bg-white/80 border border-white/50 rounded-xl focus:border-white focus:bg-white focus:ring-4 focus:ring-white/20 outline-none text-gray-800 placeholder-gray-500 transition-all shadow-inner pr-16"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={15}
            />
            <button 
              type="button"
              onClick={generateNickname}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#46178F]/50 hover:text-[#46178F] transition-colors"
              title="Generate random name"
            >
              <RotateCcw size={20} />
            </button>
          </div>
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

function CreateGame({ onBack, user }: { onBack: () => void, user: User | null }) {
  const [questions, setQuestions] = useState<Question[]>([
    { id: '1', text: 'What is 2 + 2?', options: ['3', '4', '5', '6'], correctIndex: 1, timeLimit: 20 }
  ]);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [title, setTitle] = useState('New Quiz');
  const [isSaving, setIsSaving] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [library, setLibrary] = useState<any[]>([]);

  const addQuestion = () => {
    setQuestions([...questions, { id: Math.random().toString(), text: '', options: ['', '', '', ''], correctIndex: 0, timeLimit: 20 }]);
  };

  const startHosting = () => {
    socket.emit('create_game', { questions });
  };

  const saveQuiz = async () => {
    let currentUser = user;
    if (!currentUser) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        currentUser = result.user;
      } catch (error) {
        console.error("Sign in failed", error);
        return;
      }
    }

    if (!currentUser) return;

    setIsSaving(true);
    try {
      const data = {
        title,
        questions,
        creatorId: currentUser.uid,
        updatedAt: serverTimestamp()
      };

      if (quizId) {
        await updateDoc(doc(db, 'quizzes', quizId), data);
      } else {
        const id = Math.random().toString(36).substr(2, 9);
        const docRef = await addDoc(collection(db, 'quizzes'), {
          ...data,
          id,
          createdAt: serverTimestamp()
        });
        setQuizId(docRef.id);
      }
      alert("Quiz saved successfully!");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'quizzes');
    } finally {
      setIsSaving(false);
    }
  };

  const loadLibrary = async () => {
    let currentUser = user;
    if (!currentUser) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        currentUser = result.user;
      } catch (error) {
        console.error("Sign in failed", error);
        return;
      }
    }
    if (!currentUser) return;

    try {
      const q = query(collection(db, 'quizzes'), where('creatorId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      const quizzes = querySnapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
      setLibrary(quizzes);
      setShowLibrary(true);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'quizzes');
    }
  };

  return (
    <div className="min-h-screen bg-[#46178F] relative font-sans text-white pb-20">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-pink-500 mix-blend-multiply filter blur-[100px] opacity-30"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-blue-500 mix-blend-screen filter blur-[120px] opacity-40"></div>
      </div>

      <nav className="sticky top-0 z-20 backdrop-blur-xl bg-white/10 border-b border-white/20 px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button 
            onClick={onBack}
            className="w-10 h-10 flex-shrink-0 bg-white/10 flex items-center justify-center rounded-lg border border-white/20 hover:bg-white/20 transition-colors mr-1"
          >
            <ChevronLeft size={24} className="text-white" />
          </button>
          <div className="w-10 h-10 flex-shrink-0 bg-white flex items-center justify-center rounded-lg shadow-md rotate-3">
             <span className="text-[#46178F] font-black text-xl">Q!</span>
          </div>
          <input 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-transparent text-xl md:text-2xl font-black tracking-tight drop-shadow-sm outline-none border-b-2 border-transparent focus:border-white/40 flex-grow max-w-[200px]"
            placeholder="Untitled Quiz"
          />
        </div>
        <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto overflow-x-auto no-scrollbar pb-1 md:pb-0">
          <button 
            onClick={loadLibrary}
            className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 md:py-3 px-4 md:px-6 rounded-xl border border-white/20 transition-all flex items-center gap-2 flex-shrink-0 text-sm md:text-base"
          >
            <FolderOpen size={18} /> <span className="hidden sm:inline">Library</span>
          </button>
          <button 
            onClick={saveQuiz}
            disabled={isSaving}
            className="bg-purple-500 hover:bg-purple-400 text-white font-bold py-2 md:py-3 px-4 md:px-6 rounded-xl border border-white/20 shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 flex-shrink-0 text-sm md:text-base"
          >
            <Save size={18} /> {isSaving ? '...' : 'Save'}
          </button>
          <button 
            onClick={startHosting}
            className="bg-emerald-500 border border-white/20 text-white font-bold py-2 md:py-3 px-5 md:px-8 rounded-xl shadow-[0_4px_15px_rgba(16,185,129,0.4)] hover:bg-emerald-400 active:translate-y-[2px] active:scale-[0.98] transition-all flex items-center gap-2 flex-shrink-0 text-sm md:text-base"
          >
            Host <Play size={18} className="fill-white" />
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {showLibrary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowLibrary(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-[#46178F] border border-white/20 w-full max-w-2xl rounded-3xl p-8 shadow-2xl flex flex-col max-h-[80vh]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-black">My Quizzes</h2>
                <button onClick={() => setShowLibrary(false)} className="text-white/50 hover:text-white"><X size={24}/></button>
              </div>
              <div className="overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {library.length === 0 && <p className="text-center text-white/50 py-12 font-bold italic">No saved quizzes yet.</p>}
                {library.map((quiz) => (
                  <div key={quiz.id} className="bg-white/10 border border-white/10 p-4 rounded-xl flex justify-between items-center hover:bg-white/15 transition-all">
                    <div>
                      <h3 className="text-xl font-bold">{quiz.title}</h3>
                      <p className="text-white/50 text-sm">{quiz.questions.length} questions</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setQuestions(quiz.questions);
                          setTitle(quiz.title);
                          setQuizId(quiz.firestoreId);
                          setShowLibrary(false);
                        }}
                        className="bg-emerald-500 hover:bg-emerald-400 px-4 py-2 rounded-lg font-bold text-sm"
                      >
                        Load
                      </button>
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          if(confirm("Delete this quiz?")) {
                            try {
                              await deleteDoc(doc(db, 'quizzes', quiz.firestoreId));
                              loadLibrary();
                            } catch (err) {
                              handleFirestoreError(err, OperationType.DELETE, `quizzes/${quiz.firestoreId}`);
                            }
                          }
                        }}
                        className="text-red-400 hover:text-red-300 p-2"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto mt-6 md:mt-12 px-4 md:px-6 relative z-10 space-y-6 md:space-y-8">
        {questions.map((q, qIndex) => (
          <div key={q.id} className="backdrop-blur-xl bg-white/10 border border-white/20 p-5 md:p-8 rounded-3xl shadow-xl transition-all hover:bg-white/15">
            <input 
              type="text" 
              placeholder="Start typing your question" 
              className="w-full text-xl md:text-3xl font-black bg-transparent border-b-2 border-white/20 focus:border-white outline-none mb-4 pb-4 text-center placeholder-white/40 transition-colors"
              value={q.text}
              onChange={(e) => {
                const newQ = [...questions];
                newQ[qIndex].text = e.target.value;
                setQuestions(newQ);
              }}
            />

            <div className="flex flex-col items-center mb-4">
              {q.image ? (
                <div className="relative group w-full max-w-md">
                  <img src={q.image} alt="Question" className="w-full max-h-80 object-contain rounded-2xl border-2 border-white/20 shadow-lg bg-black/10" />
                  <button 
                    onClick={() => {
                      const newQ = [...questions];
                      newQ[qIndex].image = undefined;
                      setQuestions(newQ);
                    }}
                    className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full max-w-md h-48 border-2 border-dashed border-white/30 rounded-2xl cursor-pointer hover:bg-white/10 transition-all">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <ImageIcon size={32} className="text-white/50 mb-2" />
                    <p className="text-white/60 font-bold mb-1">Add an image</p>
                    <p className="text-white/40 text-xs">PNG, JPG, GIF (Max 1MB)</p>
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 1024 * 1024) {
                           alert('Image too large. Please use an image smaller than 1MB');
                           return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const newQ = [...questions];
                          newQ[qIndex].image = reader.result as string;
                          setQuestions(newQ);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
               <div className="flex flex-col gap-2">
                 <div className="flex items-center gap-2 text-white/70 font-bold text-xs uppercase tracking-widest pl-1">
                   <Youtube size={14} className="text-red-400" /> YouTube Soundtrack
                 </div>
                 <input 
                   type="text" 
                   placeholder="YouTube URL (e.g. https://www.youtube.com/watch?v=...)"
                   className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm focus:bg-white/20 focus:border-white/40 outline-none transition-all"
                   value={q.youtubeUrl || ''}
                   onChange={(e) => {
                     const newQ = [...questions];
                     newQ[qIndex].youtubeUrl = e.target.value;
                     setQuestions(newQ);
                   }}
                 />
               </div>
               {q.youtubeUrl && (
                 <motion.div 
                   initial={{ opacity: 0, x: -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   className="flex flex-col gap-2"
                 >
                   <div className="flex items-center gap-2 text-white/70 font-bold text-xs uppercase tracking-widest pl-1">
                     <Clock size={14} /> Start At (seconds)
                   </div>
                   <input 
                     type="number" 
                     placeholder="0"
                     className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm focus:bg-white/20 focus:border-white/40 outline-none transition-all"
                     value={q.youtubeStartAt || 0}
                     onChange={(e) => {
                       const newQ = [...questions];
                       newQ[qIndex].youtubeStartAt = Number(e.target.value);
                       setQuestions(newQ);
                     }}
                   />
                 </motion.div>
               )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
              {q.options.map((opt, oIndex) => (
                <div key={oIndex} className={`relative flex items-center p-3 md:p-4 rounded-xl shadow-inner border border-white/30 backdrop-blur-md overflow-hidden ${oIndex === 0 ? 'bg-red-500/40' : oIndex === 1 ? 'bg-blue-500/40' : oIndex === 2 ? 'bg-yellow-500/40' : 'bg-emerald-500/40'}`}>
                   <button 
                     onClick={() => {
                        const newQ = [...questions];
                        newQ[qIndex].correctIndex = oIndex;
                        setQuestions(newQ);
                     }}
                     className={`absolute right-3 md:right-4 w-7 h-7 md:w-8 md:h-8 rounded-full border-4 flex items-center justify-center transition-all ${q.correctIndex === oIndex ? 'bg-emerald-500 border-white scale-110 shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 'border-white/40 hover:border-white hover:bg-white/20'}`}
                   >
                     {q.correctIndex === oIndex && <Check size={14} strokeWidth={4} className="text-white" />}
                   </button>
                   <input 
                    type="text" 
                    placeholder={`Answer ${oIndex + 1}`}
                    className="w-full bg-transparent font-bold text-lg md:text-xl outline-none placeholder-white/60 pr-10 md:pr-12 drop-shadow-sm"
                    value={opt}
                    onChange={(e) => {
                      const newQ = [...questions];
                      newQ[qIndex].options[oIndex] = e.target.value;
                      setQuestions(newQ);
                    }}
                  />
                  {q.options.length > 2 && (
                    <button 
                      onClick={() => {
                        const newQ = [...questions];
                        newQ[qIndex].options.splice(oIndex, 1);
                        if (newQ[qIndex].correctIndex >= newQ[qIndex].options.length) {
                          newQ[qIndex].correctIndex = 0;
                        }
                        setQuestions(newQ);
                      }}
                      className="absolute left-2 top-2 text-white/50 hover:text-white transition-colors"
                      title="Remove option"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              {q.options.length < 4 && (
                <button 
                  onClick={() => {
                    const newQ = [...questions];
                    newQ[qIndex].options.push('');
                    setQuestions(newQ);
                  }}
                  className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-white/30 hover:bg-white/10 transition-all font-bold text-white/60"
                >
                  <Users size={20} /> Add Option
                </button>
              )}
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

function Lobby({ state, role, onBack }: { state: GameState, role: 'host' | 'player' | 'none', onBack: () => void }) {
  const playersList = Object.values(state.players);

  useEffect(() => {
    if (role === 'host') {
      soundManager.play(SOUNDS.LOBBY, true);
    }
    return () => soundManager.stop();
  }, [role]);

  return (
    <div className="min-h-screen bg-[#46178F] relative overflow-hidden font-sans text-white flex flex-col">
      <div className="absolute -top-20 -left-20 w-[400px] h-[400px] bg-pink-500 rounded-full mix-blend-multiply filter blur-[80px] opacity-30 pointer-events-none"></div>
      <div className="absolute top-40 -right-20 w-[500px] h-[500px] bg-blue-500 rounded-full mix-blend-screen filter blur-[100px] opacity-40 pointer-events-none"></div>
      <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-teal-400 rounded-full mix-blend-overlay filter blur-[120px] opacity-20 pointer-events-none"></div>

      <nav className="relative z-10 backdrop-blur-xl bg-white/10 border-b border-white/20 px-4 md:px-8 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-2 md:gap-4">
          <button 
            onClick={onBack}
            className="w-8 h-8 md:w-10 md:h-10 bg-white/10 flex items-center justify-center rounded-lg border border-white/20 hover:bg-white/20 transition-colors mr-1"
          >
            <ChevronLeft size={20} className="text-white" />
          </button>
          <div className="w-8 h-8 md:w-10 md:h-10 bg-white flex items-center justify-center rounded-lg shadow-md rotate-3 flex-shrink-0">
             <span className="text-[#46178F] font-black text-lg md:text-xl">Q!</span>
          </div>
          <h1 className="text-lg md:text-2xl font-black tracking-tight drop-shadow-sm truncate max-w-[120px] sm:max-w-none">WAITING ROOM</h1>
        </div>
        {role === 'host' && (
          <button 
            onClick={() => socket.emit('start_game', { code: state.code })}
            className="bg-emerald-500 border border-white/20 text-white font-bold py-2 md:py-3 px-4 md:px-8 rounded-xl shadow-[0_4px_15px_rgba(16,185,129,0.4)] hover:bg-emerald-400 active:translate-y-[2px] active:scale-[0.98] transition-all flex items-center gap-2 text-sm md:text-base flex-shrink-0"
          >
            Start <span className="hidden sm:inline">Game</span> <Play size={18} className="fill-white" />
          </button>
        )}
      </nav>
      
      <main className="flex-grow z-10 flex flex-col items-center justify-center p-4 md:p-8">
        <div className="text-center mb-10 md:mb-16">
          <p className="text-white/80 text-lg md:text-xl font-bold mb-4 uppercase tracking-widest drop-shadow-sm">Join with Game PIN</p>
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 inline-block px-8 md:px-16 py-4 md:py-6 rounded-3xl shadow-2xl">
            <h1 className="text-5xl sm:text-7xl md:text-9xl font-black tracking-widest drop-shadow-lg scale-y-110" style={{ letterSpacing: '0.1em' }}>{state.code}</h1>
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

function CountdownView({ count, role }: { count: number, role: string }) {
  useEffect(() => {
    if (role === 'host') {
      soundManager.play(SOUNDS.COUNTDOWN);
    }
  }, [count, role]);

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

function ResultsView({ state, role, playerId, answerResult }: { state: GameState, role: string, playerId: string | null, answerResult: any }) {
  useEffect(() => {
    if (role === 'host') {
      soundManager.stop();
    }
  }, [role]);

  const q = state.questions[state.currentQuestionIndex];
  const maxVotes = Math.max(...state.answerDistribution, 1);
  const totalVotes = state.answerDistribution.reduce((a, b) => a + b, 0);

  const shapeClasses = [
    "bg-red-500",
    "bg-blue-500",
    "bg-yellow-500",
    "bg-emerald-500"
  ];

  const SVGS = [
    <svg viewBox="0 0 100 100" className="fill-white w-6 h-6"><polygon points="50,15 100,100 0,100"/></svg>,
    <svg viewBox="0 0 100 100" className="fill-white w-6 h-6"><polygon points="50,0 100,50 50,100 0,50"/></svg>,
    <svg viewBox="0 0 100 100" className="fill-white w-6 h-6"><circle cx="50" cy="50" r="40"/></svg>,
    <svg viewBox="0 0 100 100" className="fill-white w-6 h-6"><rect x="15" y="15" width="70" height="70"/></svg>,
  ];

  if (role === 'player') {
    const myPlayer = playerId ? state.players[playerId] : null;
    const correct = answerResult?.correct;
    
    return (
      <div className={cn("min-h-screen flex flex-col items-center justify-center p-6 text-white text-center font-sans", correct ? "bg-[#22c55e]" : "bg-[#ef4444]")}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mb-8">
           {correct ? <Check size={100} strokeWidth={4} /> : <X size={100} strokeWidth={4} />}
        </motion.div>
        <h1 className="text-5xl font-black mb-4">{correct ? "Nice one!" : "Almost..."}</h1>
        <div className="bg-black/20 backdrop-blur-md px-8 py-4 rounded-2xl border border-white/10">
           <p className="text-xl opacity-80 uppercase tracking-widest font-bold mb-1">Score</p>
           <p className="text-5xl font-black">{myPlayer?.score}</p>
        </div>
        <p className="mt-12 text-xl font-bold opacity-70">Check the big screen!</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f2f2] font-sans flex flex-col items-center p-4 md:p-8 pb-32 md:pb-32">
      <div className="w-full max-w-5xl flex flex-col flex-grow items-center justify-center">
        <h1 className="text-2xl md:text-4xl font-black text-gray-800 mb-8 md:mb-12 text-center px-4">{q.text}</h1>
        
        <div className="flex items-end justify-center gap-2 sm:gap-4 md:gap-8 w-full h-48 md:h-64 mb-10 md:mb-16">
          {q.options.map((opt, idx) => (
            <div key={idx} className="flex flex-col items-center flex-1 max-w-[80px] md:max-w-[120px]">
              <div className="text-gray-800 font-black text-lg md:text-2xl mb-1 md:mb-2">{state.answerDistribution[idx] || 0}</div>
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: `${(state.answerDistribution[idx] / maxVotes) * 100}%` }}
                className={cn("w-full rounded-t-lg md:rounded-t-xl relative overflow-hidden flex items-end justify-center pb-2 md:pb-4", shapeClasses[idx])}
                style={{ minHeight: '10%' }}
              >
                {idx === q.correctIndex && (
                  <div className="absolute top-1 md:top-2 flex items-center justify-center">
                    <Check strokeWidth={4} className="text-white drop-shadow-md w-4 h-4 md:w-6 md:h-6" />
                  </div>
                )}
                <div className="transform scale-75 md:scale-100">
                  {SVGS[idx]}
                </div>
              </motion.div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 w-full px-4 md:px-0">
          {q.options.map((opt, idx) => (
            <div key={idx} className={cn("p-3 md:p-4 rounded-xl text-white font-bold flex items-center gap-3 md:gap-4 border", shapeClasses[idx], idx === q.correctIndex ? "border-white border-4 animate-pulse scale-102 md:scale-105 z-10" : "opacity-50 grayscale-[0.5]")}>
               <div className="flex-shrink-0 transform scale-75 md:scale-100">
                {SVGS[idx]}
               </div>
               <span className="text-lg md:text-xl truncate">{opt}</span>
               {idx === q.correctIndex && <Check strokeWidth={4} className="ml-auto flex-shrink-0 w-4 h-4 md:w-5 md:h-5" />}
            </div>
          ))}
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-white border-t border-gray-200 flex justify-between items-center z-20">
         <div className="flex items-center gap-3">
            <span className="text-gray-400 font-bold uppercase tracking-widest text-xs md:text-sm">PIN: {state.code}</span>
         </div>
         <button 
           onClick={() => socket.emit('show_leaderboard', { code: state.code })}
           className="bg-blue-500 border border-blue-400 text-white font-bold py-2 md:py-3 px-6 md:px-10 rounded-xl shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:bg-blue-400 active:translate-y-[2px] active:scale-[0.98] transition-all flex items-center gap-2 text-sm md:text-base"
         >
           Next <Play size={18} className="fill-white" />
         </button>
      </nav>
    </div>
  );
}

function QuestionView({ state, role, playerId, answerResult }: { state: GameState, role: string, playerId: string | null, answerResult: any }) {
  const q = state.questions[state.currentQuestionIndex];
  
  useEffect(() => {
    if (role === 'host') {
      if (!q.youtubeUrl) {
        soundManager.play(SOUNDS.QUESTION, true);
      } else {
        soundManager.stop();
      }
    }
    return () => soundManager.stop();
  }, [q.youtubeUrl, role]);
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
           setTimeout(() => socket.emit('show_results', { code: state.code }), 1000);
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
        
        {q.image && (
          <div className="flex-shrink-0 w-full h-40 md:h-64 bg-gray-200 overflow-hidden border-b border-gray-300">
            <img src={q.image} alt="Question" className="w-full h-full object-contain" />
          </div>
        )}
        
        <div className={cn(
          "bg-gray-100 flex-grow grid gap-3 md:gap-4 p-3 md:p-4 z-0",
          q.options.length <= 2 ? "grid-cols-1 md:grid-cols-2 grid-rows-2" : "grid-cols-2 grid-rows-2"
        )}>
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
    <div className="min-h-screen flex flex-col bg-[#f2f2f2] font-sans pb-32 md:pb-0">
      <div className="bg-white shadow-md py-6 md:py-10 px-6 md:px-10 text-center relative flex-shrink-0 border-b border-gray-200 z-10 flex flex-col justify-center min-h-[25vh] md:min-h-[30vh]">
         {role === 'host' && (
           <div className="absolute top-2 md:top-4 right-2 md:right-6 flex items-center gap-2 md:gap-4">
              <span className="hidden sm:inline text-gray-400 font-bold uppercase tracking-widest text-[10px] md:text-sm">PIN: {state.code}</span>
              <button 
                onClick={() => socket.emit('show_results', { code: state.code })}
                className="bg-blue-500 border border-blue-400 text-white font-bold py-1 md:py-2 px-4 md:px-6 rounded-lg md:rounded-xl shadow-lg hover:bg-blue-400 active:translate-y-[2px] transition-all flex items-center gap-2 text-xs md:text-base"
              >
                Skip <Play className="fill-white w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
           </div>
         )}

         <h1 className="text-2xl md:text-6xl font-black text-gray-800 drop-shadow-sm max-w-5xl mx-auto leading-tight px-2">{q.text}</h1>
      </div>

      <div className="flex-grow flex items-center justify-center p-4 md:p-8 relative flex-col overflow-hidden">
         {q.image && (
           <div className="w-full max-w-2xl h-[30vh] md:h-[40vh] mb-4">
             <img src={q.image} alt="Question" className="w-full h-full object-contain rounded-2xl shadow-xl bg-white/50 p-2" />
           </div>
         )}

         <div className="absolute left-4 md:left-10 top-4 sm:top-1/2 sm:-translate-y-1/2 flex flex-row sm:flex-col items-center gap-2 md:gap-4">
           <div className="w-16 h-16 md:w-24 md:h-24 bg-[#46178F] rounded-full flex items-center justify-center text-white text-3xl md:text-5xl font-black shadow-[inset_0_-4px_0_rgba(0,0,0,0.2)] border-2 border-violet-400">
             {timeLeft}
           </div>
           {role === 'host' && q.youtubeUrl && (
             <div className="hidden">
               <ReactPlayer 
                 url={q.youtubeUrl} 
                 playing={timeLeft > 0} 
                 volume={0.8}
                 config={{ youtube: { start: q.youtubeStartAt || 0 } }}
               />
             </div>
           )}
         </div>

        <div className="absolute right-4 md:right-10 top-4 sm:top-1/2 sm:-translate-y-1/2 flex flex-row sm:flex-col items-center justify-center w-20 h-20 md:w-24 md:h-24 bg-white rounded-xl shadow-lg border border-gray-200">
           <span className="text-3xl md:text-4xl font-black text-gray-800">{Object.values(state.players).filter(p => p.hasAnswered).length}</span>
           <span className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest mt-0 md:mt-1 ml-2 sm:ml-0">Answers</span>
        </div>
      </div>

      <div className={cn(
        "grid grid-cols-1 md:grid-cols-2 grid-rows-none md:grid-rows-2 gap-2 md:gap-4 p-4 md:p-8 flex-shrink-0 bg-gray-100/50",
        q.options.length <= 2 ? "h-auto md:h-[30vh]" : "h-auto md:h-[45vh]"
      )}>
        {q.options.map((opt, idx) => (
          <div key={idx} className={cn(`relative flex items-center gap-4 md:gap-6 p-4 md:p-8 rounded-xl shadow-[inset_0_-6px_0_rgba(0,0,0,0.2)] text-white overflow-hidden border`, shapeClasses[idx], shapeBorders[idx])}>
             <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-transparent pointer-events-none"></div>
             <div className="flex-shrink-0 opacity-90 relative z-10 transform scale-75 md:scale-100">{SVGS[idx]}</div>
             <div className="text-xl md:text-4xl font-black drop-shadow-md leading-tight relative z-10 truncate">{opt}</div>
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

function Podium({ state, onHome }: { state: GameState, onHome: () => void }) {
  useEffect(() => {
    soundManager.play(SOUNDS.PODIUM, true);
    return () => soundManager.stop();
  }, []);

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
           <button 
             onClick={onHome}
             className="w-10 h-10 bg-white/10 flex items-center justify-center rounded-lg border border-white/20 hover:bg-white/20 transition-colors mr-2"
           >
             <ChevronLeft size={24} className="text-white" />
           </button>
          <div className="w-12 h-12 bg-white flex items-center justify-center rounded-xl rotate-3 shadow-lg">
            <span className="text-[#46178F] font-black text-2xl">Q!</span>
          </div>
          <div>
             <h1 className="text-2xl font-black tracking-tight drop-shadow-sm">PODIUM</h1>
             <p className="text-xs font-bold text-white/80 tracking-widest uppercase drop-shadow-sm">Final Results</p>
          </div>
        </div>
      </nav>

      <div className="flex-grow z-10 flex flex-col items-center justify-start pt-6 md:pt-12 px-4 relative">
        <div className="flex items-end justify-center w-full max-w-4xl gap-2 md:gap-6 mb-8 md:mb-12">
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
                className={`flex flex-col items-center w-[32%] md:flex-1 max-w-[220px] ${isFirst ? '-translate-y-4 md:-translate-y-8' : ''}`}
              >
                <div className="mb-2 md:mb-4 text-center flex flex-col items-center w-full">
                  <div className={`w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 ${isFirst ? 'w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32' : ''} rounded-full border-2 md:border-4 ${pBorder} p-0.5 md:p-1 mb-1 md:mb-2 shadow-xl bg-white/10`}>
                    <div className={`w-full h-full rounded-full bg-gradient-to-tr ${pMedalGradient} flex items-center justify-center text-2xl md:text-4xl ${isFirst ? 'text-3xl md:text-5xl' : ''}`}>
                      {pMedal}
                    </div>
                  </div>
                  <p className={`font-black truncate w-full px-1 ${isFirst ? 'text-sm sm:text-lg md:text-2xl' : 'text-xs sm:text-base md:text-xl'}`}>{p.name}</p>
                  <p className="text-yellow-300 font-bold text-[10px] sm:text-xs md:text-base tracking-wider">{p.score}</p>
                </div>
                <div className={`w-full ${pHeight} bg-gradient-to-b ${pGradient} backdrop-blur-md rounded-t-xl md:rounded-t-2xl flex items-center justify-center border-t border-x border-white/30`}>
                   <span className={`font-black text-white/20 text-4xl sm:text-6xl md:text-7xl ${isFirst ? 'text-6xl sm:text-8xl md:text-9xl' : ''}`}>{rankIndex + 1}</span>
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
