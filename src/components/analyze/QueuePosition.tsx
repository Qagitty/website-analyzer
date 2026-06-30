interface QueuePositionProps {
  position: number;
}

export function QueuePosition({ position }: QueuePositionProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="bg-orange-50 dark:bg-orange-950/30 text-orange-400 border border-orange-200 dark:border-orange-900/40 text-xs font-medium px-2.5 py-0.5 rounded-full">
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
