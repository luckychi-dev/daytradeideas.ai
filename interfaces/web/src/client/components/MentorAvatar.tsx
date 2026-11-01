interface MentorAvatarProps {
  size?: "header" | "message" | "large";
}

export function MentorAvatar({ size = "header" }: MentorAvatarProps) {
  return (
    <span className={`mentor-avatar mentor-avatar-${size}`} role="img" aria-label="Jason Sen AI avatar">
      <img src="/avatar.jpg" alt="" draggable="false" />
    </span>
  );
}
