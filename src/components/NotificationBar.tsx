import { X, Bell } from "lucide-react";
import { Button } from "./ui/button";

export function NotificationBar() {
  // For now, just a placeholder for notifications
  // In later phases, this will show real-time alerts for matches, DMs, etc.
  
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between hidden">
      <div className="flex items-center gap-2">
        <Bell size={16} />
        <span className="text-sm">New match found for #AI notes</span>
      </div>
      <Button variant="ghost" size="sm">
        <X size={16} />
      </Button>
    </div>
  );
}