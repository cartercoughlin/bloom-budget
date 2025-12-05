import { useState, useCallback, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { useAuth } from '../contexts/AuthContext';

interface AccountLinkButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function AccountLinkButton({ onSuccess, onError }: AccountLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const handleOnSuccess = useCallback(
    async (publicToken: string) => {
      try {
        // Exchange public token for access token
        const response = await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ publicToken }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to link account');
        }

        onSuccess?.();
      } catch (err: any) {
        onError?.(err.message);
      }
    },
    [onSuccess, onError]
  );

  const handleOnExit = useCallback(
    (error: any) => {
      if (error) {
        onError?.(error.message || 'Account linking was cancelled');
      }
    },
    [onError]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleOnSuccess,
    onExit: handleOnExit,
  });

  // Open Plaid Link when token is ready
  useEffect(() => {
    if (linkToken && ready) {
      open();
      setIsLoading(false);
    }
  }, [linkToken, ready, open]);

  const handleClick = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Get link token from backend
      const response = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create link token';
        try {
          const error = await response.json();
          errorMessage = error.message || error.error || errorMessage;
        } catch {
          // If JSON parsing fails, use default message
        }
        throw new Error(errorMessage);
      }

      const text = await response.text();
      if (!text) {
        throw new Error('Empty response from server');
      }

      const data = JSON.parse(text);
      if (!data.linkToken) {
        throw new Error('No link token in response');
      }

      setLinkToken(data.linkToken);
    } catch (err: any) {
      console.error('Link button error:', err);
      onError?.(err.message);
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading || !user}
      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? 'Loading...' : '+ Link Account'}
    </button>
  );
}
