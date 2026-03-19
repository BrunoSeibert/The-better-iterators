import { api } from './api';
import type { ReviewAiResponse, ReviewChunkPayload } from '@/components/document-review/types';

export async function reviewDocumentChunks(
  chunks: ReviewChunkPayload[],
  estimatedPageCount: number
) {
  const payload = {
    documentType: 'Master Thesis',
    estimatedPageCount,
    chunks,
  };

  const res = await api.post('/review/thesis', payload);
  return res.data as ReviewAiResponse;
}
