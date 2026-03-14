import { cn } from "@/lib/utils";
import { getTrustScoreDisplay } from "@/types/sponsor";

interface TrustScoreBadgeProps {
  score: number | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const SIZE_CONFIG = {
  sm: { radius: 24, strokeWidth: 4, textSize: "text-xs", containerSize: "w-14 h-14" },
  md: { radius: 36, strokeWidth: 5, textSize: "text-sm", containerSize: "w-20 h-20" },
  lg: { radius: 52, strokeWidth: 6, textSize: "text-base", containerSize: "w-28 h-28" },
};

const COLOR_MAP = {
  green: { stroke: "#22c55e", bg: "#f0fdf4", text: "#16a34a" },
  blue: { stroke: "#3b82f6", bg: "#eff6ff", text: "#1d4ed8" },
  amber: { stroke: "#f59e0b", bg: "#fffbeb", text: "#d97706" },
  red: { stroke: "#ef4444", bg: "#fef2f2", text: "#dc2626" },
  gray: { stroke: "#9ca3af", bg: "#f9fafb", text: "#6b7280" },
};

export function TrustScoreBadge({
  score,
  size = "md",
  showLabel = false,
}: TrustScoreBadgeProps) {
  const display = getTrustScoreDisplay(score);
  const config = SIZE_CONFIG[size];
  const colors = COLOR_MAP[display.color];

  const svgSize = (config.radius + config.strokeWidth) * 2;
  const circumference = 2 * Math.PI * config.radius;
  const progress = score !== null ? (score / 100) * circumference : 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full",
          config.containerSize
        )}
        style={{ backgroundColor: colors.bg }}
      >
        {/* SVG Circle */}
        <svg
          className="absolute inset-0"
          width="100%"
          height="100%"
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          style={{ transform: "rotate(-90deg)" }}
        >
          {/* Background circle */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={config.radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={config.strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={config.radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={config.strokeWidth}
            strokeDasharray={`${progress} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>

        {/* Score text */}
        <div className="relative flex flex-col items-center">
          <span
            className={cn("font-bold leading-none", config.textSize)}
            style={{ color: colors.text }}
          >
            {score !== null ? score : "?"}
          </span>
          <span className="text-[9px] text-gray-400 leading-none mt-0.5">
            /100
          </span>
        </div>
      </div>

      {showLabel && (
        <span
          className="text-xs font-medium text-center"
          style={{ color: colors.text }}
        >
          {display.label}
        </span>
      )}
    </div>
  );
}
