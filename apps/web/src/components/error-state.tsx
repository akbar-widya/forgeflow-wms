import { AlertTriangle } from "lucide-react";

export function ErrorState({
  title = "Failed to load data",
  message = "The request could not be completed. Check your connection and try again."
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <AlertTriangle className="size-6 text-danger" />
      <div className="text-sm font-medium">{title}</div>
      <div className="max-w-md text-xs text-muted-foreground">{message}</div>
    </div>
  );
}