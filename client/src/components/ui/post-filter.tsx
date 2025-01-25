import { Button } from "@/components/ui/button";
import { ListFilter } from "lucide-react";
import { useState, useEffect } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Status } from "@/components/ui/status-pill";

const STATUSES: Status[] = ['none', 'not acknowledged', 'acknowledged', 'in progress', 'done'];

interface PostFilterProps {
  showStatusOnly: boolean;
  onFilterChange: (showStatusOnly: boolean) => void;
}

export default function PostFilter({ showStatusOnly, onFilterChange }: PostFilterProps) {
  const [selectedStatuses, setSelectedStatuses] = useState<Status[]>(STATUSES);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-2 transition-colors ${
            showStatusOnly && "bg-gray-200 text-black hover:bg-gray-300"
          }`}
        >
          <ListFilter className="h-4 w-4" />
          <span>With Status</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-4">
        <div className="space-y-4">
          <p className="text-sm font-medium">Filter by status</p>
          <div className="space-y-2">
            {STATUSES.map((status) => (
              <div key={status} className="flex items-center space-x-2">
                <Checkbox
                  id={status}
                  checked={selectedStatuses.includes(status)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedStatuses([...selectedStatuses, status]);
                    } else {
                      setSelectedStatuses(selectedStatuses.filter((s) => s !== status));
                    }
                    // Only show status filter if at least one status is selected
                    onFilterChange(selectedStatuses.length > 0);
                  }}
                />
                <Label htmlFor={status} className="capitalize">
                  {status === 'none' ? 'No Status' : status}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}