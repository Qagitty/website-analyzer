interface QueuePositionProps {
  position: number;
}

export function QueuePosition({ position }: QueuePositionProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-medium px-2.5 py-0.5 rounded-full">
        #{position}
      </span>
      <span>
        {position === 1
          ? 'You are next in queue'
          : `Position #${position} in queue`}
      </span>
    </div>
  );
}
