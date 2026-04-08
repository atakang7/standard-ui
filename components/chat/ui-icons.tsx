type IconProps = {
  className?: string;
};

const commonProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function MenuIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...commonProps}>
      <path d="M4 8h16" />
      <path d="M4 16h16" />
    </svg>
  );
}

export function SidebarToggleIcon({
  className = "",
  collapsed = false,
}: IconProps & { collapsed?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...commonProps}>
      {collapsed ? (
        <path d="M9 7.5L14 12l-5 4.5" />
      ) : (
        <path d="M15 7.5L10 12l5 4.5" />
      )}
    </svg>
  );
}

export function CloseIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...commonProps}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

export function PlusIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...commonProps}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function TrashIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...commonProps}>
      <path d="M4.5 7h15" />
      <path d="M9 4.5h6" />
      <path d="M18 7l-1 11.5a2 2 0 0 1-2 1.8H9a2 2 0 0 1-2-1.8L6 7" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

export function SendIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...commonProps}>
      <path d="M12 19V5" />
      <path d="M6.5 10.5L12 5l5.5 5.5" />
    </svg>
  );
}

export function SlidersIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...commonProps}>
      <path d="M4 7h7" />
      <path d="M15 7h5" />
      <circle cx="13" cy="7" r="2" />
      <path d="M4 17h3" />
      <path d="M11 17h9" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  );
}

export function StopIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...commonProps}>
      <rect x="7" y="7" width="10" height="10" rx="2" />
    </svg>
  );
}

export function RefreshIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...commonProps}>
      <path d="M20 11a8 8 0 1 0-2.4 5.7" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

export function CopyIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...commonProps}>
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

export function CheckIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...commonProps}>
      <path d="M5 12.5l4.2 4L19 7.5" />
    </svg>
  );
}

export function EditIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...commonProps}>
      <path d="M4 20h4.4l10-10a2 2 0 0 0 0-2.8l-1.6-1.6a2 2 0 0 0-2.8 0L4 15.6V20z" />
      <path d="M12.5 7.5l4 4" />
    </svg>
  );
}

export function TerminalIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...commonProps}>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="M7.5 10.5l2 2-2 2" />
      <path d="M12 14.5h4.5" />
    </svg>
  );
}

export function ChevronDownIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...commonProps}>
      <path d="M6.5 9.5l5.5 5 5.5-5" />
    </svg>
  );
}

export function PaperclipIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...commonProps}>
      <path d="M8.5 12.5l5.4-5.4a3.8 3.8 0 1 1 5.4 5.4l-7.1 7.1a5.2 5.2 0 1 1-7.4-7.4l7.1-7.1" />
    </svg>
  );
}

export function FileIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...commonProps}>
      <path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1.5-1.5z" />
      <path d="M14 3.5V8h4" />
    </svg>
  );
}

export function SettingsIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...commonProps}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 13.2a7.9 7.9 0 0 0 .1-2.4l2-1.4-1.8-3.2-2.4.7a8.2 8.2 0 0 0-2-1.2L14.9 3h-3.8l-.4 2.7a8.2 8.2 0 0 0-2 1.2l-2.4-.7-1.8 3.2 2 1.4a7.9 7.9 0 0 0 .1 2.4l-2 1.4 1.8 3.2 2.4-.7a8.2 8.2 0 0 0 2 1.2l.4 2.7h3.8l.4-2.7a8.2 8.2 0 0 0 2-1.2l2.4.7 1.8-3.2-2-1.4z" />
    </svg>
  );
}
