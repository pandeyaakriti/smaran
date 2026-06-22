import { useState } from "react";
import { signInWithGoogle } from "../utils/supabase";

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSignIn() {
    setError(null);
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError("Couldn't sign in. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-stone-50 px-6 overflow-hidden">
      {/* ambient glow — kept subtle, single accent */}
      <div
        className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#4C3B6B]/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative w-full max-w-sm login-card-enter">
        <div className="rounded-2xl border border-stone-200/80 bg-white/90 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.04),0_12px_32px_-8px_rgba(76,59,107,0.12)] px-8 py-10 text-center">
          <img
            src="/logo.png"
            alt="Smaran"
            className="mx-auto mb-5 h-14 w-14 rounded-xl object-contain"
          />

          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            smaran
          </h1>
          <p className="text-sm text-stone-500 mb-8 leading-relaxed">
            Remember every face, every word.
            <br />
            Sign in to pick up where you left off.
          </p>

          <button
            onClick={handleSignIn}
            disabled={isLoading}
            className="group w-full flex items-center justify-center gap-3 bg-white border border-stone-200 text-stone-700 text-sm font-medium px-4 py-3 rounded-xl shadow-sm hover:bg-stone-50 hover:border-stone-300 hover:shadow-md active:scale-[0.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4C3B6B]/40 focus-visible:ring-offset-2"
          >
            {isLoading ? (
              <span
                className="h-[18px] w-[18px] rounded-full border-2 border-stone-300 border-t-stone-600 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.85 2.09-1.81 2.73v2.27h2.92c1.7-1.57 2.69-3.88 2.69-6.64z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.34C2.44 15.98 5.48 18 9 18z"/>
                <path fill="#FBBC05" d="M3.97 10.7c-.18-.54-.28-1.11-.28-1.7s.1-1.16.28-1.7V4.96H.96C.35 6.18 0 7.55 0 9s.35 2.82.96 4.04l3.01-2.34z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z"/>
              </svg>
            )}
            <span>{isLoading ? "Signing in…" : "Continue with Google"}</span>
          </button>

          {error && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-stone-400">
          By continuing, you agree to smaran's Terms &amp; Privacy Policy.
        </p>
      </div>

      <style>{`
        .login-card-enter {
          animation: fadeUp 0.5s ease-out;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .login-card-enter { animation: none; }
        }
      `}</style>
    </div>
  );
}