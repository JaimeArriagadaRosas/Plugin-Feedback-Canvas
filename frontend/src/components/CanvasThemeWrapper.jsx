// frontend/src/components/CanvasThemeWrapper.jsx - Canvas theme integration
import React from 'react';
import './canvas-theme.css';

const CanvasThemeWrapper = ({ children }) => {
  // Apply Canvas theme colors dynamically based on LTI launch
  // Canvas sends theme colors in the launch params
  useEffect(() => {
    const applyTheme = () => {
      // Get theme from URL params or localStorage
      const params = new URLSearchParams(window.location.search);
      const brandPrimary = params.get('brand_primary') || '#0374B5';
      const brandSecondary = params.get('brand_secondary') || '#2790D7';
      
      document.documentElement.style.setProperty('--canvas-primary', brandPrimary);
      document.documentElement.style.setProperty('--canvas-secondary', brandSecondary);
    };

    applyTheme();
  }, []);

  return (
    <div className="canvas-plugin-wrapper">
      {children}
    </div>
  );
};

export default CanvasThemeWrapper;
