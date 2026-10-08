import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { adminSignUp, friendlyAuthError } from './adminAuth';
import LogoImage from '../../assets/logoj2.png';

export default function AdminSignup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      await adminSignUp(name.trim(), email.trim(), password);
      setSuccessMessage('Account created! Redirecting to login...');
      setTimeout(() => navigate('/admin/login', { replace: true }), 2000);
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
        {/* Brand */}
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
          <p style={s.brandSub}>Admin Portal — Create Account</p>
          <div style={s.divider} />
        </div>

        {/* Security note */}
        <div style={s.infoBox}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span style={s.infoText}>
            Roles are assigned by the system administrator. You cannot self-assign administrator privileges.
          </span>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div style={s.errorBox} role="alert">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={s.errorText}>{errorMessage}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div style={s.successBox} role="status">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span style={s.successText}>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={s.form} noValidate>
          {/* Full Name */}
          <div style={s.field}>
            <label style={s.label} htmlFor="signup-name">Full Name</label>
            <div style={s.inputWrap}>
              <svg style={s.fieldIcon} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                id="signup-name"
                type="text"
                required
                autoComplete="name"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                style={s.input}
              />
            </div>
          </div>

          {/* Email */}
          <div style={s.field}>
            <label style={s.label} htmlFor="signup-email">Email Address</label>
            <div style={s.inputWrap}>
              <svg style={s.fieldIcon} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <input
                id="signup-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                style={s.input}
              />
            </div>
          </div>

          {/* Password */}
          <div style={s.field}>
            <label style={s.label} htmlFor="signup-password">Password <span style={s.hint}>(min. 6 characters)</span></label>
            <div style={s.inputWrap}>
              <svg style={s.fieldIcon} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                style={s.input}
              />
              <button type="button" onClick={() => setShowPassword(v => !v)} style={s.eyeBtn} tabIndex={-1} aria-label="Toggle password">
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div style={s.field}>
            <label style={s.label} htmlFor="signup-confirm">Confirm Password</label>
            <div style={s.inputWrap}>
              <svg style={s.fieldIcon} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <input
                id="signup-confirm"
                type={showConfirm ? 'text' : 'password'}
                required
                autoComplete="new-password"
                placeholder="••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                style={{
                  ...s.input,
                  borderColor: confirmPassword && confirmPassword !== password
                    ? '#ef4444'
                    : undefined,
                }}
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)} style={s.eyeBtn} tabIndex={-1} aria-label="Toggle confirm password">
                {showConfirm ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {confirmPassword && confirmPassword !== password && (
              <p style={s.matchError}>Passwords do not match</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{ ...s.submitBtn, opacity: isSubmitting ? 0.72 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
          >
            {isSubmitting ? (
              <span style={s.btnInner}>
                <span style={s.spinner} />
                Creating Account...
              </span>
            ) : (
              <span style={s.btnInner}>
                Create Account
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 8 }}>
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
              </span>
            )}
          </button>
        </form>

        {/* Footer */}
        <div style={s.footer}>
          <span style={s.footerText}>Already have an account?</span>
          <Link to="/admin/login" style={s.footerLink}>Sign in</Link>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes adminSpin { to { transform: rotate(360deg); } }
        #signup-name::placeholder, #signup-email::placeholder, #signup-password::placeholder, #signup-confirm::placeholder {
          color: #94a3b8;
        }
        #signup-name:focus, #signup-email:focus, #signup-password:focus, #signup-confirm:focus {
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
    padding: '32px 24px',
    boxSizing: 'border-box',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    position: 'relative',
  },
  glowTop: {
    position: 'fixed',
    top: '-100px',
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
    maxWidth: '440px',
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    border: '1px solid #e2e8f0',
    boxShadow:
      '0 20px 40px -15px rgba(15,23,42,0.07), ' +
      '0 0 0 1px rgba(212,175,55,0.12), ' +
      '0 8px 16px -4px rgba(15,23,42,0.03)',
    padding: '36px 36px 28px',
    boxSizing: 'border-box',
  },
  brand: {
    textAlign: 'center',
    marginBottom: '20px',
  },
  logoBadge: {
    width: '60px',
    height: '60px',
    margin: '0 auto 12px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    border: '1px solid #fde68a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 20px rgba(212,175,55,0.15)',
  },
  logoImg: {
    width: '40px',
    height: '40px',
    objectFit: 'contain',
  },
  brandTitle: {
    margin: '0 0 3px',
    fontSize: '20px',
    fontWeight: '700',
    letterSpacing: '0.18em',
    color: '#0f172a',
  },
  brandSub: {
    margin: '0 0 18px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#b89620',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  divider: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, #e2e8f0, transparent)',
  },
  infoBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    backgroundColor: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: '10px',
    padding: '10px 13px',
    marginTop: '18px',
    marginBottom: '4px',
  },
  infoText: {
    color: '#0369a1',
    fontSize: '12px',
    lineHeight: '1.5',
    fontWeight: '500',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    padding: '10px 13px',
    marginTop: '12px',
  },
  errorText: {
    color: '#991b1b',
    fontSize: '13px',
    lineHeight: '1.5',
    fontWeight: '500',
  },
  successBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '10px',
    padding: '10px 13px',
    marginTop: '12px',
  },
  successText: {
    color: '#166534',
    fontSize: '13px',
    lineHeight: '1.5',
    fontWeight: '500',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginTop: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#334155',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  hint: {
    fontWeight: '400',
    color: '#64748b',
    textTransform: 'none',
    letterSpacing: '0',
    fontSize: '11px',
  },
  inputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  fieldIcon: {
    position: 'absolute',
    left: '13px',
    width: '15px',
    height: '15px',
    color: '#64748b',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '11px 40px 11px 38px',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    color: '#0f172a',
    fontSize: '14px',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  matchError: {
    margin: '3px 0 0',
    fontSize: '12px',
    color: '#dc2626',
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
  },
  submitBtn: {
    marginTop: '4px',
    padding: '13px 20px',
    background: 'linear-gradient(135deg, #d4af37 0%, #b89620 100%)',
    border: 'none',
    borderRadius: '11px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    letterSpacing: '0.03em',
    boxShadow: '0 4px 14px rgba(212,175,55,0.35)',
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
    marginTop: '22px',
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
};

