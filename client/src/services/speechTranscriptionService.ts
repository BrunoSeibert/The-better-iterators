import axios from 'axios';
import { api } from './api';

type TranscriptionResponse = {
  text: string;
};

async function blobToBase64(audioBlob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const result = reader.result;

      if (typeof result !== 'string') {
        reject(new Error('Could not encode audio for upload.'));
        return;
      }

      const encoded = result.split(',')[1];
      if (!encoded) {
        reject(new Error('Could not encode audio for upload.'));
        return;
      }

      resolve(encoded);
    };

    reader.onerror = () => {
      reject(new Error('Could not encode audio for upload.'));
    };

    reader.readAsDataURL(audioBlob);
  });
}

export async function transcribeRecordedAudio(audioBlob: Blob) {
  try {
    const mimeType = audioBlob.type || 'audio/webm';
    const audioBase64 = await blobToBase64(audioBlob);

    const res = await api.post<TranscriptionResponse>('/speech/transcriptions', {
      audioBase64,
      mimeType,
    });

    return res.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const serverMessage = error.response?.data?.error;
      throw new Error(
        typeof serverMessage === 'string' ? serverMessage : 'Transcription failed. Please try again.'
      );
    }

    throw error;
  }
}
