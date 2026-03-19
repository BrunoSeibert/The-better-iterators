import { api } from './api';

export type PresentationTestTranscriptEntry = {
  id: number;
  text: string;
  questionIndex: number;
  startedAtMs: number;
  endedAtMs: number;
};

export type PresentationTestEvaluation = {
  deliveryFeedback: {
    summary: string;
    confidence: { rating: number; feedback: string };
    tonality: { rating: number; feedback: string };
    clarity: { rating: number; feedback: string };
    pacing: { rating: number; feedback: string };
    fillerWords: { rating: number; feedback: string };
  };
  defenseFeedback: {
    summary: string;
    questionHandling: { rating: number; feedback: string };
    argumentStrength: { rating: number; feedback: string };
    academicPrecision: { rating: number; feedback: string };
    defenseQuality: { rating: number; feedback: string };
  };
  overallSummary: string;
  improvements: string[];
  quotedEvidence: string[];
};

export async function generatePresentationTestQuestions(questionCount: number) {
  const res = await api.post<{ questions: string[] }>('/presentation-test/questions', {
    questionCount,
  });

  return res.data.questions;
}

export async function evaluatePresentationTestSession(payload: {
  questions: string[];
  transcriptEntries: PresentationTestTranscriptEntry[];
  durationSeconds: number;
}) {
  const res = await api.post<PresentationTestEvaluation>('/presentation-test/evaluate', payload);
  return res.data;
}
