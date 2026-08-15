'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * Web Speech API wrapper.
 *
 * The API is still vendor-prefixed in Chromium and absent from lib.dom, so the
 * minimum surface used here is declared locally rather than pulling in a types
 * package. It is Chromium-only in practice — callers must keep a typed input as
 * the fallback, not as a nicety.
 */
type SpeechAlternative = { transcript: string; confidence: number };
type SpeechResult = { isFinal: boolean; 0: SpeechAlternative };
type SpeechEvent = {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechResult };
};
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// No subscription needed — browser support for this API cannot change during
// a session — so the "subscribe" callback is a no-op. What matters is the
// two snapshots differing: server has no `window`, so `getServerSnapshot`
// always returns false, and React uses that value for the client's own first
// render too. Only once hydration is committed does the real check run,
// avoiding a mismatch between server and client HTML on the very first paint.
const subscribe = () => () => {};
const getServerSnapshot = () => false;

/**
 * `continuous` is the difference between capturing an answer and capturing a
 * paragraph. The learn page asks for a topic — one utterance, then the
 * recognizer should stop on its own — so it stays the default. A widget where
 * the student dictates several sentences of argument needs the recognizer to
 * survive the pauses between them; without it they tap the mic once per
 * sentence, which is enough friction to make them stop using it.
 *
 * Chrome still ends a continuous session after a long enough silence. That is
 * left as-is rather than auto-restarted from `onend`: a restart loop that fires
 * on an error path holds the microphone open indefinitely, and "tap to start
 * again" is a cheaper failure than that.
 */
export function useVoiceIntake(
  onFinal: (transcript: string) => void,
  { continuous = false }: { continuous?: boolean } = {},
) {
  const supported = useSyncExternalStore(
    subscribe,
    () => Boolean(recognitionCtor()),
    getServerSnapshot,
  );
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<Recognition | null>(null);
  // Kept current via an effect (runs after every render) rather than written
  // directly in the render body: mutating a ref during render is against the
  // rules even when, as here, nothing reads it until a later event fires.
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  });

  useEffect(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = continuous;
    recognition.interimResults = true;

    /**
     * One event can carry several results, and in continuous mode more than one
     * of them can be final at once. An earlier version returned from the loop on
     * the first final result, which silently dropped the rest — invisible when
     * `continuous` is false and there is only ever one, a lost clause per pause
     * when it is true. Finals are accumulated instead, and the interim is only
     * published when there is no final in the batch to supersede it.
     */
    recognition.onresult = (event) => {
      let finals = '';
      let draft = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finals += result[0].transcript;
        else draft += result[0].transcript;
      }

      if (finals.trim()) {
        onFinalRef.current(finals.trim());
        setInterim('');
        return;
      }

      setInterim(draft);
    };

    recognition.onerror = (event) => {
      setError(
        event.error === 'not-allowed'
          ? 'I need permission to use the microphone.'
          : 'I did not catch that.',
      );
      setListening(false);
    };

    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    };
  }, [continuous]);

  const start = useCallback(() => {
    setError(null);
    setInterim('');
    try {
      recognitionRef.current?.start();
      setListening(true);
    } catch {
      // start() throws if already running, which is harmless here.
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, interim, error, start, stop };
}
