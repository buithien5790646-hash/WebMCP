import "./StatusDot.css";

interface StatusDotProps {
  online: boolean;
}

export function StatusDot({ online }: StatusDotProps) {
  return <div className={`status-dot ${online ? "online" : ""}`} />;
}
