import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { transcribeRecordedAudio } from '@/services/speechTranscriptionService';
import {
  evaluatePresentationTestSession,
  generatePresentationTestQuestions,
  type PresentationTestEvaluation,
  type PresentationTestTranscriptEntry,
} from '@/services/presentationTestService';
import mascotCouchImage from '@/assets/Mascot_Couch.png';

const DEFAULT_DURATION_MINUTES = 8;
const DEFAULT_INTERVAL_SECONDS = 60;
const TRANSCRIPTION_CHUNK_MS = 15_000;
const DURATION_OPTIONS_MINUTES = [1, 4, 8, 12, 20];
const INTERVAL_OPTIONS_SECONDS = [15, 30, 60, 120, 300];

type SessionState = 'idle' | 'preparing' | 'running' | 'evaluating' | 'finished' | 'error';

function pickSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  const preferredMimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
  ];

  return preferredMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? '';
}

function formatTimeRemaining(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function buildFallbackEvaluation(): PresentationTestEvaluation {
  return {
    deliveryFeedback: {
      summary: 'The session completed, but there was not enough captured transcript to assess delivery with confidence.',
      confidence: { rating: 1, feedback: 'There was not enough usable spoken content to judge confidence reliably.' },
      tonality: { rating: 1, feedback: 'Tonality can only be inferred from wording here, and there was too little material to do that well.' },
      clarity: { rating: 1, feedback: 'The captured response data was too sparse for a strong clarity assessment.' },
      pacing: { rating: 1, feedback: 'Pacing could not be judged reliably from the limited transcript segments.' },
      fillerWords: { rating: 1, feedback: 'Not enough transcript content was available to assess filler-word usage.' },
    },
    defenseFeedback: {
      summary: 'The session ended without enough answer content for a meaningful thesis-defense analysis.',
      questionHandling: { rating: 1, feedback: 'Too little answer content was captured to judge whether questions were answered directly.' },
      argumentStrength: { rating: 1, feedback: 'There was not enough material to evaluate the strength of the reasoning.' },
      academicPrecision: { rating: 1, feedback: 'Academic precision could not be assessed from the limited transcript.' },
      defenseQuality: { rating: 1, feedback: 'A reliable defense-quality review was not possible for this run.' },
    },
    overallSummary: 'This run did not capture enough response material for a useful mock-defense coaching report.',
    improvements: [
      'Check that your microphone is active before starting the session.',
      'Speak continuously for most of each one-minute question window.',
      'Run another session and aim to produce several clear transcript segments.',
    ],
    quotedEvidence: [],
  };
}

function normalizeRatedFeedback(value: unknown, fallbackFeedback: string) {
  const candidate = value as { rating?: unknown; feedback?: unknown } | undefined;
  const rating = typeof candidate?.rating === 'number' ? candidate.rating : 1;
  const feedback = typeof candidate?.feedback === 'string' && candidate.feedback.trim().length > 0
    ? candidate.feedback
    : fallbackFeedback;

  return {
    rating: Math.max(1, Math.min(5, Math.round(rating))),
    feedback,
  };
}

function normalizeEvaluation(value: PresentationTestEvaluation | null | undefined): PresentationTestEvaluation {
  const fallback = buildFallbackEvaluation();
  const candidate = value as Partial<PresentationTestEvaluation> | null | undefined;

  return {
    deliveryFeedback: {
      summary: typeof candidate?.deliveryFeedback?.summary === 'string'
        ? candidate.deliveryFeedback.summary
        : fallback.deliveryFeedback.summary,
      confidence: normalizeRatedFeedback(
        candidate?.deliveryFeedback?.confidence,
        fallback.deliveryFeedback.confidence.feedback
      ),
      tonality: normalizeRatedFeedback(
        candidate?.deliveryFeedback?.tonality,
        fallback.deliveryFeedback.tonality.feedback
      ),
      clarity: normalizeRatedFeedback(
        candidate?.deliveryFeedback?.clarity,
        fallback.deliveryFeedback.clarity.feedback
      ),
      pacing: normalizeRatedFeedback(
        candidate?.deliveryFeedback?.pacing,
        fallback.deliveryFeedback.pacing.feedback
      ),
      fillerWords: normalizeRatedFeedback(
        candidate?.deliveryFeedback?.fillerWords,
        fallback.deliveryFeedback.fillerWords.feedback
      ),
    },
    defenseFeedback: {
      summary: typeof candidate?.defenseFeedback?.summary === 'string'
        ? candidate.defenseFeedback.summary
        : fallback.defenseFeedback.summary,
      questionHandling: normalizeRatedFeedback(
        candidate?.defenseFeedback?.questionHandling,
        fallback.defenseFeedback.questionHandling.feedback
      ),
      argumentStrength: normalizeRatedFeedback(
        candidate?.defenseFeedback?.argumentStrength,
        fallback.defenseFeedback.argumentStrength.feedback
      ),
      academicPrecision: normalizeRatedFeedback(
        candidate?.defenseFeedback?.academicPrecision,
        fallback.defenseFeedback.academicPrecision.feedback
      ),
      defenseQuality: normalizeRatedFeedback(
        candidate?.defenseFeedback?.defenseQuality,
        fallback.defenseFeedback.defenseQuality.feedback
      ),
    },
    overallSummary: typeof candidate?.overallSummary === 'string'
      ? candidate.overallSummary
      : fallback.overallSummary,
    improvements: Array.isArray(candidate?.improvements) && candidate.improvements.length > 0
      ? candidate.improvements.filter((item): item is string => typeof item === 'string')
      : fallback.improvements,
    quotedEvidence: Array.isArray(candidate?.quotedEvidence)
      ? candidate.quotedEvidence.filter((item): item is string => typeof item === 'string')
      : fallback.quotedEvidence,
  };
}

function renderStars(rating: number) {
  const safeRating = Math.max(1, Math.min(5, Math.round(rating)));
  return `${'★'.repeat(safeRating)}${'☆'.repeat(5 - safeRating)}`;
}

export default function ThesisPresentationTestMode() {
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedDurationMinutes, setSelectedDurationMinutes] = useState(DEFAULT_DURATION_MINUTES);
  const [selectedIntervalSeconds, setSelectedIntervalSeconds] = useState(DEFAULT_INTERVAL_SECONDS);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(DEFAULT_DURATION_MINUTES * 60);
  const [transcriptEntries, setTranscriptEntries] = useState<PresentationTestTranscriptEntry[]>([]);
  const [evaluation, setEvaluation] = useState<PresentationTestEvaluation | null>(null);
  const [captureStatus, setCaptureStatus] = useState('Ready');
  const [sessionWarning, setSessionWarning] = useState<string | null>(null);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [listeningDotCount, setListeningDotCount] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sessionStartAtRef = useRef<number | null>(null);
  const transcriptionBoundaryRef = useRef<number | null>(null);
  const transcriptIdRef = useRef(0);
  const transcriptEntriesRef = useRef<PresentationTestTranscriptEntry[]>([]);
  const stopPromiseResolverRef = useRef<(() => void) | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const endingSessionRef = useRef(false);
  const transcriptionQueueRef = useRef<Promise<void>>(Promise.resolve());

  const currentQuestion = questions[currentQuestionIndex] ?? 'Preparing your next question...';
  const safeEvaluation = normalizeEvaluation(evaluation);
  const totalSessionSeconds = selectedDurationMinutes * 60;
  const listeningIndicator = sessionState === 'running' && captureStatus === 'Listening...'
    ? `Listening${'.'.repeat(listeningDotCount)}`
    : captureStatus;
  const totalQuestions = useMemo(
    () => Math.max(1, Math.ceil(totalSessionSeconds / selectedIntervalSeconds)),
    [selectedIntervalSeconds, totalSessionSeconds]
  );
  const soundwaveBars = useMemo(() => {
    const weights = [0.3, 0.42, 0.56, 0.72, 0.88, 1, 0.88, 0.72, 0.56, 0.42, 0.3];
    const baseHeight = 8;

    return weights.map((weight, index) => ({
      id: index,
      height: Math.round(baseHeight + audioLevel * 62 * weight),
    }));
  }, [audioLevel]);

  const clearTimerInterval = useCallback(() => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const stopAudioLevelTracking = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    analyserRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setAudioLevel(0);
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    stopAudioLevelTracking();
  }, [stopAudioLevelTracking]);

  const resetSession = useCallback(() => {
    clearTimerInterval();
    stopTracks();
    mediaRecorderRef.current = null;
    sessionStartAtRef.current = null;
    transcriptionBoundaryRef.current = null;
    stopPromiseResolverRef.current = null;
    endingSessionRef.current = false;
    transcriptionQueueRef.current = Promise.resolve();
    setSessionState('idle');
    setError(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setTimeRemainingSeconds(totalSessionSeconds);
    setTranscriptEntries([]);
    transcriptEntriesRef.current = [];
    setEvaluation(null);
    setTranscriptExpanded(false);
    setListeningDotCount(0);
    setCaptureStatus('Ready');
    setSessionWarning(null);
  }, [clearTimerInterval, stopTracks]);

  const enqueueTranscription = useCallback((blob: Blob, startedAtMs: number, endedAtMs: number) => {
    const sessionStartAt = sessionStartAtRef.current ?? startedAtMs;
    const midpointMs = startedAtMs + (endedAtMs - startedAtMs) / 2;
    const questionIndex = Math.min(
      totalQuestions - 1,
      Math.max(0, Math.floor((midpointMs - sessionStartAt) / (selectedIntervalSeconds * 1000)))
    );

    setCaptureStatus('Transcribing latest answer segment...');

    transcriptionQueueRef.current = transcriptionQueueRef.current
      .then(async () => {
        const result = await transcribeRecordedAudio(blob);
        const text = result.text.trim();

        if (!text) {
          return;
        }

        setTranscriptEntries((currentEntries) => {
          const nextEntries = [
            ...currentEntries,
            {
              id: transcriptIdRef.current++,
              text,
              questionIndex,
              startedAtMs,
              endedAtMs,
            },
          ];
          transcriptEntriesRef.current = nextEntries;
          return nextEntries;
        });
      })
      .catch(() => {
        setSessionWarning('One recorded answer segment could not be transcribed. The rest of the session will continue.');
      })
      .finally(() => {
        setCaptureStatus((currentStatus) =>
          currentStatus === 'Transcribing latest answer segment...' ? 'Listening...' : currentStatus
        );
      });
  }, [totalQuestions]);

  const startCapture = useCallback(async () => {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') {
      throw new Error('Audio recording is not available in this environment.');
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser does not support microphone recording.');
    }

    if (typeof MediaRecorder === 'undefined') {
      throw new Error('This browser does not support audio capture.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    const mimeType = pickSupportedMimeType();
    const mediaRecorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.18;
    source.connect(analyser);

    const amplitudeData = new Uint8Array(analyser.fftSize);

    const updateAudioLevel = () => {
      analyser.getByteTimeDomainData(amplitudeData);

      let sumSquares = 0;
      for (let index = 0; index < amplitudeData.length; index += 1) {
        const sample = (amplitudeData[index] - 128) / 128;
        sumSquares += sample * sample;
      }

      const rms = Math.sqrt(sumSquares / amplitudeData.length);
      const normalizedLevel = Math.min(1, rms * 9.5);
      setAudioLevel((currentLevel) => currentLevel * 0.12 + normalizedLevel * 0.88);
      animationFrameRef.current = window.requestAnimationFrame(updateAudioLevel);
    };

    streamRef.current = stream;
    mediaRecorderRef.current = mediaRecorder;
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    transcriptionBoundaryRef.current = Date.now();
    animationFrameRef.current = window.requestAnimationFrame(updateAudioLevel);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size === 0) {
        return;
      }

      const chunkStartedAtMs = transcriptionBoundaryRef.current ?? Date.now();
      const chunkEndedAtMs = Date.now();
      transcriptionBoundaryRef.current = chunkEndedAtMs;

      enqueueTranscription(event.data, chunkStartedAtMs, chunkEndedAtMs);
    };

    mediaRecorder.onstop = async () => {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 150);
      });

      stopPromiseResolverRef.current?.();
      stopPromiseResolverRef.current = null;
    };

    mediaRecorder.start(TRANSCRIPTION_CHUNK_MS);
    setCaptureStatus('Listening...');
  }, [enqueueTranscription]);

  const finishSession = useCallback(async (endedEarly: boolean) => {
    if (endingSessionRef.current) {
      return;
    }

    endingSessionRef.current = true;
    clearTimerInterval();
    setSessionState('evaluating');
    setCaptureStatus('Finalizing session...');

    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      const stopCompleted = new Promise<void>((resolve) => {
        stopPromiseResolverRef.current = resolve;
      });

      mediaRecorder.requestData();
      mediaRecorder.stop();
      await stopCompleted;
    }

    stopTracks();
    mediaRecorderRef.current = null;
    await transcriptionQueueRef.current;

    const sessionStartAt = sessionStartAtRef.current ?? Date.now();
    const durationSeconds = endedEarly
      ? Math.max(1, Math.round((Date.now() - sessionStartAt) / 1000))
      : totalSessionSeconds;

    try {
      const result = await evaluatePresentationTestSession({
        questions,
        transcriptEntries: transcriptEntriesRef.current,
        durationSeconds,
      });

      setEvaluation(result);
    } catch {
      setEvaluation(buildFallbackEvaluation());
      setSessionWarning('Evaluation failed once, so a fallback coaching summary is shown instead.');
    } finally {
      setCaptureStatus('Finished');
      setSessionState('finished');
      endingSessionRef.current = false;
    }
  }, [clearTimerInterval, questions, stopTracks]);

  const startSession = useCallback(async () => {
    setSessionState('preparing');
    setError(null);
    setSessionWarning(null);
    setEvaluation(null);
    setTranscriptEntries([]);
    transcriptEntriesRef.current = [];
    setTranscriptExpanded(false);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setTimeRemainingSeconds(totalSessionSeconds);
    setListeningDotCount(0);
    transcriptIdRef.current = 0;
    sessionStartAtRef.current = null;
    transcriptionBoundaryRef.current = null;
    transcriptionQueueRef.current = Promise.resolve();
    endingSessionRef.current = false;

    try {
      const generatedQuestions = await generatePresentationTestQuestions(totalQuestions);

      if (generatedQuestions.length === 0) {
        throw new Error('No test questions could be generated for this session.');
      }

      const normalizedQuestions = generatedQuestions.slice(0, totalQuestions);
      setQuestions(normalizedQuestions);
      setCurrentQuestionIndex(0);
      sessionStartAtRef.current = Date.now();
      transcriptionBoundaryRef.current = sessionStartAtRef.current;
      setSessionState('running');
      setCaptureStatus('Starting microphone...');

      await startCapture();

      timerIntervalRef.current = window.setInterval(() => {
        const sessionStartAt = sessionStartAtRef.current ?? Date.now();
        const elapsedSeconds = Math.floor((Date.now() - sessionStartAt) / 1000);
        const remainingSeconds = Math.max(0, totalSessionSeconds - elapsedSeconds);
        const nextQuestionIndex = Math.min(
          normalizedQuestions.length - 1,
          Math.floor(elapsedSeconds / selectedIntervalSeconds)
        );

        setTimeRemainingSeconds(remainingSeconds);
        setCurrentQuestionIndex(nextQuestionIndex);

        if (remainingSeconds <= 0) {
          void finishSession(false);
        }
      }, 1000);
    } catch (sessionError) {
      clearTimerInterval();
      stopTracks();
      mediaRecorderRef.current = null;
      setSessionState('error');
      setCaptureStatus('Ready');
      setError(
        sessionError instanceof Error
          ? sessionError.message
          : 'The test session could not be started.'
      );
    }
  }, [clearTimerInterval, finishSession, selectedIntervalSeconds, startCapture, stopTracks, totalQuestions, totalSessionSeconds]);

  useEffect(() => {
    if (sessionState !== 'running' || captureStatus !== 'Listening...') {
      setListeningDotCount(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setListeningDotCount((currentCount) => (currentCount + 1) % 4);
    }, 500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [captureStatus, sessionState]);

  useEffect(() => {
    return () => {
      clearTimerInterval();

      const mediaRecorder = mediaRecorderRef.current;
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.onstop = null;
        stopPromiseResolverRef.current?.();
        stopPromiseResolverRef.current = null;
        mediaRecorder.stop();
      }

      stopTracks();
    };
  }, [clearTimerInterval, stopTracks]);

  if (sessionState === 'idle') {
    return (
      <div className="flex h-full w-full flex-col overflow-y-auto rounded-md bg-neutral-100 text-neutral-900">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-6 py-8 sm:py-12">
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
              Practice a timed mock thesis defense.
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              One new examiner question appears every minute. Your spoken answers are captured and evaluated at the end.
            </p>
          </div>

          <div className="relative flex w-full max-w-sm items-center justify-center py-2">
            <div className="absolute inset-x-12 bottom-2 h-8 rounded-full bg-[radial-gradient(circle,rgba(81,60,45,0.16),transparent_70%)] blur-2xl" />
            <img
              src={mascotCouchImage}
              alt="Mascot sitting on a couch ready to listen"
              className="relative z-10 w-auto object-contain"
              style={{ maxHeight: 'clamp(8rem, 20vh, 12.75rem)' }}
            />
          </div>

          <div className="w-full flex-col gap-4 rounded-2xl px-5 py-5" style={{ backgroundColor: 'rgba(250,250,250,1)', border: '2px solid rgba(212,212,216,1)' }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-left">
                <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'rgba(113,113,122,1)' }}>Session duration</span>
                <select
                  value={selectedDurationMinutes}
                  onChange={(event) => setSelectedDurationMinutes(Number(event.target.value))}
                  className="focus:outline-none"
                  style={{ backgroundColor: 'rgba(244,244,245,1)', border: '2px solid rgba(212,212,216,1)', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'rgba(38,38,38,1)', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%23737373' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                >
                  {DURATION_OPTIONS_MINUTES.map((durationMinutes) => (
                    <option key={durationMinutes} value={durationMinutes}>
                      {durationMinutes} minute{durationMinutes === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-left">
                <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'rgba(113,113,122,1)' }}>Question interval</span>
                <select
                  value={selectedIntervalSeconds}
                  onChange={(event) => setSelectedIntervalSeconds(Number(event.target.value))}
                  className="focus:outline-none"
                  style={{ backgroundColor: 'rgba(244,244,245,1)', border: '2px solid rgba(212,212,216,1)', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'rgba(38,38,38,1)', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%23737373' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                >
                  {INTERVAL_OPTIONS_SECONDS.map((intervalSeconds) => (
                    <option key={intervalSeconds} value={intervalSeconds}>
                      Every {intervalSeconds} seconds
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void startSession()}
            className="w-full rounded-md border border-neutral-800 bg-neutral-800 px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-700 sm:w-auto"
          >
            Start Test Session
          </button>
          {error && (
            <div className="w-full rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (sessionState === 'preparing') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center rounded-md bg-neutral-100 px-8 py-10 text-center text-neutral-900">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-800" />
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-neutral-400">
          Preparing Session
        </p>
        <p className="mt-3 text-lg text-neutral-700">
          Generating realistic examiner questions for your mock thesis defense...
        </p>
      </div>
    );
  }

  if (sessionState === 'running') {
    return (
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-md bg-neutral-100 px-5 py-5 text-neutral-900">
        <div className="relative flex items-start justify-between gap-4">
          <div className="rounded-md border border-neutral-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
            <p className="text-sm text-neutral-500">
              Question {Math.min(currentQuestionIndex + 1, questions.length)}/{questions.length}
            </p>
          </div>
          <div className="flex flex-1 items-start justify-center pt-9">
            <div className="flex h-12 items-end gap-1">
              {soundwaveBars.map((bar) => (
                <span
                  key={bar.id}
                  className="block w-1.5 bg-neutral-900 transition-[height] duration-50 linear"
                  style={{ height: `${bar.height}px` }}
                />
              ))}
            </div>
          </div>
          <div className="rounded-md border border-neutral-200 bg-white/95 px-4 py-3 text-right shadow-sm backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
              Time Remaining
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold text-neutral-900">
              {formatTimeRemaining(timeRemainingSeconds)}
            </p>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center py-4">
          <div className="w-full rounded-[0.6rem] border border-neutral-200 bg-white px-5 py-6 text-center shadow-sm sm:px-10 sm:py-10">
            <h2 className="text-xl font-semibold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
              {currentQuestion}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-6 text-neutral-500">
              Speak your answer naturally as if you were defending your thesis to an examiner.
            </p>
          </div>
        </div>

        <div className="relative flex items-center justify-between gap-4 rounded-md border border-neutral-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
          <p className="text-sm font-medium text-neutral-800">{listeningIndicator}</p>
          <button
            type="button"
            onClick={() => void finishSession(true)}
            className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
          >
            Stop Session
          </button>
        </div>
      </div>
    );
  }

  if (sessionState === 'evaluating') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center rounded-md bg-neutral-100 px-8 py-10 text-center text-neutral-900">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-800" />
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-neutral-400">
          Evaluating Session
        </p>
        <p className="mt-3 text-lg text-neutral-700">
          Building your mock-defense coaching dashboard...
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Transcript segments captured: {transcriptEntries.length}
        </p>
      </div>
    );
  }

  if (sessionState === 'finished' && evaluation) {
    return (
      <div className="flex h-full w-full flex-col rounded-md bg-neutral-100 px-6 py-6 text-neutral-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-400">
              Results Dashboard
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900">
              Thesis Presentation Test Summary
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Review your delivery coaching and thesis-defense feedback below.
            </p>
          </div>
          <button
            type="button"
            onClick={resetSession}
            className="rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Try again
          </button>
        </div>

        {sessionWarning && (
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {sessionWarning}
          </div>
        )}

        <div className="mt-6 grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Delivery Feedback
            </p>
            <h3 className="mt-3 text-xl font-semibold text-neutral-900">Presence and delivery</h3>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              {safeEvaluation.deliveryFeedback.summary}
            </p>
            <div className="mt-5 space-y-3 text-sm text-neutral-700">
              <div><span className="font-semibold text-neutral-900">Confidence:</span> <span className="ml-1 text-amber-500">{renderStars(safeEvaluation.deliveryFeedback.confidence.rating)}</span><div className="mt-1 text-neutral-700">{safeEvaluation.deliveryFeedback.confidence.feedback}</div></div>
              <div><span className="font-semibold text-neutral-900">Tonality:</span> <span className="ml-1 text-amber-500">{renderStars(safeEvaluation.deliveryFeedback.tonality.rating)}</span><div className="mt-1 text-neutral-700">{safeEvaluation.deliveryFeedback.tonality.feedback}</div></div>
              <div><span className="font-semibold text-neutral-900">Clarity:</span> <span className="ml-1 text-amber-500">{renderStars(safeEvaluation.deliveryFeedback.clarity.rating)}</span><div className="mt-1 text-neutral-700">{safeEvaluation.deliveryFeedback.clarity.feedback}</div></div>
              <div><span className="font-semibold text-neutral-900">Pacing:</span> <span className="ml-1 text-amber-500">{renderStars(safeEvaluation.deliveryFeedback.pacing.rating)}</span><div className="mt-1 text-neutral-700">{safeEvaluation.deliveryFeedback.pacing.feedback}</div></div>
              <div><span className="font-semibold text-neutral-900">Filler words:</span> <span className="ml-1 text-amber-500">{renderStars(safeEvaluation.deliveryFeedback.fillerWords.rating)}</span><div className="mt-1 text-neutral-700">{safeEvaluation.deliveryFeedback.fillerWords.feedback}</div></div>
            </div>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Thesis Defense Quality
            </p>
            <h3 className="mt-3 text-xl font-semibold text-neutral-900">Examiner-facing performance</h3>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              {safeEvaluation.defenseFeedback.summary}
            </p>
            <div className="mt-5 space-y-3 text-sm text-neutral-700">
              <div><span className="font-semibold text-neutral-900">Question handling:</span> <span className="ml-1 text-amber-500">{renderStars(safeEvaluation.defenseFeedback.questionHandling.rating)}</span><div className="mt-1 text-neutral-700">{safeEvaluation.defenseFeedback.questionHandling.feedback}</div></div>
              <div><span className="font-semibold text-neutral-900">Argument strength:</span> <span className="ml-1 text-amber-500">{renderStars(safeEvaluation.defenseFeedback.argumentStrength.rating)}</span><div className="mt-1 text-neutral-700">{safeEvaluation.defenseFeedback.argumentStrength.feedback}</div></div>
              <div><span className="font-semibold text-neutral-900">Academic precision:</span> <span className="ml-1 text-amber-500">{renderStars(safeEvaluation.defenseFeedback.academicPrecision.rating)}</span><div className="mt-1 text-neutral-700">{safeEvaluation.defenseFeedback.academicPrecision.feedback}</div></div>
              <div><span className="font-semibold text-neutral-900">Defense quality:</span> <span className="ml-1 text-amber-500">{renderStars(safeEvaluation.defenseFeedback.defenseQuality.rating)}</span><div className="mt-1 text-neutral-700">{safeEvaluation.defenseFeedback.defenseQuality.feedback}</div></div>
            </div>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm xl:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Overall Summary
            </p>
            <p className="mt-3 text-base leading-7 text-neutral-700">
              {safeEvaluation.overallSummary}
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm xl:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Quoted Evidence
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {safeEvaluation.quotedEvidence.length > 0 ? safeEvaluation.quotedEvidence.map((quote, index) => (
                <div key={`${quote}-${index}`} className="rounded-md bg-neutral-50 px-4 py-4 text-sm italic leading-6 text-neutral-700">
                  "{quote}"
                </div>
              )) : (
                <div className="rounded-md bg-neutral-50 px-4 py-4 text-sm leading-6 text-neutral-500 md:col-span-3">
                  No strong quoted evidence was available for this session.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm xl:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Concrete Improvements
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {safeEvaluation.improvements.map((improvement, index) => (
                <div key={`${improvement}-${index}`} className="rounded-md bg-neutral-50 px-4 py-4 text-sm leading-6 text-neutral-700">
                  {improvement}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm xl:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
                  Full Transcript
                </p>
                <p className="mt-2 text-sm text-neutral-500">
                  Review the full captured session transcript question by question.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTranscriptExpanded((currentValue) => !currentValue)}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                {transcriptExpanded ? 'Hide transcript' : 'Show transcript'}
              </button>
            </div>

            {transcriptExpanded && (
              <div className="mt-5 space-y-4">
                {transcriptEntries.length === 0 ? (
                  <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-500">
                    No transcript segments were captured during this session.
                  </div>
                ) : (
                  transcriptEntries.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                        Segment {index + 1}
                      </p>
                      <p className="mt-2 text-sm font-medium text-neutral-800">
                        Question {entry.questionIndex + 1}: {questions[entry.questionIndex] ?? 'Unknown question'}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
                        {entry.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-md bg-neutral-100 px-8 py-10 text-center text-neutral-900">
      <p className="text-lg text-neutral-700">Something went wrong while preparing the test session.</p>
      {error && (
        <div className="mt-4 max-w-xl rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={resetSession}
        className="mt-6 rounded-md border border-neutral-900 bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
      >
        Try again
      </button>
    </div>
  );
}
