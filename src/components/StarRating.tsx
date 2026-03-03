import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  onRate?: (star: number) => void;
  size?: number;
}

export function StarRating({ rating, onRate, size = 20 }: StarRatingProps) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "transition-colors",
            star <= rating ? "fill-primary text-primary" : "text-muted-foreground/30",
            onRate && "cursor-pointer hover:text-primary"
          )}
          size={size}
          onClick={() => onRate?.(star)}
        />
      ))}
    </div>
  );
}
