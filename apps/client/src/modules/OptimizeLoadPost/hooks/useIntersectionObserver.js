import { useState, useEffect } from 'react';

export function useIntersectionObserver(elementRef, options = {}) {
  const { threshold = 0, root = null, rootMargin = '0px', triggerOnce = false } = options;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        if (triggerOnce) {
          observer.unobserve(element);
        }
      } else if (!triggerOnce) {
        setIsVisible(false);
      }
    }, { threshold, root, rootMargin });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [elementRef, threshold, root, rootMargin, triggerOnce]);

  return isVisible;
}
