import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  className = ''
}: ButtonProps) => {
  const baseStyles = 'font-medium rounded-lg transition-all duration-200 inline-flex items-center justify-center';

  const variants = {
    primary: 'bg-purple-primary hover:bg-purple-secondary text-white shadow-md hover:shadow-lg',
    secondary: 'bg-purple-secondary hover:bg-purple-primary text-white shadow-md hover:shadow-lg',
    outline: 'border-2 border-purple-primary text-purple-primary hover:bg-purple-primary hover:text-white'
  };

  const sizeBase = {
    sm: 'px-4 text-sm',
    md: 'px-6 text-base',
    lg: 'px-8 text-base'
  };

  // Adjust padding for outline variant to compensate for border
  const sizePadding = {
    sm: variant === 'outline' ? 'py-[6px]' : 'py-2',
    md: variant === 'outline' ? 'py-[10px]' : 'py-3',
    lg: variant === 'outline' ? 'py-[12px]' : 'py-3.5'
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant]} ${sizeBase[size]} ${sizePadding[size]} ${className}`}
    >
      {children}
    </motion.button>
  );
};
