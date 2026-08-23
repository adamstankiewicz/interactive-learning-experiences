'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

type Card = {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
};

const EMOJI_PAIRS = ['🍎', '🍌', '🍇', '🍊', '🍓', '🥝', '🍉', '🍒'];

function createShuffledCards(): Card[] {
  return [...EMOJI_PAIRS, ...EMOJI_PAIRS]
    .sort(() => Math.random() - 0.5)
    .map((emoji, index) => ({
      id: index,
      emoji,
      isFlipped: false,
      isMatched: false,
    }));
}

export function MemoryMatch({ onComplete }: { onComplete?: () => void }) {
  const [cards, setCards] = useState<Card[]>(createShuffledCards);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [isChecking, setIsChecking] = useState(false);

  const initializeGame = () => {
    setCards(createShuffledCards());
    setFlippedIndices([]);
    setMoves(0);
    setMatchedPairs(0);
    setIsChecking(false);
  };

  const handleCardClick = (index: number) => {
    if (
      isChecking ||
      cards[index].isFlipped ||
      cards[index].isMatched ||
      flippedIndices.length >= 2
    ) {
      return;
    }

    const newCards = [...cards];
    newCards[index].isFlipped = true;
    setCards(newCards);

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(moves + 1);
      setIsChecking(true);

      const [first, second] = newFlipped;
      if (cards[first].emoji === cards[second].emoji) {
        setTimeout(() => {
          const matched = [...cards];
          matched[first].isMatched = true;
          matched[second].isMatched = true;
          setCards(matched);
          setFlippedIndices([]);
          setIsChecking(false);
          const newMatchCount = matchedPairs + 1;
          setMatchedPairs(newMatchCount);

          if (newMatchCount === EMOJI_PAIRS.length) {
            setTimeout(() => onComplete?.(), 500);
          }
        }, 800);
      } else {
        setTimeout(() => {
          const unflipped = [...cards];
          unflipped[first].isFlipped = false;
          unflipped[second].isFlipped = false;
          setCards(unflipped);
          setFlippedIndices([]);
          setIsChecking(false);
        }, 1200);
      }
    }
  };

  const allMatched = matchedPairs === EMOJI_PAIRS.length;

  return (
    <div className="flex min-h-[500px] flex-col items-center gap-6 p-6">
      <div className="text-center">
        <h2 className="mb-2 text-3xl font-black text-violet-600">Memory match</h2>
        <p className="text-lg font-bold text-slate-600">
          Moves: {moves} | Matched: {matchedPairs}/{EMOJI_PAIRS.length}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {cards.map((card, index) => (
          <motion.button
            key={card.id}
            onClick={() => handleCardClick(index)}
            disabled={isChecking || card.isMatched}
            className="relative flex size-20 items-center justify-center rounded-xl text-4xl shadow-md transition-all disabled:cursor-not-allowed"
            whileHover={!card.isFlipped && !card.isMatched ? { scale: 1.05 } : {}}
            whileTap={!card.isFlipped && !card.isMatched ? { scale: 0.95 } : {}}
          >
            <AnimatePresence mode="wait">
              {card.isFlipped || card.isMatched ? (
                <motion.div
                  key="front"
                  initial={{ rotateY: 90 }}
                  animate={{ rotateY: 0 }}
                  exit={{ rotateY: 90 }}
                  transition={{ duration: 0.2 }}
                  className={`flex size-full items-center justify-center rounded-xl ${
                    card.isMatched
                      ? 'bg-emerald-400'
                      : 'bg-gradient-to-br from-pink-400 to-violet-400'
                  }`}
                >
                  {card.emoji}
                </motion.div>
              ) : (
                <motion.div
                  key="back"
                  initial={{ rotateY: 90 }}
                  animate={{ rotateY: 0 }}
                  exit={{ rotateY: 90 }}
                  transition={{ duration: 0.2 }}
                  className="flex size-full items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 text-2xl text-white"
                >
                  ?
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        ))}
      </div>

      {allMatched && (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="rounded-2xl border-4 border-emerald-400 bg-white p-6 text-center shadow-xl"
        >
          <p className="mb-2 text-4xl">🎉</p>
          <p className="mb-1 text-2xl font-black text-emerald-600">You won!</p>
          <p className="text-lg font-bold text-slate-600">Completed in {moves} moves</p>
          <button
            onClick={initializeGame}
            className="mt-4 rounded-xl bg-violet-500 px-6 py-2 font-black text-white shadow-[0_4px_0_0_#7c3aed] active:translate-y-1 active:shadow-[0_2px_0_0_#7c3aed]"
          >
            Play Again
          </button>
        </motion.div>
      )}
    </div>
  );
}
