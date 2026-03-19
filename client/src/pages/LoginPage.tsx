import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import * as authService from '../services/authService';
import StudyondLogo from '../components/ui/StudyondLogo';

const C = {
  darkBrown:  'rgba(38,38,38,1)',
  midBrown:   'rgba(82,82,91,1)',
  tan:        'rgba(161,161,170,1)',
  lightTan:   'rgba(228,228,231,1)',
  cream:      'rgba(250,250,250,1)',
  warmWhite:  'rgba(244,244,245,1)',
  border:     'rgba(212,212,216,1)',
  mutedText:  'rgba(113,113,122,1)',
};

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

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: `2px solid ${C.border}`,
  borderRadius: 16,
  padding: '14px 20px',
  fontSize: 15,
  color: C.darkBrown,
  backgroundColor: C.cream,
  outline: 'none',
};

const primaryBtn: React.CSSProperties = {
  width: '100%',
  padding: '14px 0',
  borderRadius: 16,
  fontSize: 15,
  fontWeight: 700,
  backgroundColor: C.darkBrown,
  color: C.cream,
  border: 'none',
  cursor: 'pointer',
};

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
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.warmWhite }}>
      <div className="w-full max-w-lg px-10 py-16 flex flex-col items-center">

        <StudyondLogo className="h-10 w-auto mb-12" />

        <h1 className="text-3xl font-bold mb-3 text-center" style={{ color: C.darkBrown }}>
          {step === 'register' ? 'Sign up' : 'Welcome'}
        </h1>

        <p className="text-sm text-center mb-10" style={{ color: C.mutedText, maxWidth: 360 }}>
          {step === 'register'
            ? 'Create your Studyond account.'
            : 'Log in to Studyond. The login is restricted to university and company email addresses.'}
        </p>

        {error && (
          <p className="text-sm text-red-500 mb-4 text-center">{error}</p>
        )}

        {/* Email step */}
        {step === 'email' && (
          <form onSubmit={emailForm.handleSubmit(handleEmail)} className="w-full space-y-4">
            <input
              {...emailForm.register('email')}
              placeholder="Email address*"
              type="email"
              style={inputStyle}
            />
            {emailForm.formState.errors.email && (
              <p className="text-xs text-red-500 mt-1">{emailForm.formState.errors.email.message}</p>
            )}
            <button type="submit" style={primaryBtn}>
              Continue
            </button>
          </form>
        )}

        {/* Password step */}
        {step === 'password' && (
          <form onSubmit={passwordForm.handleSubmit(handleLogin)} className="w-full space-y-4">
            <p className="text-sm text-center" style={{ color: C.mutedText }}>{email}</p>
            <input
              {...passwordForm.register('password')}
              placeholder="Password*"
              type="password"
              style={inputStyle}
            />
            {passwordForm.formState.errors.password && (
              <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.password.message}</p>
            )}
            <button type="submit" style={primaryBtn}>
              Log in
            </button>
            <button
              type="button"
              onClick={() => { setStep('email'); setError(''); }}
              className="w-full text-sm hover:underline"
              style={{ color: C.mutedText, background: 'none', border: 'none', cursor: 'pointer' }}
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
              style={inputStyle}
            />
            {registerForm.formState.errors.name && (
              <p className="text-xs text-red-500 mt-1">{registerForm.formState.errors.name.message}</p>
            )}
            <input
              {...registerForm.register('email')}
              placeholder="Email address*"
              type="email"
              style={inputStyle}
            />
            {registerForm.formState.errors.email && (
              <p className="text-xs text-red-500 mt-1">{registerForm.formState.errors.email.message}</p>
            )}
            <input
              {...registerForm.register('password')}
              placeholder="Password*"
              type="password"
              style={inputStyle}
            />
            {registerForm.formState.errors.password && (
              <p className="text-xs text-red-500 mt-1">{registerForm.formState.errors.password.message}</p>
            )}
            <button type="submit" style={primaryBtn}>
              Sign up
            </button>
            <button
              type="button"
              onClick={() => { setStep('email'); setError(''); }}
              className="w-full text-sm hover:underline"
              style={{ color: C.mutedText, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ← Back
            </button>
          </form>
        )}

        {step === 'email' && (
          <p className="mt-8 text-sm" style={{ color: C.mutedText }}>
            Don't have an account?{' '}
            <button
              onClick={() => {
                const emailValue = emailForm.getValues('email');
                if (emailValue) setEmail(emailValue);
                setStep('register');
                setError('');
              }}
              className="font-bold hover:underline"
              style={{ color: C.darkBrown, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Sign up
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
