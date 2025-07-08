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


export function NotesList() {
  const { 
    notes: notesMap,
    currentNoteId, 
    setCurrentNote, 
    deleteNote: storeDeleteNote,
    searchQuery: globalSearchQuery,
    setSearchQuery: setGlobalSearchQuery,
    ontology,
    searchFilters,
    setSearchFilters: setStoreSearchFilters // Get setSearchFilters from store
  } = useAppStore();

  const [displayedNotes, setDisplayedNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [localSearchTerm, setLocalSearchTerm] = useState(globalSearchQuery);
  const [expandedOntologyNodes, setExpandedOntologyNodes] = useState<Set<string>>(new Set());

  const allNotes = useMemo(() => Object.values(notesMap), [notesMap]);

  useEffect(() => {
    // Sync local search term if global one changes (e.g. from clearing it)
    setLocalSearchTerm(globalSearchQuery);
  }, [globalSearchQuery]);

  // Main search and filtering logic
  useEffect(() => {
    const performSearchAndFilter = async () => {
      setIsLoading(true);
      
      let notesToFilter = [...allNotes]; // Create a mutable copy

      // If specific tags are selected via ontology filter, apply this first
      // This logic ensures that notes must contain AT LEAST ONE of the semantically matched tags.
      if (searchFilters.tags && searchFilters.tags.length > 0) {
        const lowercasedFilterTags = searchFilters.tags.map(t => t.toLowerCase());
        notesToFilter = notesToFilter.filter(note =>
          note.tags.some(noteTag => lowercasedFilterTags.includes(noteTag.toLowerCase()))
        );
      }

      // Then, if there's a text search query, apply semantic search on the (potentially pre-filtered by ontology tags) notes
      const searchResults = await NoteService.semanticSearch(localSearchTerm, ontology, notesToFilter);

      // Apply other non-tag, non-text filters (status, etc.)
      const fullyFilteredResults = searchResults.filter(note => {
        if (searchFilters.status && note.status !== searchFilters.status) {
          return false;
        }
        // Folder and DateRange filters would go here
        return true;
      }).sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      setDisplayedNotes(fullyFilteredResults);
      setIsLoading(false);
    };

    performSearchAndFilter();
  }, [localSearchTerm, ontology, allNotes, searchFilters]);


  const handleNoteClick = (noteId: string) => {
    setCurrentNote(noteId);
  };

  const handleDeleteNote = async (noteId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm('Are you sure you want to delete this note?')) {
      await storeDeleteNote(noteId);
    }
  };

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
          ) : displayedNotes.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 px-4">
              {localSearchTerm || (searchFilters.tags && searchFilters.tags.length > 0) ? (
                <>
                  <p className="text-sm">No notes found matching your criteria.</p>
                  <p className="text-xs mt-1">Try adjusting your search or filters.</p>
                </>
              ) : (
                <>
                  <FileText size={36} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No notes yet.</p>
                  <p className="text-xs mt-1">Create your first note to get started!</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {displayedNotes.map((note) => (
                <div
                  key={note.id}
                  className={`p-2.5 rounded-md border cursor-pointer transition-colors group hover:bg-accent ${
                    currentNoteId === note.id ? 'bg-accent border-primary shadow-sm' : 'border-transparent hover:border-accent-foreground/10'
                  }`}
                  onClick={() => handleNoteClick(note.id)}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0"> {/* Wrapper for title and badge */}
                      <h3 className="font-semibold text-sm truncate group-hover:text-accent-foreground">
                        {note.title || 'Untitled Note'}
                      </h3>
                      {note.isSharedPublicly && (
                        <Badge variant="outline" className="px-1.5 py-0 text-xs h-5 border-green-500 text-green-600 dark:text-green-400">
                          {/* Optional: <Globe size={10} className="mr-1" /> */}
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
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}