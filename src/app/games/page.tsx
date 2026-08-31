'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { MemoryMatch } from '@/components/games/MemoryMatch';
import { WordScramble } from '@/components/games/WordScramble';
import { SimplePacman } from '@/components/games/SimplePacman';

type GameType = 'menu' | 'memory' | 'scramble' | 'pacman';

const GAMES = [
  {
    id: 'memory' as const,
    name: 'Memory Match',
    emoji: '🎴',
    description: 'Find matching pairs',
    component: MemoryMatch,
  },
  {
    id: 'scramble' as const,
    name: 'Word Scramble',
    emoji: '🔤',
    description: 'Unscramble the letters',
    component: WordScramble,
  },
  {
    id: 'pacman' as const,
    name: 'Pac-Man',
    emoji: '🟡',
    description: 'Collect all the dots',
    component: SimplePacman,
  },
];

export default function GamesPage() {
  const [selectedGame, setSelectedGame] = useState<GameType>('menu');

  const currentGame = GAMES.find((g) => g.id === selectedGame);

  if (selectedGame !== 'menu' && currentGame) {
    const GameComponent = currentGame.component;
    return (
      <div className="light-surface min-h-dvh bg-background">
        <div className="mx-auto max-w-4xl p-6">
          <button
            onClick={() => setSelectedGame('menu')}
            className="mb-4 rounded-xl bg-slate-200 px-6 py-2 font-bold text-slate-700 shadow-md hover:bg-slate-300"
          >
            ← Back to Games
          </button>
          <GameComponent onComplete={() => {}} />
        </div>
      </div>
    );
  }

  return (
    <div className="light-surface min-h-dvh bg-background px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <motion.h1
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-8 text-center text-5xl font-black tracking-tight text-slate-900"
        >
          <span>
            Game Break
          </span>
        </motion.h1>

        <p className="mb-8 text-center text-xl font-bold text-slate-600">
          Choose a game to play!
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {GAMES.map((game, index) => (
            <motion.button
              key={game.id}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => setSelectedGame(game.id)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-4 rounded-2xl border-4 border-violet-300 bg-white p-8 shadow-xl transition-all hover:border-violet-400"
            >
              <span className="text-6xl">{game.emoji}</span>
              <h2 className="text-2xl font-black text-violet-600">{game.name}</h2>
              <p className="text-sm font-semibold text-slate-600">{game.description}</p>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
