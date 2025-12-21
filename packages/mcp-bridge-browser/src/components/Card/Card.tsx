import type { ComponentChildren } from "preact";
import "./Card.css";

interface CardProps {
  children: ComponentChildren;
  className?: string;
  style?: Record<string, string>;
}

export function Card({ children, className = "", style }: CardProps) {
  return (
    <div className={`card ${className}`} style={style}>
      {children}
    </div>
  );
}
