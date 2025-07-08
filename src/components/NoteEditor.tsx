import { useEffect, useState, useRef, useCallback } from "react";
import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Mention, { MentionOptions, MentionPluginKey } from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import DOMPurify from 'dompurify';
import { Button } from "./ui/button";
// @ts-ignore
import { tippy } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import { ScrollArea } from "./ui/scroll-area";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "./ui/dialog"; // Added DialogFooter, DialogClose
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Save, Share, Archive, Pin, Bold, Italic, Link as LinkIcon, Hash, AtSign, Plus, Settings, Sparkles, Wand2, FileText } from "lucide-react"; // Added Sparkles, Wand2, FileText
import { useAppStore } from "../store";
import { aiService } from "../services/AIService"; // Import AI Service
import { toast } from "sonner"; // For notifications
import { LoadingSpinner } from "./ui/loading-spinner"; // For loading state

export function NoteEditor() {
  const { 
    currentNoteId, 
    notes, 
    editorContent, 
    setEditorContent, 
    updateNote,
    isEditing,
    ontology,
    templates,
    userProfile // Added userProfile to check AI settings
  } = useAppStore();

  const currentNote = currentNoteId ? notes[currentNoteId] : null;
  const [showMetadata, setShowMetadata] = useState(false);

  // AI Feature States
  const [isAutoTagging, setIsAutoTagging] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [currentSummary, setCurrentSummary] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newValueKey, setNewValueKey] = useState("");
  const [newValueValue, setNewValueValue] = useState("");
  const [newFieldKey, setNewFieldKey] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const suggestionRef = useRef<any>();
  const [suggestionItems, setSuggestionItems] = useState<any[]>([]);
  const [suggestionRange, setSuggestionRange] = useState<any>(null);


  const renderSuggestionList = (items: any[], range: any, command: (props: any) => void) => {
    const component = new ReactRenderer(SuggestionList, {
      props: { items, command },
      editor: editor!,
    });

    if (!suggestionRef.current) {
      suggestionRef.current = tippy(document.body, {
        getReferenceClientRect: () => editor!.storage[MentionPluginKey]?.decorationNode?.getBoundingClientRect() || null,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
        arrow: false,
      });
    }

    suggestionRef.current?.show();
  };

  const hideSuggestionList = () => {
    suggestionRef.current?.hide();
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'semantic-tag bg-primary/10 text-primary px-1 rounded',
        },
        suggestion: {
          items: ({ query, editor: currentEditor }) => {
            const trigger = currentEditor.storage[MentionPluginKey]?.active?.char;
            if (!trigger) return [];

            const allOntologyNodes = Object.values(ontology.nodes);
            let filteredNodes = allOntologyNodes
              .filter(node =>
                (trigger === '#' && node.label.startsWith('#')) ||
                (trigger === '@' && node.label.startsWith('@'))
              )
              .filter(node => node.label.toLowerCase().includes(query.toLowerCase()))
              .map(node => ({ id: node.id, label: node.label, trigger }))
              .slice(0, 10); // Limit suggestions

            setSuggestionItems(filteredNodes);
            return filteredNodes;
          },
          render: () => {
            let reactRenderer: ReactRenderer<any, any>;
            let popup: any;

            return {
              onStart: props => {
                setSuggestionRange(props.range);
                reactRenderer = new ReactRenderer(SuggestionList, {
                  props: { ...props, items: suggestionItems },
                  editor: props.editor,
                });

                popup = tippy(document.body, {
                  getReferenceClientRect: () => props.clientRect ? props.clientRect() : null,
                  appendTo: () => document.body,
                  content: reactRenderer.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                  arrow: false,
                });
              },
              onUpdate(props) {
                setSuggestionItems(props.items);
                reactRenderer.updateProps({...props, items: props.items});
                if (props.clientRect) {
                  popup[0].setProps({
                    getReferenceClientRect: props.clientRect,
                  });
                }
              },
              onKeyDown(props) {
                if (props.event.key === 'Escape') {
                  popup[0].hide();
                  return true;
                }
                // @ts-ignore
                return reactRenderer?.ref?.onKeyDown?.(props);
              },
              onExit() {
                popup[0].destroy();
                reactRenderer.destroy();
              },
            };
          },
          command: ({ editor, range, props }) => {
            // props here is the selected item e.g. { id: 'ai', label: '#AI', trigger: '#' }
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContentAt(range.from, `${props.label} `) // Insert with a space
              .run();

            // Add tag to note metadata if not already present
            if (currentNoteId && !currentNote?.tags.includes(props.label)) {
              const updatedTags = [...(currentNote?.tags || []), props.label];
              updateNote(currentNoteId, { tags: updatedTags });
            }
          },
          char: '#', // Default trigger, will be overridden by multiple Mention instances
        },
      } as Partial<MentionOptions>),
      // Separate Mention instance for @
       Mention.configure({
        HTMLAttributes: {
          class: 'semantic-tag bg-secondary/20 text-secondary-foreground px-1 rounded',
        },
        suggestion: {
          items: ({ query }) => {
            return Object.values(ontology.nodes)
              .filter(node => node.label.startsWith('@') && node.label.toLowerCase().includes(query.toLowerCase()))
              .map(node => ({ id: node.id, label: node.label, trigger: '@' }))
              .slice(0, 10);
          },
           render: () => { // Duplicating render logic, can be abstracted
            let reactRenderer: ReactRenderer<any, any>;
            let popup: any;
            return {
              onStart: props => {
                reactRenderer = new ReactRenderer(SuggestionList, { props, editor: props.editor });
                popup = tippy(document.body, { getReferenceClientRect: () => props.clientRect ? props.clientRect() : null, appendTo: () => document.body, content: reactRenderer.element, showOnCreate: true, interactive: true, trigger: 'manual', placement: 'bottom-start', arrow: false });
              },
              onUpdate: props => { reactRenderer.updateProps(props); if (props.clientRect) { popup[0].setProps({ getReferenceClientRect: props.clientRect }); } },
              onKeyDown: props => { if (props.event.key === 'Escape') { popup[0].hide(); return true; } return (reactRenderer.ref as any)?.onKeyDown?.(props); },
              onExit: () => { popup[0].destroy(); reactRenderer.destroy(); },
            };
          },
          command: ({ editor, range, props }) => {
            editor.chain().focus().deleteRange(range).insertContentAt(range.from, `${props.label} `).run();
            if (currentNoteId && !currentNote?.tags.includes(props.label)) {
              updateNote(currentNoteId, { tags: [...(currentNote?.tags || []), props.label] });
            }
          },
          char: '@',
        },
      } as Partial<MentionOptions>),
      Placeholder.configure({
        placeholder: 'Start writing your note... Type # or @ for suggestions.',
      }),
      Highlight.configure({
        multicolor: true,
      }),
    ],
    content: editorContent,
    editable: isEditing,
    onUpdate: ({ editor }) => {
      setEditorContent(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && currentNote && editor.getHTML() !== currentNote.content) {
      editor.commands.setContent(currentNote.content);
    }
  }, [editor, currentNote, currentNote?.content]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing);
    }
  }, [isEditing, editor]);

  const handleSave = useCallback(async () => {
    if (!currentNoteId || !currentNote || !editor) return;
    
    await updateNote(currentNoteId, {
      content: editor.getHTML(), // Use editor's current HTML
      title: currentNote.title || 'Untitled Note',
      // Tags and values are updated via sidebar or autocomplete now
    });
  }, [currentNoteId, currentNote, editor, updateNote]);

  const handleTitleChange = useCallback(async (newTitle: string) => {
    if (!currentNoteId) return;
    // This updates the title in the store, which should reflect in currentNote.title
    useAppStore.setState(state => ({
      notes: {
        ...state.notes,
        [currentNoteId]: { ...state.notes[currentNoteId], title: newTitle }
      }
    }));
    // The actual save will happen with handleSave or auto-save logic
  }, [currentNoteId]);


  // Semantic element handlers (primarily for sidebar interactions now)
  const addTagToMetadata = useCallback(async (tagToAdd: string) => {
    if (!currentNoteId || !tagToAdd.trim()) return;
    const tag = tagToAdd.startsWith('#') || tagToAdd.startsWith('@') ? tagToAdd : `#${tagToAdd}`;
    if (currentNote?.tags.includes(tag)) return; // Avoid duplicates

    const updatedTags = [...(currentNote?.tags || []), tag];
    await updateNote(currentNoteId, { tags: updatedTags });
    setNewTag("");
  }, [currentNoteId, currentNote?.tags, updateNote]);

  const removeTagFromMetadata = useCallback(async (tagToRemove: string) => {
    if (!currentNoteId) return;
    const updatedTags = (currentNote?.tags || []).filter(tag => tag !== tagToRemove);
    await updateNote(currentNoteId, { tags: updatedTags });
  }, [currentNoteId, currentNote?.tags, updateNote]);

  const addValueToMetadata = useCallback(async () => {
    if (!currentNoteId || !newValueKey.trim() || !newValueValue.trim()) return;
    const updatedValues = { ...(currentNote?.values || {}), [newValueKey]: newValueValue };
    await updateNote(currentNoteId, { values: updatedValues });
    setNewValueKey("");
    setNewValueValue("");
  },[currentNoteId, currentNote?.values, newValueKey, newValueValue, updateNote]);

  const removeValueFromMetadata = useCallback(async (key: string) => {
    if (!currentNoteId) return;
    const updatedValues = { ...(currentNote?.values || {}) };
    delete updatedValues[key];
    await updateNote(currentNoteId, { values: updatedValues });
  }, [currentNoteId, currentNote?.values, updateNote]);

  const addFieldToMetadata = useCallback(async () => {
    if (!currentNoteId || !newFieldKey.trim() || !newFieldValue.trim()) return;
    const updatedFields = { ...(currentNote?.fields || {}), [newFieldKey]: newFieldValue };
    await updateNote(currentNoteId, { fields: updatedFields });
    setNewFieldKey("");
    setNewFieldValue("");
  }, [currentNoteId, currentNote?.fields, newFieldKey, newFieldValue, updateNote]);

  const removeFieldFromMetadata = useCallback(async (key: string) => {
    if (!currentNoteId) return;
    const updatedFields = { ...(currentNote?.fields || {}) };
    delete updatedFields[key];
    await updateNote(currentNoteId, { fields: updatedFields });
  }, [currentNoteId, currentNote?.fields, updateNote]);


  const applyTemplate = useCallback(async (templateId: string) => {
    if (!currentNoteId || !templateId) return;
    const template = templates[templateId];
    if (!template) return;

    let newContent = currentNote?.content || "";
    // Basic template content injection (can be more sophisticated)
    // For now, we'll primarily focus on metadata
    // newContent += `\n\n## ${template.name}\n`;
    // template.fields.forEach(field => {
    //   newContent += `\n**${field.name}:** \n`;
    // });

    const updatedTags = [...new Set([...(currentNote?.tags || []), ...template.defaultTags])];
    const updatedValues = { ...(currentNote?.values || {}), ...template.defaultValues };
    const updatedFields = { ...(currentNote?.fields || {}) };
    
    template.fields.forEach(field => {
      if (!updatedFields[field.name]) { // Only add if not already present
        updatedFields[field.name] = field.defaultValue || "";
      }
    });

    await updateNote(currentNoteId, {
      // content: newContent, // Optionally update content
      tags: updatedTags,
      values: updatedValues,
      fields: updatedFields
    });
    // editor?.commands.setContent(newContent); // Update editor if content changed
    setSelectedTemplate("");
  }, [currentNoteId, currentNote?.content, currentNote?.tags, currentNote?.values, currentNote?.fields, templates, updateNote, editor]);

  // This function is kept if we need manual insertion from elsewhere, but autocomplete handles editor insertion.
  const insertSemanticTagText = (tag: string) => {
    const tagText = tag.startsWith('#') || tag.startsWith('@') ? tag : `#${tag}`;
    // The Mention extension now handles the visual representation.
    // This function might be used if a button inserts a tag, not via autocomplete.
    editor?.chain().focus().insertContent(`${tagText} `).run();
    addTagToMetadata(tagText); // Also add to metadata
  };

  // Used for the sidebar tag suggestions, not the Tiptap autocomplete directly
  const getSuggestedTagsForSidebar = useCallback(() => {
    if (!ontology || !ontology.nodes) return [];
    const allTags = new Set<string>();
    Object.values(ontology.nodes).forEach(node => {
      if (node.label.startsWith('#') || node.label.startsWith('@')) {
        allTags.add(node.label);
      }
    });
    return Array.from(allTags);
  }, [ontology]);

  const handleAutoTag = async () => {
    if (!currentNoteId || !currentNote || !editor || !aiService.isAIEnabled()) {
      toast.error("Cannot auto-tag.", { description: "Ensure a note is selected, you are editing, and AI features are enabled." });
      return;
    }
    setIsAutoTagging(true);
    try {
      // Use editor.getText() for plain text content for better AI processing
      const plainTextContent = editor.getText();
      const suggestedTags = await aiService.getAutoTags(plainTextContent, currentNote.title, ontology);

      if (suggestedTags && suggestedTags.length > 0) {
        const newTags = [...new Set([...currentNote.tags, ...suggestedTags])]; // Merge and deduplicate
        await updateNote(currentNoteId, { tags: newTags });
        toast.success("AI auto-tagging complete!", { description: `${suggestedTags.length} new tags suggested.` });
      } else {
        toast.info("AI did not suggest any new tags.");
      }
    } catch (error: any) {
      toast.error("Auto-tagging failed.", { description: error.message });
    } finally {
      setIsAutoTagging(false);
    }
  };

  const handleSummarize = async () => {
    if (!currentNoteId || !currentNote || !editor || !aiService.isAIEnabled()) {
      toast.error("Cannot summarize.", { description: "Ensure a note is selected and AI features are enabled." });
      return;
    }
    setIsSummarizing(true);
    setCurrentSummary("");
    try {
      const plainTextContent = editor.getText();
      const summary = await aiService.getSummarization(plainTextContent, currentNote.title);
      if (summary) {
        setCurrentSummary(summary);
        setShowSummaryModal(true);
        toast.success("AI summarization complete!");
      } else {
        toast.info("AI could not generate a summary for this note.");
      }
    } catch (error: any) {
      toast.error("Summarization failed.", { description: error.message });
    } finally {
      setIsSummarizing(false);
    }
  };

  const insertSummaryIntoEditor = () => {
    if (editor && currentSummary) {
      // Escape HTML characters in the summary to ensure it's treated as plain text
      const escapeHtml = (unsafe: string) => {
        return unsafe
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      };
      const escapedSummary = escapeHtml(currentSummary);

      // Example: Insert summary at the beginning of the note, clearly marked.
      const currentContent = editor.getHTML();
      const summaryBlock = `<p><strong>AI Summary:</strong></p><p>${escapedSummary}</p><hr>`;
      editor.commands.setContent(summaryBlock + currentContent, true); // `true` to parse HTML
      setShowSummaryModal(false);
      toast.info("Summary inserted into note.");
      // Trigger save after insertion
      handleSave();
    }
  };


  if (!isEditing || !currentNoteId || !currentNote) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <h2 className="text-2xl font-semibold mb-2">No note selected</h2>
          <p>Select a note from the sidebar to start editing, or create a new one.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <Input
            value={currentNote.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="text-xl font-semibold border-none shadow-none p-0 h-auto bg-transparent"
            placeholder="Untitled Note"
            disabled={!isEditing}
          />
          
          <div className="flex items-center gap-2">
            {isEditing && (
              <Button variant="outline" size="sm" onClick={handleSave}>
                <Save size={16} /> <span className="ml-1 hidden sm:inline">Save</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => useAppStore.setState({ isEditing: !isEditing })}>
              {isEditing ? 'Cancel' : 'Edit'}
            </Button>
            {/* <Button variant="outline" size="sm">
              <Share size={16} />
            </Button>
            <Button variant="outline" size="sm">
              <Archive size={16} />
            </Button>
            <Button variant="outline" size="sm">
              <Pin size={16} />
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {/* Text formatting */}
          <Button
            variant={editor?.isActive('bold') ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold size={16} />
          </Button>
          <Button
            variant={editor?.isActive('italic') ? 'default' : 'outline'}
            size="sm"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic size={16} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const url = window.prompt('URL');
              if (url) {
                editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
              }
            }}
          >
            <LinkIcon size={16} />
          </Button>
          
          <div className="w-px h-6 bg-border mx-1" />
          
          {/* Semantic elements */}
          {/* The manual Tag/Person dialogs are less critical with autocomplete but can be kept for accessibility or alternative input */}
          {/* Example: Simple button to insert # symbol to trigger autocomplete if user is unaware */}
          {/* <Button variant="outline" size="sm" onClick={() => editor?.chain().focus().insertContent('#').run()}>
            <Hash size={16} />
          </Button> */}
          
          {isEditing && Object.keys(templates).length > 0 && (
            <>
              <div className="w-px h-6 bg-border mx-1" />
              <Select value={selectedTemplate} onValueChange={applyTemplate} disabled={!isEditing}>
                <SelectTrigger className="w-auto">
                  <SelectValue placeholder="Template" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(templates).map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          
          <div className="w-px h-6 bg-border mx-1" />

          {/* AI Features Buttons */}
          {userProfile?.preferences.aiEnabled && aiService.isAIEnabled() && isEditing && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoTag}
                disabled={isAutoTagging || !editor}
                title="AI Auto-tag"
              >
                {isAutoTagging ? <LoadingSpinner className="h-4 w-4" /> : <Sparkles size={16} />}
                <span className="ml-1 hidden sm:inline">Auto-tag</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSummarize}
                disabled={isSummarizing || !editor}
                title="AI Summarize"
              >
                {isSummarizing ? <LoadingSpinner className="h-4 w-4" /> : <FileText size={16} />}
                 <span className="ml-1 hidden sm:inline">Summarize</span>
              </Button>
              <div className="w-px h-6 bg-border mx-1" />
            </>
          )}
          
          {/* Metadata toggle can be part of a more general settings/info panel for the note */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMetadata(!showMetadata)}
          >
            <Settings size={16} />
            <span className="ml-1 hidden sm:inline">Info</span>
          </Button>
        </div>

        {/* Summary Modal */}
        {showSummaryModal && (
          <Dialog open={showSummaryModal} onOpenChange={setShowSummaryModal}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>AI Generated Summary</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] my-4">
                <p className="text-sm whitespace-pre-wrap">{currentSummary}</p>
              </ScrollArea>
              <DialogFooter className="gap-2 sm:justify-end">
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Close
                  </Button>
                </DialogClose>
                <Button type="button" onClick={insertSummaryIntoEditor} disabled={!editor || !isEditing}>
                  Insert into Note
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Display Tags from metadata - these are the "source of truth" */}
        {currentNote.tags && currentNote.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {currentNote.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="cursor-default">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto p-4">
        <EditorContent
          editor={editor}
          className="prose prose-sm dark:prose-invert max-w-none focus:outline-none h-full"
        />
      </div>

      {/* Metadata Sidebar (Info Panel) */}
      {/* Simplified for now, main interaction for tags/values is via autocomplete or dedicated inputs if needed */}
      <div
        className={`
          ${showMetadata ? 'w-72 p-4' : 'w-0 p-0'}
          border-l border-border transition-all duration-300 ease-in-out overflow-hidden
          bg-card text-card-foreground
        `}
      >
        <div className="p-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Basic Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <div className="mt-1">
                  <Badge variant={currentNote.status === 'published' ? 'default' : 'secondary'}>
                    {currentNote.status}
                  </Badge>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-medium text-muted-foreground">Created</label>
                <p className="text-sm">{new Date(currentNote.createdAt).toLocaleDateString()}</p>
              </div>
              
              <div>
                <label className="text-xs font-medium text-muted-foreground">Updated</label>
                <p className="text-sm">{new Date(currentNote.updatedAt).toLocaleDateString()}</p>
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                Tags
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" disabled={!isEditing}>
                      <Plus size={12} />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Tag</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-4">
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="#AI, @Person, etc."
                        onKeyDown={(e) => e.key === 'Enter' && addTagToMetadata(newTag)}
                      />
                      {/* Suggestion for sidebar input */}
                       <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                        {getSuggestedTagsForSidebar().filter(t => t.toLowerCase().includes(newTag.toLowerCase()) && !currentNote.tags.includes(t)).slice(0,5).map(suggested => (
                          <Button key={suggested} variant="outline" size="sm" onClick={() => addTagToMetadata(suggested)}>
                            {suggested}
                          </Button>
                        ))}
                      </div>
                      <Button onClick={() => addTagToMetadata(newTag)} className="w-full">
                        Add Tag
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {currentNote.tags.map((tag) => (
                  <Badge 
                    key={tag} 
                    variant="secondary" 
                    className={`${isEditing ? 'cursor-pointer hover:bg-destructive hover:text-destructive-foreground' : 'cursor-default'}`}
                    onClick={() => isEditing && removeTagFromMetadata(tag)}
                  >
                    {tag} {isEditing && '×'}
                  </Badge>
                ))}
                {currentNote.tags.length === 0 && (
                  <p className="text-xs text-muted-foreground">No tags</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Values */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                Values
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" disabled={!isEditing}>
                      <Plus size={12} />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Value</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-4">
                      <div>
                        <Label htmlFor="newValueKey">Key</Label>
                        <Input
                          id="newValueKey"
                          value={newValueKey}
                          onChange={(e) => setNewValueKey(e.target.value)}
                          placeholder="due, priority, status..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="newValueValue">Value</Label>
                        <Input
                          id="newValueValue"
                          value={newValueValue}
                          onChange={(e) => setNewValueValue(e.target.value)}
                          placeholder="2025-06-01, high, in-progress..."
                          onKeyDown={(e) => e.key === 'Enter' && addValueToMetadata()}
                        />
                      </div>
                      <Button onClick={addValueToMetadata} className="w-full">
                        Add Value
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(currentNote.values).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-sm bg-muted p-2 rounded">
                    <span><span className="font-medium">{key}:</span> {value}</span>
                    {isEditing && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeValueFromMetadata(key)}
                        className="h-6 w-6 p-0 text-destructive"
                      >
                        ×
                      </Button>
                    )}
                  </div>
                ))}
                {Object.keys(currentNote.values).length === 0 && (
                  <p className="text-xs text-muted-foreground">No values</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Fields (Template-defined) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Fields</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="space-y-2">
                {Object.entries(currentNote.fields).map(([key, value]) => (
                  <div key={key} className="bg-muted p-2 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{key}</span>
                       {isEditing && ( // Assuming fields are primarily managed by templates, but allow removal
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFieldFromMetadata(key)}
                          className="h-6 w-6 p-0 text-destructive"
                        >
                          ×
                        </Button>
                       )}
                    </div>
                    {/* Allow editing field values if isEditing */}
                    {isEditing ? (
                       <Input
                          value={value as string} // Assuming string for now
                          onChange={(e) => updateNote(currentNoteId, { fields: { ...currentNote.fields, [key]: e.target.value }})}
                          className="text-sm bg-transparent border-0 p-0 h-auto"
                       />
                    ) : (
                      <p className="text-sm text-muted-foreground">{value as string}</p>
                    )}
                  </div>
                ))}
                {Object.keys(currentNote.fields).length === 0 && (
                  <p className="text-xs text-muted-foreground">No template fields applied or filled.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Suggestion List Component (for Tiptap Mention)
interface SuggestionListProps {
  items: { id: string; label: string; trigger: string }[];
  command: (item: { id: string; label: string; trigger: string }) => void;
}

const SuggestionList = React.forwardRef<HTMLDivElement, SuggestionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  // @ts-ignore
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));


  return props.items.length > 0 ? (
    <Card className="p-1 shadow-xl border border-border bg-popover text-popover-foreground min-w-[150px]">
      <ScrollArea className="max-h-60">
        {props.items.map((item, index) => (
          <Button
            key={item.id}
            variant={index === selectedIndex ? 'default' : 'ghost'}
            className="w-full justify-start text-sm h-8 px-2 py-1"
            onClick={() => selectItem(index)}
          >
            {item.label}
          </Button>
        ))}
      </ScrollArea>
    </Card>
  ) : null;
});
SuggestionList.displayName = "SuggestionList";