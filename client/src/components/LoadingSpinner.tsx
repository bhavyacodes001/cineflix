import React from 'react';
import '../styles/animations.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  color = '#e50914',
  text = 'Loading...'
}) => {
  const sizeStyles = {
    small: { width: '24px', height: '24px', borderWidth: '2px' },
    medium: { width: '40px', height: '40px', borderWidth: '4px' },
    large: { width: '64px', height: '64px', borderWidth: '6px' }
  };

  const currentSize = sizeStyles[size];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px'
    }}>
      <div 
        className="loading-spinner"
        style={{
          width: currentSize.width,
          height: currentSize.height,
          borderWidth: currentSize.borderWidth,
          borderColor: `${color}20`,
          borderTopColor: color
        }}
      />
      {text && (
        <div 
          style={{ 
            marginTop: '16px',
            color: color === '#e50914' ? '#666' : color,
            fontSize: '16px',
            fontWeight: '500'
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
};

export default LoadingSpinner;
