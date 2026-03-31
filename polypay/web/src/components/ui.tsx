export function Spinner({ message }: { message: string }) {
  return (
    <div className="bg-surface-container rounded-2xl p-6 flex items-center gap-4 mt-6">
      <div className="w-5 h-5 border-2 border-outline-variant border-t-primary rounded-full animate-spin shrink-0" />
      <span className="text-on-surface-variant font-body text-sm">{message}</span>
    </div>
  );
}

export function StatusMessage({ message }: { message: string }) {
  const isError = message.includes("ailed");
  return (
    <div
      className={`rounded-2xl p-4 text-sm font-body mt-4 ${
        isError
          ? "bg-error-container/10 border border-error/20 text-on-error-container"
          : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
      }`}
    >
      <pre className="whitespace-pre-wrap m-0">{message}</pre>
    </div>
  );
}

export function Icon({
  name,
  filled,
  className,
}: {
  name: string;
  filled?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className ?? ""}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}

export function CopyButton({ text }: { text: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text)}
      className="text-outline hover:text-primary transition-colors shrink-0"
    >
      <Icon name="content_copy" className="text-sm" />
    </button>
  );
}
