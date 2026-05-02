import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
  loading?: boolean;
  size?: "sm" | "md";
}

export function Button({
  children,
  variant = "primary",
  loading = false,
  size = "md",
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const base = [
    "relative inline-flex items-center justify-center gap-2 rounded-lg font-medium",
    "transition-all duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
    "active:scale-[0.97]",
    "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
  ].join(" ");

  const sizes = {
    sm: "h-7 px-3 text-xs",
    md: "h-8 px-4 text-sm",
  };

  const variants = {
    primary: [
      "bg-indigo-600 text-white",
      "hover:bg-indigo-500",
      "shadow-md shadow-indigo-500/25",
      "ring-1 ring-inset ring-white/10",
    ].join(" "),
    ghost: [
      "bg-zinc-800 text-zinc-200",
      "hover:bg-zinc-700 hover:text-white",
      "ring-1 ring-inset ring-zinc-700",
    ].join(" "),
    danger: [
      "bg-red-600/20 text-red-400",
      "hover:bg-red-600/30 hover:text-red-300",
      "ring-1 ring-inset ring-red-500/30",
    ].join(" "),
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled ?? loading}
      {...props}
    >
      {loading ? (
        <>
          <span className="h-3.5 w-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin" />
          <span>Analyzing…</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
