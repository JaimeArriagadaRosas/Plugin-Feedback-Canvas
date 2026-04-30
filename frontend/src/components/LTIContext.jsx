// frontend/src/components/LTIContext.jsx - LTI state management
import React, { createContext, useContext, useState, useEffect } from 'react';

const LTIContext = createContext(null);

export const useLTI = () => useContext(LTIContext);

export const LTIProvider = ({ children, token, user, courseId, assignmentId, contextTitle, resourceTitle }) => {
  const [userInfo, setUserInfo] = useState(user || null);
  const [loading, setLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState(!!token);

  useEffect(() => {
    // Verify token with backend
    const verifyToken = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/verify', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setUserInfo(data.user);
          setTokenValid(true);
        } else {
          setTokenValid(false);
        }
      } catch (err) {
        console.error('Token verification failed:', err);
        setTokenValid(false);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const value = {
    user: userInfo,
    token,
    loading,
    tokenValid,
    context: {
      courseId,
      assignmentId,
      courseTitle: contextTitle,
      assignmentTitle: resourceTitle
    }
  };

  return (
    <LTIContext.Provider value={value}>
      {children}
    </LTIContext.Provider>
  );
};

// Simple export for non-React usage
export default LTIContext;
