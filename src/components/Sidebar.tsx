import { FileText, Share2, Settings, Hash, MessageSquare, Plus, Users } from "lucide-react";
import { useSyncExternalStore, useMemo } from "react";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Input } from "./ui/input";
import { useAppStore } from "../store";
import { NotesList } from "./NotesList";
import { OntologyEditor } from "./OntologyEditor";
import { NetworkPanel } from "./NetworkPanel";
import { SettingsPanel } from "./SettingsPanel";
import { ContactsPanel } from "./ContactsPanel"; // Import ContactsPanel

export function Sidebar() {
  const store = useAppStore.getState();

  const getSnapshot = () => {
    return {
      sidebarTab: useAppStore.getState().sidebarTab,
      searchQuery: useAppStore.getState().searchQuery,
    };
  };

  const snapshot = useSyncExternalStore(
    useAppStore.subscribe,
    getSnapshot,
    getSnapshot
  );

  const { sidebarTab, searchQuery } = useMemo(() => snapshot, [snapshot]);

  const { setSidebarTab, createNote, setSearchQuery } = useAppStore(
    (state) => ({
      setSidebarTab: state.setSidebarTab,
      createNote: state.createNote,
      setSearchQuery: state.setSearchQuery,
    })
  );

  const handleNewNote = async () => {
    await createNote();
  };

  return (
    <div className="h-full flex flex-col bg-sidebar">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-sidebar-foreground">Notention</h1>
          <Button 
            size="sm" 
            onClick={handleNewNote}
            className="bg-sidebar-primary hover:bg-sidebar-primary/90"
          >
            <Plus size={16} />
          </Button>
        </div>
        
        <Input
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)} // Corrected to use setSearchQuery
          className="bg-sidebar-accent border-sidebar-border"
        />
      </div>

      {/* Tabs */}
      <Tabs value={sidebarTab} onValueChange={(value) => setSidebarTab(value as "notes" | "ontology" | "network" | "settings" | "contacts" | "chats")} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-6 bg-sidebar-accent m-2"> {/* Changed to grid-cols-6 */}
          <TabsTrigger value="notes" className="flex items-center gap-1 text-xs sm:text-sm px-1 sm:px-2">
            <FileText size={14} />
            <span className="hidden sm:inline">Notes</span>
          </TabsTrigger>
          <TabsTrigger value="chats" className="flex items-center gap-1 text-xs sm:text-sm px-1 sm:px-2">
            <MessageSquare size={14} />
            <span className="hidden sm:inline">Chats</span>
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-1 text-xs sm:text-sm px-1 sm:px-2"> {/* New Contacts Tab */}
            <Users size={14} />
            <span className="hidden sm:inline">People</span>
          </TabsTrigger>
          <TabsTrigger value="ontology" className="flex items-center gap-1 text-xs sm:text-sm px-1 sm:px-2">
            <Hash size={14} />
            <span className="hidden sm:inline">Tags</span>
          </TabsTrigger>
          <TabsTrigger value="network" className="flex items-center gap-1 text-xs sm:text-sm px-1 sm:px-2">
            <Share2 size={14} />
            <span className="hidden sm:inline">Net</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1 text-xs sm:text-sm px-1 sm:px-2">
            <Settings size={14} />
            <span className="hidden sm:inline">Set</span>
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="notes" className="h-full m-0">
            <NotesList viewMode="notes" />
          </TabsContent>
          <TabsContent value="chats" className="h-full m-0">
            <NotesList viewMode="chats" /> {/* This remains for DM threads overview */}
          </TabsContent>
          <TabsContent value="contacts" className="h-full m-0"> {/* New Contacts Panel Content */}
            <ContactsPanel />
          </TabsContent>
          <TabsContent value="ontology" className="h-full m-0">
            <OntologyEditor />
          </TabsContent>
          
          <TabsContent value="network" className="h-full m-0">
            <NetworkPanel />
          </TabsContent>
          
          <TabsContent value="settings" className="h-full m-0">
            <SettingsPanel />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}