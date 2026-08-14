'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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

export function useVoiceIntake(onFinal: (transcript: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<Recognition | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    setSupported(true);

    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let draft = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          onFinalRef.current(result[0].transcript.trim());
          setInterim('');
          return;
        }
        draft += result[0].transcript;
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
  }, []);

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
