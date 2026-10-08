import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { unifiedSignIn, getUserSession, friendlyAuthError } from './adminAuth';
import LogoImage from '../../assets/logoj2.png';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  // If already signed in, check session type and redirect appropriately
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const session = await getUserSession(user.uid);
          if (session && session.redirect) {
            navigate(session.redirect, { replace: true });
          }
        } catch {
          // Not authorized — remain on login page
        }
      }
    });
    return () => unsub();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter your email and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await unifiedSignIn(email.trim(), password);
      navigate(res.redirect, { replace: true });
    } catch (err) {
      setErrorMessage(friendlyAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.glowTop} />

      <div style={s.card}>
        {/* Brand Header */}
        <div style={s.brand}>
          <div style={s.logoBadge}>
            <img
              src={LogoImage}
              alt="Kiyuziyu"
              style={s.logoImg}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <h1 style={s.brandTitle}>KIYUZIYU</h1>
          <p style={s.brandSub}>Admin / Tenant Portal</p>
          <div style={s.divider} />
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div style={s.errorBox} role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={s.errorText}>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={s.form} noValidate>
          {/* Email Field */}
          <div style={s.field}>
            <label style={s.label} htmlFor="portal-email">Email Address</label>
            <div style={s.inputWrap}>
              <svg style={s.fieldIcon} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <input
                id="portal-email"
                type="email"
                required
                autoComplete="email"
                placeholder="user@kiyuziyu.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                style={s.input}
              />
            </div>
          </div>

          {/* Password Field */}
          <div style={s.field}>
            <label style={s.label} htmlFor="portal-password">Password</label>
            <div style={s.inputWrap}>
              <svg style={s.fieldIcon} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                id="portal-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                style={s.input}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={s.eyeBtn}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{ ...s.submitBtn, opacity: isSubmitting ? 0.72 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
          >
            {isSubmitting ? (
              <span style={s.btnInner}>
                <span style={s.spinner} />
                Authenticating...
              </span>
            ) : (
              <span style={s.btnInner}>
                Sign In
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 8 }}>
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            )}
          </button>
        </form>

        {/* Footer Link */}
        <div style={s.footer}>
          <span style={s.footerText}>Need an admin account?</span>
          <Link to="/admin/signup" style={s.footerLink}>Create an account</Link>
        </div>

        {/* Security Note */}
        <div style={s.secNote}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#b89620" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Secured via Firebase Authentication</span>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes adminSpin { to { transform: rotate(360deg); } }
        #portal-email::placeholder, #portal-password::placeholder {
          color: #94a3b8;
        }
        #portal-email:focus, #portal-password:focus {
          border-color: #d4af37 !important;
          box-shadow: 0 0 0 3px rgba(212,175,55,0.15) !important;
          outline: none !important;
        }
      `}</style>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    backgroundImage:
      'radial-gradient(circle at 50% 0%, rgba(212,175,55,0.08) 0%, transparent 50%), ' +
      'radial-gradient(circle at 80% 90%, rgba(226,232,240,0.6) 0%, transparent 50%)',
    padding: '24px',
    boxSizing: 'border-box',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  glowTop: {
    position: 'fixed',
    top: '-120px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '500px',
    height: '300px',
    background: 'radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 65%)',
    filter: 'blur(40px)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  card: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '420px',
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    border: '1px solid #e2e8f0',
    boxShadow:
      '0 20px 40px -15px rgba(15,23,42,0.07), ' +
      '0 0 0 1px rgba(212,175,55,0.12), ' +
      '0 8px 16px -4px rgba(15,23,42,0.03)',
    padding: '40px 36px 32px',
    boxSizing: 'border-box',
  },
  brand: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  logoBadge: {
    width: '68px',
    height: '68px',
    margin: '0 auto 14px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    border: '1px solid #fde68a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 20px rgba(212,175,55,0.15)',
  },
  logoImg: {
    width: '46px',
    height: '46px',
    objectFit: 'contain',
  },
  brandTitle: {
    margin: '0 0 4px',
    fontSize: '22px',
    fontWeight: '700',
    letterSpacing: '0.18em',
    color: '#0f172a',
  },
  brandSub: {
    margin: '0 0 20px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#b89620',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
  },
  divider: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, #e2e8f0, transparent)',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    padding: '11px 14px',
    marginBottom: '20px',
    marginTop: '4px',
  },
  errorText: {
    color: '#991b1b',
    fontSize: '13px',
    lineHeight: '1.5',
    fontWeight: '500',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    marginTop: '24px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#334155',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  inputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  fieldIcon: {
    position: 'absolute',
    left: '13px',
    width: '16px',
    height: '16px',
    color: '#64748b',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '11px 42px 11px 40px',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    color: '#0f172a',
    fontSize: '14px',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  eyeBtn: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    color: '#64748b',
  },
  submitBtn: {
    marginTop: '6px',
    padding: '13px 20px',
    background: 'linear-gradient(135deg, #d4af37 0%, #b89620 100%)',
    border: 'none',
    borderRadius: '11px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    letterSpacing: '0.03em',
    boxShadow: '0 4px 14px rgba(212,175,55,0.35)',
    transition: 'opacity 0.2s, transform 0.15s',
    width: '100%',
    fontFamily: 'inherit',
  },
  btnInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: '13px',
    height: '13px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTop: '2px solid #ffffff',
    borderRadius: '50%',
    marginRight: '8px',
    display: 'inline-block',
    animation: 'adminSpin 0.75s linear infinite',
  },
  footer: {
    marginTop: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  footerText: {
    fontSize: '13px',
    color: '#64748b',
  },
  footerLink: {
    fontSize: '13px',
    color: '#b89620',
    textDecoration: 'none',
    fontWeight: '600',
  },
  secNote: {
    marginTop: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontSize: '11px',
    color: '#64748b',
    letterSpacing: '0.03em',
  },
};
