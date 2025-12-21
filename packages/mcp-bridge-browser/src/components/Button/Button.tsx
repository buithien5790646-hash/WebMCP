import './Button.css';

interface ButtonProps {
    onClick?: () => void;
    disabled?: boolean;
    variant?: 'primary' | 'secondary';
    children: any;
    className?: string;
    style?: Record<string, string>;
}

export function Button({ onClick, disabled, variant = 'primary', children, className = '', style }: ButtonProps) {
    return (
        <button
            className={`btn btn-${variant} ${className}`}
            onClick={onClick}
            disabled={disabled}
            style={style}
        >
            {children}
        </button>
    );
}
