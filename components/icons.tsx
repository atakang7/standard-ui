type IconProps = {
  className?: string;
};

export function SearchIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export function PlusIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function FilterIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </svg>
  );
}

export function BoltIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}

export function SettingsIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3.8a7 7 0 0 0-1.7-1l-.2-2.4h-4l-.2 2.4a7 7 0 0 0-1.7 1l-2.3-.8-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-.8a7 7 0 0 0 1.7 1l.2 2.4h4l.2-2.4a7 7 0 0 0 1.7-1l2.3.8 2-3.4-2-1.5c.1-.3.1-.7.1-1z" />
    </svg>
  );
}

export function PhoneIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 4l3-1 2 4-2 2c1 2 3 4 5 5l2-2 4 2-1 3c-1 1-3 2-5 1-4-1-8-5-9-9-1-2 0-4 1-5z" />
    </svg>
  );
}

export function VideoIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="6" width="12" height="12" rx="2" />
      <path d="M15 10l6-4v12l-6-4" />
    </svg>
  );
}

export function InfoIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <path d="M12 7h.01" />
    </svg>
  );
}

export function SendIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 12l16-8-6 16-2-6-8-2z" />
    </svg>
  );
}

export function AttachmentIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M8 12l6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l8-8" />
    </svg>
  );
}

export function EmojiIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14c1.2 1.2 2.6 1.8 4 1.8s2.8-.6 4-1.8" />
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
    </svg>
  );
}

export function MicIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="9" y="4" width="6" height="10" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

export function SparklesIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 12l2-4 2 4 4 2-4 2-2 4-2-4-4-2 4-2z" />
      <path d="M16 5l1.5-3 1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5L16 5z" />
    </svg>
  );
}

export function CheckIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function MoreIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="6" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="18" cy="12" r="1.8" />
    </svg>
  );
}

export function PinIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M9 4h6l1 6-2 2v4l-2 4-2-4v-4l-2-2 1-6z" />
    </svg>
  );
}

export function StarIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M12 3l2.6 5.3 5.8.8-4.2 4 1 5.7-5.2-2.8-5.2 2.8 1-5.7-4.2-4 5.8-.8L12 3z" />
    </svg>
  );
}

export function ChatBubbleIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M6 7.5h12a2 2 0 0 1 2 2V16a2 2 0 0 1-2 2H9l-5 3v-3.5a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export function FolderIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 8h6l2 2h10v8.5A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5V8z" />
      <path d="M3 10h18" />
    </svg>
  );
}

export function ArtifactIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="2.2" />
      <path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.3 6.3l2.2 2.2M15.5 15.5l2.2 2.2M17.7 6.3l-2.2 2.2M8.5 15.5l-2.2 2.2" />
    </svg>
  );
}

export function BracesIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M9 5c-2 0-3 1.2-3 3.2v2.1c0 1.1-.5 1.8-1.5 2.2 1 .4 1.5 1.1 1.5 2.2v2.1C6 18.8 7 20 9 20" />
      <path d="M15 5c2 0 3 1.2 3 3.2v2.1c0 1.1.5 1.8 1.5 2.2-1 .4-1.5 1.1-1.5 2.2v2.1c0 2-1 3.2-3 3.2" />
    </svg>
  );
}

export function PencilIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 16.5V20h3.5L19 8.5 15.5 5 4 16.5z" />
      <path d="M13.8 6.2l3.5 3.5" />
    </svg>
  );
}

export function LearnIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 9l9-4 9 4-9 4-9-4z" />
      <path d="M6 11.4V15c0 2.2 2.7 4 6 4s6-1.8 6-4v-3.6" />
      <path d="M21 9v4" />
    </svg>
  );
}

export function CupIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 6h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V6z" />
      <path d="M16 8h2.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M7 19h8" />
    </svg>
  );
}

export function BulbIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M8.5 14.5c-.8-.9-1.5-2.2-1.5-3.7A5 5 0 0 1 12 6a5 5 0 0 1 5 4.8c0 1.5-.7 2.8-1.5 3.7-.8.9-1.5 1.8-1.5 2.7h-4c0-.9-.7-1.8-1.5-2.7z" />
      <path d="M9.8 19h4.4" />
    </svg>
  );
}

export function WaveformIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 12h1.5" />
      <path d="M6.5 9v6" />
      <path d="M10 7v10" />
      <path d="M13.5 9v6" />
      <path d="M17 6v12" />
      <path d="M20.5 10v4" />
    </svg>
  );
}

export function BurstIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 2v5M12 17v5M2 12h5M17 12h5M5.2 5.2l3.5 3.5M15.3 15.3l3.5 3.5M18.8 5.2l-3.5 3.5M8.7 15.3l-3.5 3.5" />
    </svg>
  );
}

export function GhostIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 19v-8a6 6 0 0 1 12 0v8l-2-1.4L14 19l-2-1.4L10 19l-2-1.4L6 19z" />
      <path d="M9.2 11.6h.01M14.8 11.6h.01" />
      <path d="M9 15c.8.7 1.8 1 3 1s2.2-.3 3-1" />
    </svg>
  );
}
