import React, { useEffect, useState } from 'react';
import api from '../services/api';
import AccessBlockedView from '../views/AccessBlockedView';
import { useAuth } from '../context/AuthContext';

export const AccessGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  const checkAccess = async () => {
    try {
      // setLoading(true); // Don't show spinner on background checks
      const res = await api.get('/work-schedules/access-status');
      setStatus(res.data);
    } catch (error: any) {
      console.error('Error checking access:', error);
      // If offline/network error, we might want to check local cache or fail open/closed.
      // For now, if 400/401/403/500, we probably should handle it.
      // If it's a "User not linked" error (400), we might want to allow access to "Contact Support" page?
      // If simply error, we keep previous status if exists.
      if (!status) {
         // If initial check fails, maybe assume allowed to avoid blocking if server is down?
         // Or block. Let's block to be safe.
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
        checkAccess();
        
        // Check when window becomes visible
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkAccess();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Check every minute
        const interval = setInterval(checkAccess, 60000);
        
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    } else {
        setLoading(false);
    }
  }, [isAuthenticated]);

  if (loading && !status) {
      return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      );
  }

  if (status && status.allowed === false) {
    return <AccessBlockedView 
        reason={status.reason} 
        limit={status.limit} 
        start={status.nextStart || (status.schedule?.start)}
        end={status.end || (status.schedule?.end)}
        onRetry={checkAccess} 
    />;
  }

  return <>{children}</>;
};
