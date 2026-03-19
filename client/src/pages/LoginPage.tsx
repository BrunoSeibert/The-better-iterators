import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import * as authService from '../services/authService';
import StudyondLogo from '../components/ui/StudyondLogo';

const emailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const passwordSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type EmailForm = z.infer<typeof emailSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

type Step = 'email' | 'password' | 'register';

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;

  useEffect(() => {
    if (token) {
      navigate(returnTo ?? '/dashboard');
    }
  }, [navigate, returnTo, token]);

  const emailForm = useForm<EmailForm>({ resolver: zodResolver(emailSchema) });
  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  function handleEmail(data: EmailForm) {
    setEmail(data.email);
    setError('');
    setStep('password');
  }

  async function handleLogin(data: PasswordForm) {
    try {
      setError('');
      const result = await authService.login(email, data.password);
      setAuth(result.user, result.token);
      navigate(result.user.isOnboarded ? (returnTo ?? '/dashboard') : '/onboarding');
    } catch {
      setError('Invalid email or password');
    }
  }

  async function handleRegister(data: RegisterForm) {
    try {
      setError('');
      const result = await authService.register(data.name, data.email, data.password);
      setAuth(result.user, result.token);
      navigate('/onboarding');
    } catch {
      setError('Registration failed. Email may already be in use.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-full max-w-lg px-10 py-16 flex flex-col items-center">

        {/* Logo */}
        <StudyondLogo className="h-10 w-auto mb-12" />

        {/* Heading */}
        <h1 className="ds-title-xl font-light text-[--foreground] mb-3 text-center">
          {step === 'register' ? 'Sign up' : 'Welcome'}
        </h1>

        <p className="ds-body text-center mb-10" style={{ color: 'var(--muted-foreground)', maxWidth: 360 }}>
          {step === 'register'
            ? 'Create your Studyond account.'
            : 'Log in to Studyond. The login is restricted to university and company email addresses.'}
        </p>

        {error && (
          <p className="ds-small text-red-500 mb-4 text-center">{error}</p>
        )}

        {/* Email step */}
        {step === 'email' && (
          <form onSubmit={emailForm.handleSubmit(handleEmail)} className="w-full space-y-4">
            <input
              {...emailForm.register('email')}
              placeholder="Email address*"
              type="email"
              className="w-full border rounded-2xl px-5 py-4 ds-body placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
              style={{ borderColor: 'var(--border)' }}
            />
            {emailForm.formState.errors.email && (
              <p className="ds-caption text-red-500 mt-1">{emailForm.formState.errors.email.message}</p>
            )}
            <button
              type="submit"
              className="w-full py-4 rounded-2xl ds-label text-base transition hover:opacity-90"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              Continue
            </button>
          </form>
        )}

        {/* Password step */}
        {step === 'password' && (
          <form onSubmit={passwordForm.handleSubmit(handleLogin)} className="w-full space-y-4">
            <p className="ds-small text-center" style={{ color: 'var(--muted-foreground)' }}>{email}</p>
            <input
              {...passwordForm.register('password')}
              placeholder="Password*"
              type="password"
              className="w-full border rounded-2xl px-5 py-4 ds-body placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
              style={{ borderColor: 'var(--border)' }}
            />
            {passwordForm.formState.errors.password && (
              <p className="ds-caption text-red-500 mt-1">{passwordForm.formState.errors.password.message}</p>
            )}
            <button
              type="submit"
              className="w-full py-4 rounded-2xl ds-label text-base transition hover:opacity-90"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => { setStep('email'); setError(''); }}
              className="w-full ds-small hover:underline"
              style={{ color: 'var(--muted-foreground)' }}
            >
              ← Back
            </button>
          </form>
        )}

        {/* Register step */}
        {step === 'register' && (
          <form onSubmit={registerForm.handleSubmit(handleRegister)} className="w-full space-y-4">
            <input
              {...registerForm.register('name')}
              placeholder="Full name*"
              className="w-full border rounded-2xl px-5 py-4 ds-body placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
              style={{ borderColor: 'var(--border)' }}
            />
            {registerForm.formState.errors.name && (
              <p className="ds-caption text-red-500 mt-1">{registerForm.formState.errors.name.message}</p>
            )}
            <input
              {...registerForm.register('email')}
              placeholder="Email address*"
              type="email"
              className="w-full border rounded-2xl px-5 py-4 ds-body placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
              style={{ borderColor: 'var(--border)' }}
            />
            {registerForm.formState.errors.email && (
              <p className="ds-caption text-red-500 mt-1">{registerForm.formState.errors.email.message}</p>
            )}
            <input
              {...registerForm.register('password')}
              placeholder="Password*"
              type="password"
              className="w-full border rounded-2xl px-5 py-4 ds-body placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
              style={{ borderColor: 'var(--border)' }}
            />
            {registerForm.formState.errors.password && (
              <p className="ds-caption text-red-500 mt-1">{registerForm.formState.errors.password.message}</p>
            )}
            <button
              type="submit"
              className="w-full py-4 rounded-2xl ds-label text-base transition hover:opacity-90"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={() => { setStep('email'); setError(''); }}
              className="w-full ds-small hover:underline"
              style={{ color: 'var(--muted-foreground)' }}
            >
              ← Back
            </button>
          </form>
        )}

        {/* Footer */}
        {step === 'email' && (
          <p className="mt-8 ds-small" style={{ color: 'var(--muted-foreground)' }}>
            Don't have an account?{' '}
            <button
              onClick={() => {
              const emailValue = emailForm.getValues('email');
              if (emailValue) setEmail(emailValue);
              setStep('register');
              setError('');
            }}
              className="font-bold hover:underline"
              style={{ color: 'var(--foreground)' }}
            >
              Sign up
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
