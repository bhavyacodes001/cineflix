import React, { useEffect, useState } from 'react';
import '../styles/animations.css';

interface AnimationWrapperProps {
  children: React.ReactNode;
  animationType?: 'fadeInScale' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight';
  delay?: number;
  className?: string;
}

const AnimationWrapper: React.FC<AnimationWrapperProps> = ({ 
  children, 
  animationType = 'fadeInScale', 
  delay = 0,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const animationClass = `animate-${animationType}`;
  const combinedClassName = `${animationClass} ${className}`.trim();

  return (
    <div className={isVisible ? combinedClassName : ''}>
      {children}
    </div>
  );
};

export default AnimationWrapper;
