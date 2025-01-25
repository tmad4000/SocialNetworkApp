import { Button } from "@/components/ui/button";
import { ListFilter, LayoutList, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Status } from "@/components/ui/status-pill";

const STATUSES: Status[] = ['none', 'not acknowledged', 'acknowledged', 'in progress', 'done'];

interface PostFilterProps {
  showStatusOnly: boolean;
  onFilterChange: (showStatusOnly: boolean) => void;
  selectedStatuses?: Status[];
  onStatusesChange?: (statuses: Status[]) => void;
}

export default function PostFilter({ 
  showStatusOnly, 
  onFilterChange, 
  selectedStatuses = STATUSES,
  onStatusesChange = () => {} 
}: PostFilterProps) {
  const [statusCounts, setStatusCounts] = useState({}); // Added state for status counts

  return (
    <div className="flex gap-2">
      <div className="flex">
        <Button
          variant="outline"
          size="sm"
          className={`${
            showStatusOnly ? "bg-gray-200 text-black hover:bg-gray-300" : ""
          } gap-2 rounded-r-none border-r-0`}
          onClick={() => onFilterChange(true)}
        >
          <ListFilter className="h-4 w-4" />
          <span>With Status</span>
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`${
                showStatusOnly ? "bg-gray-200 text-black hover:bg-gray-300" : ""
              } px-2 rounded-l-none`}
            >
              <ChevronDown className="h-4 w-4" />
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
                          onStatusesChange([...selectedStatuses, status]);
                        } else {
                          onStatusesChange(
                            selectedStatuses.filter((s) => s !== status)
                          );
                        }
                      }}
                      disabled={!showStatusOnly}
                    />
                    <Label 
                      htmlFor={status} 
                      className={`capitalize ${!showStatusOnly ? "text-muted-foreground" : ""}`}
                    >
                      {status === 'none' ? 'No Status' : status}
                      {showStatusOnly && ` (${statusCounts[status] || 0})`}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <Button
        variant="outline"
        size="sm"
        className={`gap-2 ${
          !showStatusOnly ? "bg-gray-200 text-black hover:bg-gray-300" : ""
        }`}
        onClick={() => onFilterChange(false)}
      >
        <LayoutList className="h-4 w-4" />
        <span>All Posts</span>
      </Button>
    </div>
  );
}

export type { Status };