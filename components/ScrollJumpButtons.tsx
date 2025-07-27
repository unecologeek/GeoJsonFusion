import React, { useEffect, useState, useCallback } from 'react';

// SVG Icon Components
const ArrowUpIconSVG: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14l-6-6z" />
  </svg>
);

const ArrowDownIconSVG: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 16l-6-6 1.41-1.41L12 13.17l4.59-4.58L18 10l-6 6z" />
  </svg>
);

interface ScrollJumpButtonsProps {
  targetElementRef: React.RefObject<HTMLElement>; // Ref to the BOX element
  thresholdHeightPx?: number; // Min offsetHeight of the box to show buttons
  containerClass?: string; // Tailwind classes for the button container div
  buttonClass?: string; // Tailwind classes for individual buttons
}

const ScrollJumpButtons: React.FC<ScrollJumpButtonsProps> = ({ 
  targetElementRef, 
  thresholdHeightPx = 400,
  containerClass = "absolute top-3 right-3 z-20 flex flex-col space-y-2",
  buttonClass = "p-2 bg-sky-700 hover:bg-sky-600 text-white rounded-full shadow-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75"
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const checkVisibility = useCallback(() => {
    if (targetElementRef.current) {
      setIsVisible(targetElementRef.current.offsetHeight > thresholdHeightPx);
    } else {
      setIsVisible(false);
    }
  }, [targetElementRef, thresholdHeightPx]);

  useEffect(() => {
    // Initial check after a slight delay for layout to settle
    const timeoutId = setTimeout(checkVisibility, 150);

    window.addEventListener('resize', checkVisibility);
    const observer = new MutationObserver(checkVisibility);
    if (targetElementRef.current) {
        observer.observe(targetElementRef.current, { childList: true, subtree: true, attributes: true, characterData: true });
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', checkVisibility);
      observer.disconnect();
    };
  }, [checkVisibility]);

  const scrollToTop = useCallback(() => {
    if (targetElementRef.current) {
      const elementRect = targetElementRef.current.getBoundingClientRect();
      // Calculate offset from document top, considering current scroll position
      const absoluteElementTop = elementRect.top + window.pageYOffset;
      window.scrollTo({ top: absoluteElementTop - 10, behavior: 'smooth' }); // -10 for a small margin from viewport top
    }
  }, [targetElementRef]);

  const scrollToBottom = useCallback(() => {
    if (targetElementRef.current) {
        // Scroll so the bottom of the element is visible near the bottom of the viewport.
        // scrollIntoView({block: 'end'}) is often good enough.
        targetElementRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [targetElementRef]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className={containerClass}>
      <button
        onClick={scrollToTop}
        className={buttonClass}
        aria-label="Scroll to top of this section"
        title="Scroll to top of this section"
      >
        <ArrowUpIconSVG />
      </button>
      <button
        onClick={scrollToBottom}
        className={buttonClass}
        aria-label="Scroll to bottom of this section"
        title="Scroll to bottom of this section"
      >
        <ArrowDownIconSVG />
      </button>
    </div>
  );
};

export default ScrollJumpButtons;
