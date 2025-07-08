import { useEffect, useState, useMemo, useCallback } from "react";
import { FileText, Pin, Archive, Trash2, Search, ChevronDown, ChevronRight, Tag } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Input } from "./ui/input";
import { useAppStore } from "../store";
import { Note, OntologyNode } from "../../shared/types";
import { NoteService } from "../services/NoteService";
import { OntologyService } from "../services/ontology"; // Import OntologyService
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible"; // For collapsible sections
import { DirectMessage } from "../../shared/types"; // Import DirectMessage type

interface NotesListProps {
  viewMode: 'notes' | 'chats';
}

export function NotesList({ viewMode }: NotesListProps) {
  const { 
    notes: notesMap,
    directMessages, // Get DMs from store
    currentNoteId, 
    setCurrentNote, 
    deleteNote: storeDeleteNote,
    searchQuery: globalSearchQuery,
    setSearchQuery: setGlobalSearchQuery,
    ontology,
    searchFilters,
    setSearchFilters: setStoreSearchFilters,
    userProfile, // For identifying self in DMs
    setSidebarTab, // For navigating to DM panel
  } = useAppStore();

  const [displayedItems, setDisplayedItems] = useState<(Note | DirectMessage)[]>([]); // Can be Note or DM
  const [isLoading, setIsLoading] = useState(false);
  const [localSearchTerm, setLocalSearchTerm] = useState(globalSearchQuery); // Input field's immediate value
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(globalSearchQuery); // Debounced value for triggering search
  const [expandedOntologyNodes, setExpandedOntologyNodes] = useState<Set<string>>(new Set());

  const allNotes = useMemo(() => Object.values(notesMap), [notesMap]);

  useEffect(() => {
    // Sync local search term if global one changes
    setLocalSearchTerm(globalSearchQuery);
    setDebouncedSearchTerm(globalSearchQuery); // Also update debounced term immediately
  }, [globalSearchQuery]);

  // Debounce effect for localSearchTerm
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(localSearchTerm);
    }, 300); // 300ms debounce delay

    return () => {
      clearTimeout(handler);
    };
  }, [localSearchTerm]);

  // Main search and filtering logic - now uses debouncedSearchTerm
  useEffect(() => {
    const performSearchAndFilter = async () => {
      setIsLoading(true);
      if (viewMode === 'notes') {
        const results = await NoteService.semanticSearch(
          localSearchTerm,
          ontology,
          searchFilters,
          allNotes
        );
        const sortedNotes = results.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        setDisplayedItems(sortedNotes);
      } else if (viewMode === 'chats') {
        // Filter DMs based on localSearchTerm (e.g., search content or participant pubkey)
        const lowerSearch = localSearchTerm.toLowerCase();
        const filteredDms = directMessages.filter(dm =>
          dm.content.toLowerCase().includes(lowerSearch) ||
          dm.from.toLowerCase().includes(lowerSearch) ||
          dm.to.toLowerCase().includes(lowerSearch)
        ).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Newest first

        // Group DMs by participant (simple grouping for now)
        const threads: { [pubkey: string]: DirectMessage[] } = {};
        filteredDms.forEach(dm => {
          const otherParty = dm.from === userProfile?.nostrPubkey ? dm.to : dm.from;
          if (!threads[otherParty]) threads[otherParty] = [];
          threads[otherParty].push(dm);
        });

        // Create summary items for display (latest message from each thread)
        const summaryItems = Object.entries(threads).map(([pubkey, msgs]) => {
          return msgs[0]; // The first message after sorting by time (newest)
        }).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setDisplayedItems(summaryItems);
      }
      setIsLoading(false);
    };

    performSearchAndFilter();
  }, [viewMode, debouncedSearchTerm, ontology, allNotes, searchFilters, directMessages, userProfile?.nostrPubkey]);


  const handleItemClick = (item: Note | DirectMessage) => {
    if (viewMode === 'notes') {
      setCurrentNote((item as Note).id);
    } else if (viewMode === 'chats') {
      // For chats, clicking a DM summary could navigate to a dedicated DM panel or view
      // For now, let's just log it, or set a state to open a DM panel later
      const dm = item as DirectMessage;
      const otherParty = dm.from === userProfile?.nostrPubkey ? dm.to : dm.from;
      console.log("Clicked DM thread with:", otherParty);
      // Example: useAppStore.setState({ currentDmChatPubkey: otherParty, sidebarTab: 'network' }); // to open DM panel
      // Or, if DirectMessagesPanel is part of NotesList/Sidebar structure:
      // useAppStore.getState().openDirectMessagePanel(otherParty);
      toast.info(`Opening chat with ${otherParty.substring(0,10)}... (UI Placeholder)`);
      // For now, let's switch to the Network tab as a placeholder for where DMs are also handled.
      // A proper DM view would be better.
      // setSidebarTab('network');
    }
  };

  const handleDeleteNote = async (noteId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm('Are you sure you want to delete this note?')) {
      await storeDeleteNote(noteId);
    }
  };
  // No delete for DMs from this list for now.

  const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchTerm(event.target.value);
     // If user types in search box, we might want to clear the ontology tag filter
    if (searchFilters.tags && searchFilters.tags.length > 0) {
      // setStoreSearchFilters({ ...searchFilters, tags: undefined }); // Option 1: Clear immediately
    }
  };

  const handleSearchSubmit = (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    // When submitting text search, clear any active ontology tag selection
    setStoreSearchFilters({ ...searchFilters, tags: undefined });
    setGlobalSearchQuery(localSearchTerm);
  };

  const handleOntologyTagClick = useCallback((tagNode: OntologyNode) => {
    const currentFilterTags = searchFilters.tags || [];
    const semanticMatches = OntologyService.getSemanticMatches(ontology, tagNode.label);

    const isFilteringByThisNode = semanticMatches.every(sm => currentFilterTags.includes(sm)) &&
                                 currentFilterTags.length === semanticMatches.length;

    if (isFilteringByThisNode) {
      setStoreSearchFilters({ ...searchFilters, tags: undefined }); // Clear tag filter
    } else {
      setStoreSearchFilters({ ...searchFilters, tags: semanticMatches });
    }
    // Clear text search when applying/clearing ontology filter for clarity
    setLocalSearchTerm("");
    setGlobalSearchQuery("");

  }, [ontology, searchFilters, setStoreSearchFilters, setGlobalSearchQuery]);

  const toggleOntologyNodeExpansion = (nodeId: string) => {
    setExpandedOntologyNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const renderOntologyFilterNode = (node: OntologyNode, level: number = 0): JSX.Element | null => {
    if (!ontology || !ontology.nodes || !node ) return null; // Added !ontology.nodes check
    const children = OntologyService.getChildNodes(ontology, node.id);
    const isExpanded = expandedOntologyNodes.has(node.id);

    // Check if the current node's semantic group is active in the filter
    const semanticMatchesForNode = OntologyService.getSemanticMatches(ontology, node.label);
    const isActiveFilter = (searchFilters.tags || []).length > 0 &&
                           semanticMatchesForNode.every(sm => (searchFilters.tags || []).includes(sm)) &&
                           (searchFilters.tags || []).length === semanticMatchesForNode.length;

    return (
      <div key={node.id} className={`ml-${level * 2}`}> {/* Simplified padding */}
        <div className="flex items-center gap-1 py-0.5 group"> {/* Reduced py */}
          {children.length > 0 ? (
            <Button
              variant="ghost"
              size="xs"
              className="h-5 w-5 p-0 hover:bg-accent/50" // Adjusted size and hover
              onClick={() => toggleOntologyNodeExpansion(node.id)}
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </Button>
          ) : (
            <span className="w-5 inline-block" />
          )}
          <Badge
            variant={isActiveFilter ? "default" : "outline"} // Use outline for non-active
            className={`text-xs cursor-pointer hover:border-primary ${isActiveFilter ? 'border-primary' : 'border-border'}`}
            onClick={() => handleOntologyTagClick(node)}
            title={`Filter by ${node.label} and its related tags`}
          >
            {node.label}
          </Badge>
        </div>
        {isExpanded && children.length > 0 && (
          <div className="pl-2 border-l border-dashed border-muted-foreground/30 ml-[9px]"> {/* Indent children further, add guide line */}
            {children.map(child => renderOntologyFilterNode(child, 0))} {/* level reset for children as padding is on parent */}
          </div>
        )}
      </div>
    );
  };

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - new Date(date).getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return new Date(date).toLocaleDateString();
  };

  const getPreview = (content: string) => {
    // Remove HTML tags and get first 100 characters
    const text = content.replace(/<[^>]*>/g, '');
    return text.length > 100 ? text.substring(0, 100) + '...' : text;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="p-2 border-b border-border sticky top-0 bg-background z-10">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search all notes..."
            value={localSearchTerm}
            onChange={handleSearchInputChange}
            className="pl-8 w-full h-9"
          />
        </div>
      </form>

      {/* Ontology Tag Filters Section */}
      <Collapsible className="border-b border-border">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-start px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-none">
            <Tag size={14} className="mr-2" />
            Filter by Ontology Tags
            <ChevronDown size={14} className="ml-auto data-[state=open]:rotate-180 transition-transform" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-2 text-sm bg-muted/30">
          {Object.keys(ontology.nodes).length > 0 ? ( // Check if ontology has any nodes
            <ScrollArea className="max-h-48"> {/* Limit height */}
               <div className="space-y-0.5">
                {ontology.rootIds.map(rootId => renderOntologyFilterNode(ontology.nodes[rootId])).filter(Boolean)}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-xs text-muted-foreground px-1 py-2">No ontology tags defined yet. Add some in the Ontology Editor.</p>
          )}
           {(searchFilters.tags && searchFilters.tags.length > 0) && (
            <Button
              variant="outline"
              size="xs"
              className="mt-2 w-full h-7 text-xs"
              onClick={() => {
                setStoreSearchFilters({ ...searchFilters, tags: undefined });
              }}
            >
              Clear Tag Filter ({searchFilters.tags.length} active)
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading...</div>
          ) : displayedItems.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 px-4">
              {localSearchTerm || (searchFilters.tags && searchFilters.tags.length > 0 && viewMode === 'notes') ? (
                <p className="text-sm">No {viewMode === 'notes' ? 'notes' : 'chats'} found matching your criteria.</p>
              ) : (
                <>
                  <FileText size={36} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No {viewMode === 'notes' ? 'notes' : 'chats'} yet.</p>
                  {viewMode === 'notes' && <p className="text-xs mt-1">Create your first note to get started!</p>}
                  {viewMode === 'chats' && <p className="text-xs mt-1">Direct messages will appear here.</p>}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {displayedItems.map((item) => {
                if (viewMode === 'notes') {
                  const note = item as Note;
                  return (
                    <div
                      key={note.id}
                      className={`p-2.5 rounded-md border cursor-pointer transition-colors group hover:bg-accent ${
                        currentNoteId === note.id ? 'bg-accent border-primary shadow-sm' : 'border-transparent hover:border-accent-foreground/10'
                      }`}
                      onClick={() => handleItemClick(note)}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate group-hover:text-accent-foreground">
                            {note.title || 'Untitled Note'}
                          </h3>
                          {note.isSharedPublicly && (
                            <Badge variant="outline" className="px-1.5 py-0 text-xs h-5 border-green-500 text-green-600 dark:text-green-400">
                              Public
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {note.pinned && <Pin size={12} className="text-primary" />}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDeleteNote(note.id, e)}
                            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-60 focus:opacity-60 text-muted-foreground hover:text-destructive hover:opacity-100"
                            aria-label="Delete note"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </div>
                      {note.content && (
                        <p className="text-xs text-muted-foreground group-hover:text-accent-foreground/80 mb-1.5 line-clamp-1">
                          {getPreview(note.content)}
                        </p>
                      )}
                      {note.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {note.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0.5 font-normal">
                              {tag}
                            </Badge>
                          ))}
                          {note.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0.5 font-normal">
                              +{note.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground group-hover:text-accent-foreground/70">
                        {formatDate(note.updatedAt)}
                      </div>
                    </div>
                  );
                } else if (viewMode === 'chats') {
                  const dm = item as DirectMessage;
                  const otherPartyPubkey = dm.from === userProfile?.nostrPubkey ? dm.to : dm.from;
                  const isOwnMessage = dm.from === userProfile?.nostrPubkey;
                  return (
                    <div
                      key={dm.id}
                      className={`p-2.5 rounded-md border cursor-pointer transition-colors group hover:bg-accent border-transparent hover:border-accent-foreground/10`}
                      onClick={() => handleItemClick(dm)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-sm truncate group-hover:text-accent-foreground">
                          Chat with: {otherPartyPubkey.substring(0,10)}...
                        </h3>
                        <span className="text-xs text-muted-foreground">{formatDate(dm.timestamp)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground group-hover:text-accent-foreground/80 line-clamp-2">
                        {isOwnMessage && <span className="font-medium">You: </span>}
                        {dm.content}
                      </p>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}