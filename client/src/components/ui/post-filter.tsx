import { Button } from "@/components/ui/button";
import { ListFilter, LayoutList, ChevronDown, Star } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Status } from "@/components/ui/status-pill";
import { useLocation, useSearch } from "wouter";
import { useEffect } from "react";

const STATUSES: Status[] = ['none', 'not acknowledged', 'acknowledged', 'in progress', 'done'];

interface PostFilterProps {
  showStatusOnly: boolean;
  onFilterChange: (showStatusOnly: boolean) => void;
  selectedStatuses?: Status[];
  onStatusesChange?: (statuses: Status[]) => void;
  statusCounts?: Record<Status, number>;
  showStarredOnly?: boolean;
  onStarredFilterChange?: (showStarredOnly: boolean) => void;
}

export default function PostFilter({ 
  showStatusOnly, 
  onFilterChange, 
  selectedStatuses = STATUSES,
  onStatusesChange = () => {},
  statusCounts = {} as Record<Status, number>,
  showStarredOnly = false,
  onStarredFilterChange = () => {},
}: PostFilterProps) {
  const [location, setLocation] = useLocation();

  // Parse and sync URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const starred = params.get('starred') === 'true';
    const status = params.get('status') === 'true';

    if (starred !== showStarredOnly) {
      onStarredFilterChange(starred);
    }
    if (status !== showStatusOnly) {
      onFilterChange(status);
    }
  }, [location]);

  // Update URL parameters when filters change
  const updateURLParams = (starred: boolean, status: boolean) => {
    const params = new URLSearchParams(window.location.search);
    params.set('starred', starred.toString());
    params.set('status', status.toString());
    setLocation(`${window.location.pathname}?${params.toString()}`, {
      replace: true
    });
  };

  return (
    <div className="flex gap-2">
      <div className="flex">
        <Button
          variant="outline"
          size="sm"
          className={`${
            showStatusOnly ? "bg-gray-200 text-black hover:bg-gray-300" : ""
          } gap-2 rounded-r-none border-r-0`}
          onClick={() => {
            const newStatus = !showStatusOnly;
            onFilterChange(newStatus);
            updateURLParams(showStarredOnly, newStatus);
          }}
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
          !showStarredOnly && !showStatusOnly ? "bg-gray-200 text-black hover:bg-gray-300" : ""
        }`}
        onClick={() => {
          onStarredFilterChange(false);
          onFilterChange(false);
          updateURLParams(false, false);
        }}
      >
        <LayoutList className="h-4 w-4" />
        <span>All Posts</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        className={`gap-2 ${
          showStarredOnly ? "bg-gray-200 text-black hover:bg-gray-300" : ""
        }`}
        onClick={() => {
          onStarredFilterChange(true);
          onFilterChange(false);
          updateURLParams(true, false);
        }}
      >
        <Star className="h-4 w-4" />
        <span>Best Ideas</span>
      </Button>
    </div>
  );
}

export type { Status };