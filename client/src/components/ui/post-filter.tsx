import { Button } from "@/components/ui/button";
import { ListFilter } from "lucide-react";

interface PostFilterProps {
  showStatusOnly: boolean;
  onFilterChange: (showStatusOnly: boolean) => void;
}

export default function PostFilter({ showStatusOnly, onFilterChange }: PostFilterProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={() => onFilterChange(!showStatusOnly)}
    >
      <ListFilter className="h-4 w-4" />
      <span>{showStatusOnly ? 'Show All Posts' : 'Show Posts with Status'}</span>
    </Button>
  );
}
