interface QueuePositionProps {
  position: number;
}

export function QueuePosition({ position }: QueuePositionProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
        {position}
      </span>
      <span>
        {position === 1
          ? 'You are next in queue'
          : `Position #${position} in queue`}
      </span>
    </div>
  );
}
