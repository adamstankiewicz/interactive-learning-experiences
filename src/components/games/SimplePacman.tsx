'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'motion/react';

const GRID_SIZE = 15;
const CELL_SIZE = 30;
const INITIAL_SPEED = 200;
const TIME_LIMIT = 60;
const MAX_CRASHES = 3;

type Position = { x: number; y: number };
type Direction = 'up' | 'down' | 'left' | 'right';

const WALLS = [
  [1, 1], [1, 2], [1, 3], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5],
  [5, 1], [5, 3], [5, 5], [7, 7], [7, 8], [7, 9],
  [9, 1], [9, 3], [9, 5], [11, 1], [11, 2], [11, 3], [11, 4], [11, 5],
  [13, 1], [13, 2], [13, 3], [1, 11], [1, 12], [1, 13],
  [3, 9], [3, 10], [3, 11], [3, 12], [3, 13],
  [5, 9], [5, 11], [5, 13], [9, 9], [9, 11], [9, 13],
  [11, 9], [11, 10], [11, 11], [11, 12], [11, 13],
  [13, 11], [13, 12], [13, 13],
];

function isWall(x: number, y: number): boolean {
  return WALLS.some(([wx, wy]) => wx === x && wy === y);
}

function generateDots(): Position[] {
  const dots: Position[] = [];
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      if (!isWall(x, y)) {
        dots.push({ x, y });
      }
    }
  }
  return dots;
}

