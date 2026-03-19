import express, { Request, Response, Router } from 'express';
import { randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import OpenAI from 'openai';
import { requireAuth } from '../middleware/auth';

const router = Router();

function sanitizeMimeType(mimeType: string) {
  return mimeType.split(';')[0]?.trim().toLowerCase() || 'audio/webm';
}

function getAudioExtension(mimeType: string) {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

router.post(
  '/transcriptions',
  requireAuth,
  async (req: Request, res: Response) => {
    const { audioBase64, mimeType: providedMimeType } = req.body ?? {};
    const mimeType = sanitizeMimeType(
      typeof providedMimeType === 'string' ? providedMimeType : 'audio/webm'
    );

    if (typeof audioBase64 !== 'string' || audioBase64.length === 0) {
      res.status(400).json({ error: 'Audio payload is required.' });
      return;
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');

    if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
      res.status(400).json({ error: 'Audio payload is required.' });
      return;
    }

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const extension = getAudioExtension(mimeType);

      if (!['webm', 'wav', 'mp3', 'mp4', 'ogg'].includes(extension)) {
        res.status(400).json({ error: `Unsupported audio format: ${mimeType}` });
        return;
      }

      const tempFilePath = path.join(os.tmpdir(), `speech-upload-${randomUUID()}.${extension}`);

      await fs.writeFile(tempFilePath, audioBuffer);

      try {
        const primaryTranscription = await openai.audio.transcriptions.create({
          file: createReadStream(tempFilePath),
          model: 'whisper-1',
        });

        const primaryText = primaryTranscription.text?.trim() ?? '';
        if (primaryText) {
          res.json({ text: primaryText });
          return;
        }

        const fallbackTranscription = await openai.audio.transcriptions.create({
          file: createReadStream(tempFilePath),
          model: 'gpt-4o-mini-transcribe',
        });

        res.json({ text: fallbackTranscription.text?.trim() ?? '' });
      } finally {
        await fs.unlink(tempFilePath).catch(() => undefined);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transcription request failed.';
      console.error('speech transcription failed', {
        mimeType,
        bytes: audioBuffer.length,
        message,
      });
      res.status(500).json({ error: message });
    }
  }
);

export { router as speechRouter };
