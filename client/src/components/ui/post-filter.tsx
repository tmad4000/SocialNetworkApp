import { Button } from "@/components/ui/button";
import { ListFilter, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";

interface PostFilterProps {
  showStatusOnly: boolean;
  onFilterChange: (showStatusOnly: boolean) => void;
}

export default function PostFilter({ showStatusOnly, onFilterChange }: PostFilterProps) {
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "gap-2",
          !showStatusOnly && "bg-accent text-accent-foreground"
        )}
        onClick={() => onFilterChange(false)}
      >
        <LayoutList className="h-4 w-4" />
        <span>All Posts</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "gap-2",
          showStatusOnly && "bg-accent text-accent-foreground"
        )}
        onClick={() => onFilterChange(true)}
      >
        <ListFilter className="h-4 w-4" />
        <span>With Status</span>
      </Button>
    </div>
  );
}