export function SimplePacman({ onComplete }: { onComplete?: () => void }) {
  const [pacman, setPacman] = useState<Position>({ x: 7, y: 7 });
  const [direction, setDirection] = useState<Direction>('right');
  const [nextDirection, setNextDirection] = useState<Direction>('right');
  const [dots, setDots] = useState<Position[]>(generateDots());
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [crashes, setCrashes] = useState(0);
  const [won, setWon] = useState(false);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const crashCooldownRef = useRef<boolean>(false);
  const dotsRef = useRef(dots);

  // Keep dotsRef in sync with dots state
  useEffect(() => {
    dotsRef.current = dots;
  }, [dots]);

  const movePacman = useCallback(() => {
    setPacman((prev) => {
      let newX = prev.x;
      let newY = prev.y;

      const tryMove = (dir: Direction): { x: number; y: number } => {
        let tx = prev.x;
        let ty = prev.y;
        switch (dir) {
          case 'up': ty--; break;
          case 'down': ty++; break;
          case 'left': tx--; break;
          case 'right': tx++; break;
        }
        return { x: tx, y: ty };
      };

      const nextPos = tryMove(nextDirection);
      const nextOutOfBounds =
        nextPos.x < 0 ||
        nextPos.x >= GRID_SIZE ||
        nextPos.y < 0 ||
        nextPos.y >= GRID_SIZE;
      const nextHitsBlueWall = !nextOutOfBounds && isWall(nextPos.x, nextPos.y);
      const nextBlocked = nextOutOfBounds || nextHitsBlueWall;

      if (!nextBlocked) {
        // Successfully moved
        newX = nextPos.x;
        newY = nextPos.y;
        setDirection(nextDirection);
        crashCooldownRef.current = false;
      } else {
        // Count crash ONLY if hit a blue wall block (not the boundary)
        if (nextHitsBlueWall && !crashCooldownRef.current) {
          crashCooldownRef.current = true;
          setCrashes((c) => {
            const newCrashes = c + 1;
            if (newCrashes >= MAX_CRASHES) {
              setGameOver(true);
              setWon(false);
            }
            return newCrashes;
          });
        }

        // Try to continue in current direction if different from next
        if (nextDirection !== direction) {
          const currentPos = tryMove(direction);
          const currentOutOfBounds =
            currentPos.x < 0 ||
            currentPos.x >= GRID_SIZE ||
            currentPos.y < 0 ||
            currentPos.y >= GRID_SIZE;
          const currentHitsWall = !currentOutOfBounds && isWall(currentPos.x, currentPos.y);

          if (!currentOutOfBounds && !currentHitsWall) {
            newX = currentPos.x;
            newY = currentPos.y;
          }
        }
      }

      // Check for dot collection at new position
      const dotIndex = dotsRef.current.findIndex((d) => d.x === newX && d.y === newY);
      if (dotIndex !== -1) {
        const newDots = [...dotsRef.current];
        newDots.splice(dotIndex, 1);
        dotsRef.current = newDots;
        setDots(newDots);
        setScore((s) => s + 10);

        if (newDots.length === 0) {
          setGameOver(true);
          setWon(true);
          onComplete?.();
        }
      }

      return { x: newX, y: newY };
    });
  }, [direction, nextDirection, onComplete]);

  // Timer countdown
  useEffect(() => {
    if (gameOver || timeLeft <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setGameOver(true);
          setWon(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameOver, timeLeft]);

  useEffect(() => {
    if (gameOver || timeLeft <= 0 || crashes >= MAX_CRASHES) {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    gameLoopRef.current = setInterval(movePacman, INITIAL_SPEED);
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [movePacman, gameOver, timeLeft, crashes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          setNextDirection('up');
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 's':
          setNextDirection('down');
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'a':
          setNextDirection('left');
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'd':
          setNextDirection('right');
          e.preventDefault();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRestart = () => {
    setPacman({ x: 7, y: 7 });
    setDirection('right');
    setNextDirection('right');
    setDots(generateDots());
    setScore(0);
    setGameOver(false);
    setTimeLeft(TIME_LIMIT);
    setCrashes(0);
    setWon(false);
    crashCooldownRef.current = false;
  };

  const directionRotation = {
    up: 270,
    down: 90,
    left: 180,
    right: 0,
  };

  return (
    <div className="flex min-h-[600px] flex-col items-center gap-6 p-6">
      <div className="text-center">
        <h2 className="mb-2 text-3xl font-black text-violet-600">Pac-Man</h2>
        <div className="flex items-center justify-center gap-4 text-lg font-bold text-slate-600">
          <span>Score: {score}</span>
          <span>|</span>
          <span>Dots: {dots.length}</span>
          <span>|</span>
          <span className={timeLeft <= 10 ? 'text-rose-500' : ''}>Time: {timeLeft}s</span>
          <span>|</span>
          <span className={crashes >= 2 ? 'text-rose-500' : ''}>
            Crashes: {crashes}/{MAX_CRASHES}
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold text-slate-500">Use arrow keys or WASD</p>
      </div>

      <div
        className="relative rounded-xl border-4 border-slate-800 bg-slate-900"
        style={{
          width: GRID_SIZE * CELL_SIZE,
          height: GRID_SIZE * CELL_SIZE,
        }}
      >
        {WALLS.map(([x, y], i) => (
          <div
            key={i}
            className="absolute bg-blue-600"
            style={{
              left: x * CELL_SIZE,
              top: y * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE,
            }}
          />
        ))}

        {dots.map((dot, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-yellow-300"
            style={{
              left: dot.x * CELL_SIZE + CELL_SIZE / 2 - 3,
              top: dot.y * CELL_SIZE + CELL_SIZE / 2 - 3,
              width: 6,
              height: 6,
            }}
          />
        ))}

        <motion.div
          className="absolute text-3xl"
          style={{
            left: pacman.x * CELL_SIZE,
            top: pacman.y * CELL_SIZE,
            width: CELL_SIZE,
            height: CELL_SIZE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            rotate: directionRotation[direction],
          }}
          animate={{
            left: pacman.x * CELL_SIZE,
            top: pacman.y * CELL_SIZE,
          }}
          transition={{ duration: 0.15, ease: 'linear' }}
        >
          🟡
        </motion.div>
      </div>

      {gameOver && (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className={`rounded-2xl border-4 ${
            won ? 'border-emerald-400' : 'border-rose-400'
          } bg-white p-6 text-center shadow-xl`}
        >
          <p className="mb-2 text-4xl">{won ? '🎉' : '💥'}</p>
          <p className={`mb-1 text-2xl font-black ${won ? 'text-emerald-600' : 'text-rose-600'}`}>
            {won ? 'You won!' : crashes >= MAX_CRASHES ? 'Too many crashes!' : 'Time\'s up!'}
          </p>
          <p className="text-lg font-bold text-slate-600">
            Final score: {score}
            {!won && ` | ${dots.length} dots left`}
          </p>
          <button
            onClick={handleRestart}
            className="mt-4 rounded-xl bg-violet-500 px-6 py-2 font-black text-white shadow-[0_4px_0_0_#7c3aed] active:translate-y-1 active:shadow-[0_2px_0_0_#7c3aed]"
          >
            Play Again
          </button>
        </motion.div>
      )}
    </div>
  );
}
