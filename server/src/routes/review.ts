import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { reviewThesisChunks } from '../services/thesisChunkReviewService';

const router = Router();

router.post('/thesis', requireAuth, async (req: Request, res: Response) => {
  const { documentType, estimatedPageCount, chunks } = req.body ?? {};

  if (!Array.isArray(chunks)) {
    res.status(400).json({ error: 'chunks array is required' });
    return;
  }

  if (chunks.length === 0) {
    res.status(400).json({ error: 'chunks array is empty' });
    return;
  }

  if (!chunks.every(isValidChunkInput)) {
    res.status(400).json({ error: 'invalid chunk objects' });
    return;
  }

  try {
    const result = await reviewThesisChunks({
      documentType,
      estimatedPageCount,
      chunks,
    });

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'review request failed';
    const statusCode = message.includes('configured') ? 500 : 502;
    res.status(statusCode).json({ error: message });
  }
});

function isValidChunkInput(chunk: unknown) {
  if (!chunk || typeof chunk !== 'object') {
    return false;
  }

  const maybeChunk = chunk as { chunkIndex?: unknown; text?: unknown };
  return (
    Number.isInteger(maybeChunk.chunkIndex)
    && typeof maybeChunk.text === 'string'
    && maybeChunk.text.trim().length > 0
  );
}

export { router as reviewRouter };
