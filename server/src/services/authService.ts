import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../config/db';

export async function register(name: string, email: string, password: string) {
  const existing = await db.query('SELECT id FROM "User" WHERE email = $1', [email]);
  if (existing.rows.length > 0) throw new Error('Email already in use');

  const hashed = await bcrypt.hash(password, 10);
  const result = await db.query(
    'INSERT INTO "User" (id, name, email, password) VALUES (gen_random_uuid()::TEXT, $1, $2, $3) RETURNING id, name, email',
    [name, email, hashed]
  );
  const user = result.rows[0];
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  return { user, token };
}

export async function login(email: string, password: string) {
  const result = await db.query('SELECT * FROM "User" WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user) throw new Error('Invalid credentials');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error('Invalid credentials');

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  const { password: _, ...safeUser } = user;
  return { user: safeUser, token };
}
