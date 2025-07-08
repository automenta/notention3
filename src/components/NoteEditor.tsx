import { useEffect, useState, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Save, Share, Archive, Pin, Bold, Italic, Link as LinkIcon, Hash, AtSign, Plus, Settings } from "lucide-react";
import { useAppStore } from "../store";

export function NoteEditor() {
  const { 
    currentNoteId, 
    notes, 
    editorContent, 
    setEditorContent, 
    updateNote,
    isEditing,
    ontology,
    templates
  } = useAppStore();

  const currentNote = currentNoteId ? notes[currentNoteId] : null;
  const [showMetadata, setShowMetadata] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [newValueKey, setNewValueKey] = useState("");
  const [newValueValue, setNewValueValue] = useState("");
  const [newFieldKey, setNewFieldKey] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
      }),
      Placeholder.configure({
        placeholder: 'Start writing your note...',
      }),
      Highlight.configure({
        multicolor: true,
      }),
    ],
    content: editorContent,
    onUpdate: ({ editor }) => {
      setEditorContent(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && currentNote) {
      editor.commands.setContent(currentNote.content);
    }
  }, [editor, currentNote]);

  const handleSave = async () => {
    if (!currentNoteId || !currentNote) return;
    
    await updateNote(currentNoteId, {
      content: editorContent,
      title: currentNote.title || 'Untitled Note',
    });
  };

  const handleTitleChange = async (newTitle: string) => {
    if (!currentNoteId) return;
    await updateNote(currentNoteId, { title: newTitle });
  };

  // Semantic element handlers
  const addTag = async () => {
    if (!currentNoteId || !newTag.trim()) return;
    const tag = newTag.startsWith('#') ? newTag : `#${newTag}`;
    const updatedTags = [...(currentNote?.tags || []), tag];
    await updateNote(currentNoteId, { tags: updatedTags });
    setNewTag("");
  };

  const removeTag = async (tagToRemove: string) => {
    if (!currentNoteId) return;
    const updatedTags = (currentNote?.tags || []).filter(tag => tag !== tagToRemove);
    await updateNote(currentNoteId, { tags: updatedTags });
  };

  const addValue = async () => {
    if (!currentNoteId || !newValueKey.trim() || !newValueValue.trim()) return;
    const updatedValues = { ...(currentNote?.values || {}), [newValueKey]: newValueValue };
    await updateNote(currentNoteId, { values: updatedValues });
    setNewValueKey("");
    setNewValueValue("");
  };

  const removeValue = async (key: string) => {
    if (!currentNoteId) return;
    const updatedValues = { ...(currentNote?.values || {}) };
    delete updatedValues[key];
    await updateNote(currentNoteId, { values: updatedValues });
  };

  const addField = async () => {
    if (!currentNoteId || !newFieldKey.trim() || !newFieldValue.trim()) return;
    const updatedFields = { ...(currentNote?.fields || {}), [newFieldKey]: newFieldValue };
    await updateNote(currentNoteId, { fields: updatedFields });
    setNewFieldKey("");
    setNewFieldValue("");
  };

  const removeField = async (key: string) => {
    if (!currentNoteId) return;
    const updatedFields = { ...(currentNote?.fields || {}) };
    delete updatedFields[key];
    await updateNote(currentNoteId, { fields: updatedFields });
  };

  const applyTemplate = async (templateId: string) => {
    if (!currentNoteId || !templateId) return;
    const template = templates[templateId];
    if (!template) return;

    const updatedTags = [...(currentNote?.tags || []), ...template.defaultTags];
    const updatedValues = { ...(currentNote?.values || {}), ...template.defaultValues };
    const updatedFields = { ...(currentNote?.fields || {}) };
    
    // Initialize template fields with empty values
    template.fields.forEach(field => {
      if (!updatedFields[field.name]) {
        updatedFields[field.name] = field.defaultValue || "";
      }
    });

    await updateNote(currentNoteId, {
      tags: updatedTags,
      values: updatedValues,
      fields: updatedFields
    });
    setSelectedTemplate("");
  };

  const insertSemanticTag = (tag: string) => {
    const tagText = tag.startsWith('#') || tag.startsWith('@') ? tag : `#${tag}`;
    editor?.chain().focus().insertContent(`<span class="semantic-tag bg-primary/10 text-primary px-2 py-1 rounded text-sm font-medium">${tagText}</span> `).run();
  };

  const getSuggestedTags = () => {
    const allTags = new Set<string>();
    Object.values(ontology.nodes).forEach(node => {
      if (node.label.startsWith('#') || node.label.startsWith('@')) {
        allTags.add(node.label);
      }
    });
    return Array.from(allTags);
  };

  if (!currentNote) {
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
          />
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSave}>
              <Save size={16} />
            </Button>
            <Button variant="outline" size="sm">
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
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Hash size={16} />
                <span className="ml-1 hidden sm:inline">Tag</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Insert Semantic Tag</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Tag Name</Label>
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="AI, Project, Person..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const tag = newTag.startsWith('#') || newTag.startsWith('@') ? newTag : `#${newTag}`;
                        insertSemanticTag(tag);
                        addTag();
                      }
                    }}
                  />
                </div>
                
                {getSuggestedTags().length > 0 && (
                  <div>
                    <Label>Suggested Tags</Label>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {getSuggestedTags().slice(0, 10).map((tag) => (
                        <Button
                          key={tag}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            insertSemanticTag(tag);
                            setNewTag(tag);
                            addTag();
                          }}
                        >
                          {tag}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                
                <Button 
                  onClick={() => {
                    const tag = newTag.startsWith('#') || newTag.startsWith('@') ? newTag : `#${newTag}`;
                    insertSemanticTag(tag);
                    addTag();
                  }}
                  className="w-full"
                >
                  Insert Tag
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <AtSign size={16} />
                <span className="ml-1 hidden sm:inline">Person</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Insert Person Tag</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Person Name</Label>
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Alice, Bob, Charlie..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const tag = `@${newTag}`;
                        insertSemanticTag(tag);
                        addTag();
                      }
                    }}
                  />
                </div>
                <Button 
                  onClick={() => {
                    const tag = `@${newTag}`;
                    insertSemanticTag(tag);
                    addTag();
                  }}
                  className="w-full"
                >
                  Insert Person
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          {Object.keys(templates).length > 0 && (
            <>
              <div className="w-px h-6 bg-border mx-1" />
              <Select value={selectedTemplate} onValueChange={applyTemplate}>
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
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMetadata(!showMetadata)}
          >
            <Settings size={16} />
            <span className="ml-1 hidden sm:inline">Metadata</span>
          </Button>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {currentNote.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <EditorContent 
            editor={editor} 
            className="prose prose-sm max-w-none focus-within:outline-none"
          />
        </div>
      </div>

      {/* Metadata Sidebar */}
      <div className={`${showMetadata ? 'w-80' : 'w-0 overflow-hidden'} border-l border-border transition-all duration-200 lg:w-80`}>
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
                    <Button size="sm" variant="outline">
                      <Plus size={12} />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Tag</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="#AI, @Person, etc."
                        onKeyDown={(e) => e.key === 'Enter' && addTag()}
                      />
                      <Button onClick={addTag} className="w-full">
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
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeTag(tag)}
                  >
                    {tag} ×
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
                    <Button size="sm" variant="outline">
                      <Plus size={12} />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Value</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label>Key</Label>
                        <Input
                          value={newValueKey}
                          onChange={(e) => setNewValueKey(e.target.value)}
                          placeholder="due, priority, status..."
                        />
                      </div>
                      <div>
                        <Label>Value</Label>
                        <Input
                          value={newValueValue}
                          onChange={(e) => setNewValueValue(e.target.value)}
                          placeholder="2025-06-01, high, in-progress..."
                          onKeyDown={(e) => e.key === 'Enter' && addValue()}
                        />
                      </div>
                      <Button onClick={addValue} className="w-full">
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
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeValue(key)}
                      className="h-6 w-6 p-0 text-destructive"
                    >
                      ×
                    </Button>
                  </div>
                ))}
                {Object.keys(currentNote.values).length === 0 && (
                  <p className="text-xs text-muted-foreground">No values</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Fields */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                Fields
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Plus size={12} />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Field</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label>Field Name</Label>
                        <Input
                          value={newFieldKey}
                          onChange={(e) => setNewFieldKey(e.target.value)}
                          placeholder="Status, Attendees, Action Items..."
                        />
                      </div>
                      <div>
                        <Label>Field Value</Label>
                        <Textarea
                          value={newFieldValue}
                          onChange={(e) => setNewFieldValue(e.target.value)}
                          placeholder="Enter field value..."
                        />
                      </div>
                      <Button onClick={addField} className="w-full">
                        Add Field
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(currentNote.fields).map(([key, value]) => (
                  <div key={key} className="bg-muted p-2 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{key}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeField(key)}
                        className="h-6 w-6 p-0 text-destructive"
                      >
                        ×
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{value}</p>
                  </div>
                ))}
                {Object.keys(currentNote.fields).length === 0 && (
                  <p className="text-xs text-muted-foreground">No fields</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}