import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Connecting to Linear...');
  const exchangeStarted = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode double-mount
    if (exchangeStarted.current) return;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const savedState = sessionStorage.getItem('linear_oauth_state');

    if (!code) {
      setError('No authorization code received from Linear.');
      return;
    }

    if (state !== savedState) {
      setError('Invalid state parameter. Please try connecting again.');
      return;
    }

    exchangeStarted.current = true;
    sessionStorage.removeItem('linear_oauth_state');
    exchangeToken(code);
  }, [searchParams]);

  const exchangeToken = async (code: string) => {
    try {
      setStatus('Exchanging authorization code...');

      // Refresh session to ensure we have a valid (non-expired) JWT
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        setError('Session expired. Please sign in again.');
        return;
      }

      // Use supabase.functions.invoke — handles auth token automatically
      // Pass redirect_uri so the edge function uses the same one that initiated the flow
      const { data, error: fnError } = await supabase.functions.invoke('linear-oauth-callback', {
        body: {
          code,
          state: searchParams.get('state'),
          redirect_uri: import.meta.env.VITE_LINEAR_REDIRECT_URI,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Edge function error');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setStatus('Connected! Redirecting...');
      setTimeout(() => navigate('/app', { replace: true }), 500);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 bg-bg-primary flex items-center justify-center">
      <div className="bg-bg-card border border-border-secondary rounded-2xl p-10 max-w-[440px] w-full text-center">
        {error ? (
          <>
            <h2 className="text-xl font-bold text-white mb-3">Connection Failed</h2>
            <p className="text-sm text-urgent mb-6">{error}</p>
            <button
              onClick={() => navigate('/app', { replace: true })}
              className="px-6 py-2.5 bg-bg-hover border border-border-secondary rounded-lg text-text-primary text-sm font-medium cursor-pointer hover:bg-border-secondary transition-colors"
            >
              Back to App
            </button>
          </>
        ) : (
          <>
            <div className="w-10 h-10 mx-auto mb-4 border-3 border-border-primary border-t-accent rounded-full animate-spin" />
            <p className="text-sm text-text-secondary">{status}</p>
          </>
        )}
      </div>
    </div>
  );
}
