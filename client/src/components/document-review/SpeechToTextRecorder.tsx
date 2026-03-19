import { useCallback, useEffect, useRef, useState } from 'react';
import { transcribeRecordedAudio } from '@/services/speechTranscriptionService';

type TranscriptEntry = {
  id: number;
  text: string;
};

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

export default function SpeechToTextRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [lastRecordingUrl, setLastRecordingUrl] = useState<string | null>(null);
  const [lastRecordingDetails, setLastRecordingDetails] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const recordingStartedAtRef = useRef<number | null>(null);
  const stopPromiseResolverRef = useRef<(() => void) | null>(null);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const appendTranscript = useCallback((text: string) => {
    setTranscriptEntries((currentEntries) => [
      ...currentEntries,
      {
        id: transcriptIdRef.current++,
        text,
      },
    ]);
  }, []);

  const finalizeRecording = useCallback(async () => {
    const audioBlob = new Blob(audioChunksRef.current, {
      type: mediaRecorderRef.current?.mimeType || 'audio/webm',
    });

    audioChunksRef.current = [];
    stopTracks();
    mediaRecorderRef.current = null;

    if (!isMountedRef.current) {
      return;
    }

    if (audioBlob.size === 0) {
      setError('No audio was captured. Please try recording again.');
      return;
    }

    if (lastRecordingUrl) {
      URL.revokeObjectURL(lastRecordingUrl);
    }

    const nextRecordingUrl = URL.createObjectURL(audioBlob);
    setLastRecordingUrl(nextRecordingUrl);
    setLastRecordingDetails(`${Math.max(1, Math.round(audioBlob.size / 1024))} KB • ${audioBlob.type || 'unknown audio format'}`);

    setIsTranscribing(true);
    setError(null);

    try {
      const result = await transcribeRecordedAudio(audioBlob);
      const transcriptText = result.text.trim();

      if (!transcriptText) {
        setError('No transcript could be extracted from that recording. Please speak a bit longer and try again.');
        return;
      }

      appendTranscript(transcriptText);
    } catch (transcriptionError) {
      const message = transcriptionError instanceof Error
        ? transcriptionError.message
        : 'Transcription failed. Please try again.';

      setError(message);
    } finally {
      if (isMountedRef.current) {
        setIsTranscribing(false);
      }
    }
  }, [appendTranscript, lastRecordingUrl, stopTracks]);

  const startRecording = useCallback(async () => {
    if (isRecording || isTranscribing) {
      return;
    }

    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      setError('Audio recording is not available in this environment.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not support microphone recording.');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      setError('This browser does not support audio capture.');
      return;
    }

    try {
      setError(null);

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

      streamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 120);
        });

        stopPromiseResolverRef.current?.();
        stopPromiseResolverRef.current = null;
        void finalizeRecording();
      };

      mediaRecorder.start(1000);
      recordingStartedAtRef.current = Date.now();
      setIsRecording(true);
    } catch (recordingError) {
      stopTracks();

      if (recordingError instanceof DOMException && recordingError.name === 'NotAllowedError') {
        setError('Microphone access was denied. Please allow microphone access and try again.');
        return;
      }

      const message = recordingError instanceof Error
        ? recordingError.message
        : 'Could not start recording.';

      setError(message);
    }
  }, [finalizeRecording, isRecording, isTranscribing, stopTracks]);

  const stopRecording = useCallback(async () => {
    const mediaRecorder = mediaRecorderRef.current;

    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      return;
    }

    const startedAt = recordingStartedAtRef.current;
    if (startedAt !== null && Date.now() - startedAt < 1200) {
      setError('Please record for at least a moment before stopping so speech can be captured.');
      return;
    }

    setError(null);
    setIsRecording(false);

    const stopCompleted = new Promise<void>((resolve) => {
      stopPromiseResolverRef.current = resolve;
    });

    mediaRecorder.requestData();
    mediaRecorder.stop();
    await stopCompleted;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      const mediaRecorder = mediaRecorderRef.current;
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.onstop = null;
        stopPromiseResolverRef.current?.();
        stopPromiseResolverRef.current = null;
        mediaRecorder.stop();
      }

      if (lastRecordingUrl) {
        URL.revokeObjectURL(lastRecordingUrl);
      }

      stopTracks();
    };
  }, [lastRecordingUrl, stopTracks]);

  const buttonLabel = isRecording
    ? 'Stop recording'
    : isTranscribing
      ? 'Transcribing...'
      : 'Start recording';

  const statusLabel = isRecording
    ? 'Recording in progress'
    : isTranscribing
      ? 'Transcribing audio'
      : 'Ready to record';

  return (
    <div className="flex h-full min-h-0 w-full flex-col rounded-md bg-neutral-100 px-5 py-5 text-neutral-900">
      <div className="flex justify-center">
        <button
          type="button"
          onClick={isRecording ? stopRecording : () => void startRecording()}
          disabled={isTranscribing}
          className={`rounded-md px-5 py-2.5 text-sm font-medium shadow-sm transition ${
            isRecording
              ? 'border border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
              : 'border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50'
          } disabled:cursor-not-allowed disabled:opacity-70`}
        >
          {buttonLabel}
        </button>
      </div>

      <div className="mt-5 rounded-md border border-neutral-200 bg-white px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
          Speech To Text
        </p>
        <p className="mt-2 text-lg font-medium text-neutral-800">{statusLabel}</p>
        <p className="mt-2 text-sm text-neutral-500">
          Click start, speak into your microphone, then stop to upload the recording for transcription.
        </p>
        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {isTranscribing && (
          <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
            Uploading audio and generating transcript...
          </div>
        )}
        {lastRecordingUrl && (
          <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
              Last Recording
            </p>
            {lastRecordingDetails && (
              <p className="mt-1 text-xs text-neutral-500">{lastRecordingDetails}</p>
            )}
            <audio className="mt-3 w-full" controls src={lastRecordingUrl}>
              Your browser does not support audio playback.
            </audio>
          </div>
        )}
      </div>

      <div className="mt-5 min-h-0 flex-1 rounded-md border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-800">Transcript Log</p>
          <p className="mt-1 text-xs text-neutral-500">
            Completed recordings are appended here in chronological order.
          </p>
        </div>
        <div className="h-full max-h-full overflow-y-auto px-4 py-4">
          {transcriptEntries.length === 0 ? (
            <div className="flex h-full min-h-[12rem] items-center justify-center rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-6 text-center text-sm text-neutral-500">
              No transcript entries yet. Start a recording to create your first transcript.
            </div>
          ) : (
            <div className="space-y-3">
              {transcriptEntries.map((entry, index) => (
                <div key={entry.id} className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                    Entry {index + 1}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-neutral-800">{entry.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
