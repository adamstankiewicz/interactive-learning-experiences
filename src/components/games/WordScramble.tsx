'use client';

import { useState } from 'react';
import { motion } from 'motion/react';

const WORDS = [
  { word: 'science', hint: 'Study of the natural world' },
  { word: 'history', hint: 'Study of the past' },
  { word: 'mathematics', hint: 'Study of numbers' },
  { word: 'geography', hint: 'Study of places' },
  { word: 'literature', hint: 'Study of written works' },
  { word: 'biology', hint: 'Study of living things' },
  { word: 'chemistry', hint: 'Study of matter' },
  { word: 'physics', hint: 'Study of energy and motion' },
];

function scrambleWord(word: string): string {
  const letters = word.split('');
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  return letters.join('');
}

export function WordScramble({ onComplete }: { onComplete?: () => void }) {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [guess, setGuess] = useState('');
  const [message, setMessage] = useState('');
  const [score, setScore] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);

  const currentWord = WORDS[currentWordIndex];
  const [scrambled, setScrambled] = useState(() => scrambleWord(currentWord.word));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (guess.toLowerCase().trim() === currentWord.word.toLowerCase()) {
      setMessage('✓ Correct!');
      setScore(score + 1);
      setGuess('');

      setTimeout(() => {
        if (currentWordIndex < WORDS.length - 1) {
          const nextIndex = currentWordIndex + 1;
          setCurrentWordIndex(nextIndex);
          setScrambled(scrambleWord(WORDS[nextIndex].word));
          setMessage('');
        } else {
          setGameComplete(true);
          onComplete?.();
        }
      }, 1000);
    } else {
      setMessage('✗ Try again!');
      setTimeout(() => setMessage(''), 2000);
    }
  };

  const handleSkip = () => {
    if (currentWordIndex < WORDS.length - 1) {
      const nextIndex = currentWordIndex + 1;
      setCurrentWordIndex(nextIndex);
      setScrambled(scrambleWord(WORDS[nextIndex].word));
      setGuess('');
      setMessage('');
    }
  };

  const handleRestart = () => {
    setCurrentWordIndex(0);
    setScrambled(scrambleWord(WORDS[0].word));
    setGuess('');
    setMessage('');
    setScore(0);
    setGameComplete(false);
  };

  const handleReshuffle = () => {
    setScrambled(scrambleWord(currentWord.word));
  };

  if (gameComplete) {
    return (
      <div className="flex min-h-[500px] flex-col items-center justify-center gap-6 p-6">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="rounded-2xl border-4 border-emerald-400 bg-white p-8 text-center shadow-xl"
        >
          <p className="mb-4 text-5xl">🎉</p>
          <h3 className="mb-2 text-3xl font-black text-emerald-600">Great job!</h3>
          <p className="mb-4 text-xl font-bold text-slate-600">
            Score: {score}/{WORDS.length}
          </p>
          <button
            onClick={handleRestart}
            className="rounded-xl bg-violet-500 px-8 py-3 font-black text-white shadow-[0_4px_0_0_#7c3aed] active:translate-y-1 active:shadow-[0_2px_0_0_#7c3aed]"
          >
            Play Again
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[500px] flex-col items-center gap-6 p-6">
      <div className="text-center">
        <h2 className="mb-2 text-3xl font-black text-violet-600">Word Scramble</h2>
        <p className="text-lg font-bold text-slate-600">
          Score: {score} | Word {currentWordIndex + 1}/{WORDS.length}
        </p>
      </div>

      <motion.div
        key={currentWordIndex}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md space-y-6 rounded-2xl border-4 border-violet-300 bg-white p-8 shadow-xl"
      >
        <div className="text-center">
          <p className="mb-2 text-sm font-bold text-violet-600">Hint:</p>
          <p className="mb-4 text-lg font-semibold text-slate-700">{currentWord.hint}</p>
          <div className="flex items-center justify-center gap-2">
            <p className="text-4xl font-black tracking-widest text-slate-900">{scrambled}</p>
            <button
              onClick={handleReshuffle}
              className="rounded-lg bg-slate-200 p-2 text-xl hover:bg-slate-300"
              title="Reshuffle"
            >
              🔀
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="Type your answer..."
            className="w-full rounded-xl border-4 border-violet-200 bg-white px-4 py-3 text-center text-xl font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-violet-400"
            autoFocus
          />

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!guess.trim()}
              className="flex-1 rounded-xl bg-emerald-500 py-3 font-black text-white shadow-[0_4px_0_0_#047857] active:translate-y-1 active:shadow-[0_2px_0_0_#047857] disabled:opacity-50"
            >
              Submit
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="flex-1 rounded-xl bg-slate-300 py-3 font-black text-slate-700 shadow-[0_4px_0_0_#475569] active:translate-y-1 active:shadow-[0_2px_0_0_#475569]"
            >
              Skip
            </button>
          </div>
        </form>

        {message && (
          <motion.p
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`text-center text-xl font-black ${
              message.includes('Correct') ? 'text-emerald-600' : 'text-rose-500'
            }`}
          >
            {message}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}
