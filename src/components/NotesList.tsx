import { FileText, Pin, Archive, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { useAppStore } from "../store";
import { Note } from "../../shared/types";

export function NotesList() {
  const { 
    notes, 
    currentNoteId, 
    setCurrentNote, 
    deleteNote, 
    searchQuery, 
    searchFilters 
  } = useAppStore();

  // Filter notes based on search query and filters
  const filteredNotes = Object.values(notes).filter(note => {
    // Search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = note.title.toLowerCase().includes(query);
      const matchesContent = note.content.toLowerCase().includes(query);
      const matchesTags = note.tags.some(tag => tag.toLowerCase().includes(query));
      
      if (!matchesTitle && !matchesContent && !matchesTags) {
        return false;
      }
    }

    // Status filter
    if (searchFilters.status && note.status !== searchFilters.status) {
      return false;
    }

    // Tags filter
    if (searchFilters.tags && searchFilters.tags.length > 0) {
      const hasMatchingTag = searchFilters.tags.some(filterTag => 
        note.tags.some(noteTag => noteTag.includes(filterTag))
      );
      if (!hasMatchingTag) {
        return false;
      }
    }

    return true;
  }).sort((a, b) => {
    // Sort by pinned, then by updated date
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const handleNoteClick = (noteId: string) => {
    setCurrentNote(noteId);
  };

  const handleDeleteNote = async (noteId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this note?')) {
      await deleteNote(noteId);
    }
  };

  const formatDate = (date: Date) => {
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
    <ScrollArea className="h-full">
      <div className="p-2">
        {filteredNotes.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {searchQuery ? (
              <div>
                <p>No notes found for "{searchQuery}"</p>
                <p className="text-sm mt-1">Try a different search term</p>
              </div>
            ) : (
              <div>
                <FileText size={48} className="mx-auto mb-4 opacity-50" />
                <p>No notes yet</p>
                <p className="text-sm mt-1">Create your first note to get started</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent ${
                  currentNoteId === note.id ? 'bg-accent border-accent-foreground' : 'border-border'
                }`}
                onClick={() => handleNoteClick(note.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-sm truncate flex-1">
                    {note.title || 'Untitled Note'}
                  </h3>
                  
                  <div className="flex items-center gap-1 ml-2">
                    {note.pinned && <Pin size={12} className="text-primary" />}
                    {note.archived && <Archive size={12} className="text-muted-foreground" />}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDeleteNote(note.id, e)}
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>

                {note.content && (
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                    {getPreview(note.content)}
                  </p>
                )}

                {note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {note.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs h-5">
                        {tag}
                      </Badge>
                    ))}
                    {note.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs h-5">
                        +{note.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatDate(note.updatedAt)}</span>
                  <Badge 
                    variant={note.status === 'published' ? 'default' : 'secondary'}
                    className="text-xs h-4"
                  >
                    {note.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}