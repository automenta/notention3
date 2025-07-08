import { useEffect } from "react";
import { useAppStore } from "./store";
import { Sidebar } from "./components/Sidebar";
import { NoteEditor } from "./components/NoteEditor";
import { LoadingSpinner } from "./components/ui/loading-spinner";
import { NotificationBar } from "./components/NotificationBar";

export default function App() {
  const { initializeApp, loading } = useAppStore();

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  if (loading.notes || loading.ontology) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Notification Bar */}
      <NotificationBar />
      
      {/* Main Layout */}
      <div className="flex flex-1">
        {/* Mobile: Single column, Desktop: Two column */}
        <div className="flex-1 flex flex-col md:flex-row">
          {/* Sidebar */}
          <div className="w-full md:w-80 border-r border-border">
            <Sidebar />
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col">
            <NoteEditor />
          </div>
        </div>
      </div>
    </div>
  );
}
