import type { ReactNode } from 'react';
import { useScrollReveal } from '../hooks/useScrollReveal';

interface Props {
  children: ReactNode;
  delay?: number;
}

export default function ScrollSection({ children, delay = 0 }: Props) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className="transition-all duration-700 ease-out"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
