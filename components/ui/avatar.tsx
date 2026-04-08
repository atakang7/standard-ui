type AvatarProps = {
  name: string;
  size?: "sm" | "md" | "lg";
  status?: "online" | "away" | "busy";
};

const statusLabels: Record<NonNullable<AvatarProps["status"]>, string> = {
  online: "Online",
  away: "Away",
  busy: "Busy",
};

export function Avatar({ name, size = "md", status }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`avatar avatar--${size}`} aria-label={name}>
      <span>{initials}</span>
      {status ? (
        <span className={`presence presence--${status}`} aria-label={statusLabels[status]} />
      ) : null}
    </div>
  );
}
