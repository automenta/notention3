import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { FileText, Pin, Archive, Trash2, Search, ChevronDown, ChevronRight, Tag, Folder as FolderIcon, FolderOpen } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea, ScrollBar } from "./ui/scroll-area"; // ScrollArea might provide the scrollable element
import { Input } from "./ui/input";
import { useAppStore } from "../store";
import { Note, OntologyNode, Folder, DirectMessage } from "../../shared/types"; // Added Folder, DirectMessage
import { NoteService } from "../services/NoteService";
import { FolderService } from "../services/FolderService";
import { OntologyService } from "../services/ontology";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { toast } from "sonner"; // For user feedback, e.g. when opening DM
import { useVirtualizer } from '@tanstack/react-virtual'; // Import for virtualization

interface NotesListProps {
  viewMode: 'notes' | 'chats';
}

// Define a type for folder tree nodes that includes the original folder data and its children
interface FolderTreeNode extends Folder {
  childrenNodes?: FolderTreeNode[];
}

export function NotesList({ viewMode }: NotesListProps) {
  const parentScrollRef = useRef<HTMLDivElement>(null); // Ref for the scrollable container
  const {
    notes: notesMap,
    folders: foldersMap, // Get folders from store
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
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set()); // For folder tree
  const [sortOption, setSortOption] = useState<'updatedAt' | 'title' | 'createdAt'>('updatedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');


  const allNotes = useMemo(() => Object.values(notesMap), [notesMap]);
  const allFolders = useMemo(() => Object.values(foldersMap), [foldersMap]);

  const folderTree = useMemo(() => {
    // Use FolderService.buildFolderTree which expects Folder[] and returns Folder[] (roots)
    // but we'll adapt it or use a local version if its return type isn't exactly FolderTreeNode[]
    const buildTree = (folders: Folder[], parentId?: string): FolderTreeNode[] => {
      return folders
        .filter(folder => folder.parentId === parentId)
        .map(folder => ({
          ...folder,
          childrenNodes: buildTree(folders, folder.id)
        }));
    };
    return buildTree(allFolders);
  }, [allFolders]);

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
          debouncedSearchTerm, // Use debounced term for search
          ontology,
          searchFilters,
          allNotes
        );
        const sortedNotes = [...results]; // Create a mutable copy for sorting

        // Primary sort logic based on sortOption and sortDirection
        sortedNotes.sort((a, b) => {
          let compareA, compareB;
          switch (sortOption) {
            case 'title':
              compareA = a.title.toLowerCase();
              compareB = b.title.toLowerCase();
              break;
            case 'createdAt':
              compareA = new Date(a.createdAt).getTime();
              compareB = new Date(b.createdAt).getTime();
              break;
            case 'updatedAt':
            default:
              compareA = new Date(a.updatedAt).getTime();
              compareB = new Date(b.updatedAt).getTime();
              break;
          }

          if (compareA < compareB) {
            return sortDirection === 'asc' ? -1 : 1;
          }
          if (compareA > compareB) {
            return sortDirection === 'asc' ? 1 : -1;
          }
          return 0;
        });

        // Secondary sort by pinned status (pinned notes always first)
        sortedNotes.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return 0;
        });

        setDisplayedItems(sortedNotes);
      } else if (viewMode === 'chats') {
        // Filter DMs based on debouncedSearchTerm
        const lowerSearch = debouncedSearchTerm.toLowerCase(); // Use debounced term
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
  }, [viewMode, debouncedSearchTerm, ontology, allNotes, searchFilters, directMessages, userProfile?.nostrPubkey, sortOption, sortDirection]);


  const handleItemClick = (item: Note | DirectMessage) => {
    if (viewMode === 'notes') {
      setCurrentNote((item as Note).id);
    } else if (viewMode === 'chats') {
      // For chats, clicking a DM summary could navigate to a dedicated DM panel or view
      const dm = item as DirectMessage;
      const otherParty = dm.from === userProfile?.nostrPubkey ? dm.to : dm.from;
      // Example: useAppStore.setState({ currentDmChatPubkey: otherParty, sidebarTab: 'contacts' }); // Navigate to contacts/DM panel
      // For now, this action is handled by the component that lists DM threads if a dedicated one exists,
      // or could trigger opening a modal/panel.
      // The current `DirectMessagesPanel` handles its own selection.
      // If `NotesList` in `viewMode='chats'` is still used, it should probably set a global state for the selected chat.
      toast.info(`Selected chat with ${otherParty.substring(0,10)}... Navigating to DMs often happens via Contacts or a dedicated DM panel.`);
      // As `DirectMessagesPanel` exists, this viewMode in NotesList might be less used or deprecated for DMs.
      // If it's meant to be a quick preview, setCurrentNote or a similar action for DMs might be needed.
      // For now, let's assume navigation to a DM-focused area is desired.
      setSidebarTab('contacts'); // Or 'directMessages' if that tab exists.
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

  const handleFolderClick = useCallback((folderId: string | undefined) => {
    // If clicking "All Notes" (folderId is undefined) or the currently active folder, clear folder filter
    if (folderId === searchFilters.folderId || folderId === undefined) {
      setStoreSearchFilters({ ...searchFilters, folderId: undefined });
    } else {
      // Otherwise, filter by this folder
      setStoreSearchFilters({ ...searchFilters, folderId: folderId });
    }
    // Clear text search and tag search when applying/clearing folder filter
    setLocalSearchTerm("");
    setGlobalSearchQuery("");
    setStoreSearchFilters(prev => ({ ...prev, tags: undefined }));
  }, [searchFilters, setStoreSearchFilters, setGlobalSearchQuery]);

  const toggleFolderExpansion = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
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
    // Clear text search and folder filter when applying/clearing ontology filter for clarity
    setLocalSearchTerm("");
    setGlobalSearchQuery("");
    setStoreSearchFilters(prev => ({ ...prev, folderId: undefined }));
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

  const renderFolderNode = (folderNode: FolderTreeNode, level: number = 0): JSX.Element => {
    const isExpanded = expandedFolders.has(folderNode.id);
    const isActive = searchFilters.folderId === folderNode.id;

    return (
      <div key={folderNode.id} className={`ml-${level * 2} my-0.5`}>
        <div
          className={`flex items-center gap-1 py-1 px-1.5 rounded group cursor-pointer hover:bg-accent ${isActive ? 'bg-accent border-primary' : 'hover:bg-accent/80'}`}
          onClick={() => handleFolderClick(folderNode.id)}
        >
          {folderNode.childrenNodes && folderNode.childrenNodes.length > 0 ? (
            <Button
              variant="ghost"
              size="xs"
              className="h-5 w-5 p-0 hover:bg-accent/50"
              onClick={(e) => {
                e.stopPropagation(); // Prevent folder click when toggling
                toggleFolderExpansion(folderNode.id);
              }}
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </Button>
          ) : (
            <span className="w-5 inline-block" /> // Placeholder for alignment
          )}
          {isExpanded ? <FolderOpen size={14} className={`mr-1.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} /> : <FolderIcon size={14} className={`mr-1.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />}
          <span className={`text-xs truncate ${isActive ? 'font-semibold text-primary' : 'text-foreground'}`}>
            {folderNode.name}
          </span>
          {/* Optional: Show note count in folder */}
          {/* <Badge variant="secondary" className="ml-auto text-xxs px-1">{folderNode.noteIds.length}</Badge> */}
        </div>
        {isExpanded && folderNode.childrenNodes && folderNode.childrenNodes.length > 0 && (
          <div className="pl-3 border-l border-dashed border-muted-foreground/20 ml-[11px]">
            {folderNode.childrenNodes.map(child => renderFolderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
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
            {children.map(child => renderOntologyFilterNode(child, level + 1))} {/* level reset for children as padding is on parent */}
          </div>
        )}
      </div>
    );
  };

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return 'Invalid date'; // Handle invalid dates
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0 && now.getDate() === date.getDate()) return 'Today';
    if (diffDays === 0 && now.getDate() !== date.getDate()) { // e.g. just past midnight
      return date.toLocaleDateString(); // Show full date if not same calendar day
    }
    if (diffDays === 1 && (now.getDate() - date.getDate() === 1 || (now.getDate() === 1 && date.getDate() >= 28))) return 'Yesterday'; // Basic yesterday check
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getPreview = (content: string) => {
    // Remove HTML tags and get first 100 characters
    const text = content.replace(/<[^>]*>/g, '');
    return text.length > 100 ? text.substring(0, 100) + '...' : text;
  };

  // Virtualizer instance
  const rowVirtualizer = useVirtualizer({
    count: displayedItems.length,
    getScrollElement: () => parentScrollRef.current,
    estimateSize: useCallback((index: number) => {
      // Estimate size based on item type and content complexity
      // This is a rough estimate. A more accurate measurement would be better.
      const item = displayedItems[index];
      if (!item) return 100; // Default fallback

      if (viewMode === 'notes') {
        const note = item as Note;
        let height = 60; // Base height for title, date
        if (note.content) height += 18; // For preview line
        if (note.tags.length > 0) height += 22; // For tags line
        return Math.max(80, Math.min(height, 120)); // Clamp between 80 and 120
      } else if (viewMode === 'chats') {
        return 70; // DMs are simpler, more fixed height
      }
      return 100; // Default
    }, [displayedItems, viewMode]),
    overscan: 5, // Render a few items outside the viewport for smoother scrolling
  });

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

      {/* Sort Options - Only for 'notes' viewMode */}
      {viewMode === 'notes' && (
        <div className="p-2 border-b border-border flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Sort by:</span>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as typeof sortOption)}
            className="p-1 border rounded-md bg-background text-xs h-7"
          >
            <option value="updatedAt">Last Updated</option>
            <option value="createdAt">Created Date</option>
            <option value="title">Title</option>
          </select>
          <select
            value={sortDirection}
            onChange={(e) => setSortDirection(e.target.value as typeof sortDirection)}
            className="p-1 border rounded-md bg-background text-xs h-7"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      )}

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
          {Object.keys(ontology.nodes).length > 0 ? (
            <ScrollArea className="max-h-40">
               <div className="space-y-0.5">
                {ontology.rootIds.map(rootId => renderOntologyFilterNode(ontology.nodes[rootId])).filter(Boolean)}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-xs text-muted-foreground px-1 py-2">No ontology tags defined.</p>
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

      {/* Folders Section */}
      <Collapsible className="border-b border-border" defaultOpen>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-start px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-none">
            <FolderIcon size={14} className="mr-2" />
            Folders
            <ChevronDown size={14} className="ml-auto data-[state=open]:rotate-180 transition-transform" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-2 text-sm bg-muted/30">
          <ScrollArea className="max-h-60"> {/* Adjust max height as needed */}
            <div className="space-y-0.5">
              <div
                className={`flex items-center gap-1 py-1 px-1.5 rounded group cursor-pointer hover:bg-accent ${!searchFilters.folderId ? 'bg-accent border-primary' : 'hover:bg-accent/80'}`}
                onClick={() => handleFolderClick(undefined)} // Click for "All Notes"
              >
                <span className="w-5 inline-block" /> {/* Alignment spacer */}
                <FileText size={14} className={`mr-1.5 ${!searchFilters.folderId ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-xs truncate ${!searchFilters.folderId ? 'font-semibold text-primary' : 'text-foreground'}`}>
                  All Notes
                </span>
              </div>
              {folderTree.map(folderNode => renderFolderNode(folderNode, 0))}
              {folderTree.length === 0 && (
                 <p className="text-xs text-muted-foreground px-1 py-2">No folders created yet.</p>
              )}
            </div>
          </ScrollArea>
           {(searchFilters.folderId) && (
            <Button
              variant="outline"
              size="xs"
              className="mt-2 w-full h-7 text-xs"
              onClick={() => handleFolderClick(undefined)}
            >
              Clear Folder Filter (Show All Notes)
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>


      {/* Main List Area - Virtualized */}
      <ScrollArea className="flex-1" ref={parentScrollRef}>
        <div className="p-2">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading...</div>
          ) : displayedItems.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 px-4">
              {/* Empty state message remains similar */}
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
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                const item = displayedItems[virtualItem.index];
                if (!item) return null;

                if (viewMode === 'notes') {
                  const note = item as Note;
                  return (
                    <div
                      key={note.id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                        paddingBottom: '4px', // Simulates space-y-1 for virtualized items
                      }}
                    >
                      <div
                        className={`p-2.5 rounded-md border cursor-pointer transition-colors group h-full flex flex-col justify-between hover:bg-accent ${
                          currentNoteId === note.id ? 'bg-accent border-primary shadow-sm' : 'border-transparent hover:border-accent-foreground/10'
                        }`}
                        onClick={() => handleItemClick(note)}
                      >
                        <div> {/* Content wrapper for flex layout */}
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
                        </div>
                        <div className="text-xs text-muted-foreground group-hover:text-accent-foreground/70 mt-auto">
                          {formatDate(note.updatedAt)}
                        </div>
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
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                        paddingBottom: '4px',
                      }}
                    >
                      <div
                        className={`p-2.5 rounded-md border cursor-pointer transition-colors group h-full flex flex-col justify-between hover:bg-accent border-transparent hover:border-accent-foreground/10`}
                        onClick={() => handleItemClick(dm)}
                      >
                        <div>
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
                         {/* Could add a small timestamp at the bottom if needed */}
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );

}