import React from "react";
import { Loader2 } from "lucide-react";

interface AsyncButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "success" | "danger" | "outline";
  className?: string;
  lang?: "en" | "bn";
}

/**
 * AsyncButton Component - Ultra Smooth, Hardware-Accelerated Interactive Button
 * Implements native loading state with dynamic spinners and text substitution.
 * Completely compliant with the premium, responsive e-commerce design at RIEMARTBD.COM.
 */
export const AsyncButton: React.FC<AsyncButtonProps> = ({
  isLoading,
  loadingText,
  icon,
  children,
  variant = "primary",
  className = "",
  lang = "en",
  disabled,
  ...props
}) => {
  // Safe default translation fallbacks
  const defaultLoadingText = lang === "en" ? "Processing..." : "প্রসেসিং হচ্ছে...";

  // Define premium Tailwind classes based on variant pairings
  const variantStyles = {
    primary: "bg-stone-900 hover:bg-stone-850 text-white border-transparent shadow-sm active:scale-98 focus:ring-stone-600",
    secondary: "bg-amber-600 hover:bg-amber-700 text-white border-transparent shadow-sm active:scale-98 focus:ring-amber-500",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent shadow-sm active:scale-98 focus:ring-emerald-500",
    danger: "bg-red-650 hover:bg-red-750 text-white border-transparent shadow-sm active:scale-98 focus:ring-red-500",
    outline: "bg-white border-stone-250 text-stone-700 hover:bg-stone-50 active:scale-98 focus:ring-stone-400"
  };

  const baseStyles =
    "inline-flex items-center justify-center font-mono text-xs font-bold uppercase tracking-wider rounded-sm transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-offset-1 select-none disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer gap-2";

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      style={{ minHeight: "38px" }} // Keeps size consistent when switching to loading state
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
          <span className="animate-pulse">{loadingText || defaultLoadingText}</span>
        </>
      ) : (
        <>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <span>{children}</span>
        </>
      )}
    </button>
  );
};

export default AsyncButton;
