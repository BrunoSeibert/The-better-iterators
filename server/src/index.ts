import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(morgan('dev'));
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Routes
import { chatRouter } from './routes/chat';
import authRoutes from './routes/authRoutes';
import dataRoutes from './routes/data';
import { reviewRouter } from './routes/review';
import topicsRoutes from './routes/topics';
import literatureRoutes from './routes/literature';
import checkinRoutes from './routes/checkin';
import proposalRoutes from './routes/proposal';
app.use('/api/chat', chatRouter);
app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/review', reviewRouter);
app.use('/api/topics', topicsRoutes);
app.use('/api/literature', literatureRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/proposal', proposalRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
