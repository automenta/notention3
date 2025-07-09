import { useState, useMemo } from "react";
import { Hash, Plus, Edit2, Trash2, ChevronRight, ChevronDown, Save, Sparkles, Wand2 } from "lucide-react"; // Added Sparkles, Wand2
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea"; // Added Textarea
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "./ui/dialog";
import { useAppStore } from "../store";
import { OntologyNode, OntologyTree } from "../../shared/types";
import { OntologyService } from "../services/ontology";
import { aiService } from "../services/AIService"; // Import AI Service
import { toast } from "sonner"; // For notifications
import { LoadingSpinner } from "./ui/loading-spinner"; // For loading state

export function OntologyEditor() {
  const { ontology, updateOntology, setOntology: setStoreOntology, userProfile } = useAppStore();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // AI Suggestions State
  const [isAISuggestionsDialogOpen, setIsAISuggestionsDialogOpen] = useState(false);
  const [aiSuggestionContext, setAISuggestionContext] = useState("");
  const [aiSuggestions, setAISuggestions] = useState<any[]>([]); // Type appropriately later
  const [isFetchingAISuggestions, setIsFetchingAISuggestions] = useState(false);


  // State for adding a new node
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newNodeParentId, setNewNodeParentId] = useState<string | undefined>();

  // State for editing an existing node
  const [editingNode, setEditingNode] = useState<OntologyNode | null>(null);
  const [editNodeLabel, setEditNodeLabel] = useState("");
  const [editNodeAttributes, setEditNodeAttributes] = useState<{[key: string]: string}>({});

  /* // Temporarily comment out handlers
  const handleOpenEditDialog = (node: OntologyNode) => {
    setEditingNode(node);
    setEditNodeLabel(node.label);
    setEditNodeAttributes(node.attributes || {});
  };

  const handleCloseEditDialog = () => {
    setEditingNode(null);
    setEditNodeLabel("");
    setEditNodeAttributes({});
  };

  const toggleExpanded = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const getChildNodes = useMemo(() => {
    return (parentId?: string): OntologyNode[] => {
      if (!ontology || !ontology.nodes) return [];
      return OntologyService.getChildNodes(ontology, parentId);
    };
  }, [ontology]);


  const handleAddNode = async () => {
    if (!newNodeLabel.trim()) return;

    const newNode = OntologyService.createNode(newNodeLabel, newNodeParentId);
    const newOntology = OntologyService.addNode(ontology, newNode);

    await updateOntology(newOntology); // Assumes updateOntology updates localforage via store
    setStoreOntology(newOntology); // Update Zustand store

    setNewNodeLabel("");
    setNewNodeParentId(undefined);
    setIsAddDialogOpen(false);
  };

  const handleDeleteNode = async (nodeId: string) => {
    const newOntology = OntologyService.removeNode(ontology, nodeId);
    await updateOntology(newOntology);
    setStoreOntology(newOntology);
  };

  const handleUpdateNode = async () => {
    if (!editingNode || !editNodeLabel.trim()) return;

    const updates: Partial<OntologyNode> = {
      label: editNodeLabel,
      attributes: editNodeAttributes
    };

    const newOntology = OntologyService.updateNode(ontology, editingNode.id, updates);
    await updateOntology(newOntology);
    setStoreOntology(newOntology);
    handleCloseEditDialog();
  };

  const handleAttributeChange = (key: string, value: string) => {
    setEditNodeAttributes(prev => ({...prev, [key]: value}));
  };

  const handleAddAttribute = () => {
    setEditNodeAttributes(prev => ({...prev, "":""})); // Add a new empty attribute
  }

  const handleRemoveAttribute = (key: string) => {
    setEditNodeAttributes(prev => {
      const newAttributes = {...prev};
      delete newAttributes[key];
      return newAttributes;
    });
  }

  const handleFetchAISuggestions = async () => {
    if (!aiService.isAIEnabled()) {
      toast.error("AI features are not enabled. Please check your settings.");
      return;
    }
    setIsFetchingAISuggestions(true);
    setAISuggestions([]); // Clear previous suggestions
    try {
      const suggestions = await aiService.getOntologySuggestions(ontology, aiSuggestionContext);
      if (suggestions && suggestions.length > 0) {
        setAISuggestions(suggestions);
        toast.success("AI suggestions received!");
      } else {
        toast.info("AI did not return any suggestions for the given context.");
      }
    } catch (error: any) {
      console.error("Error fetching AI ontology suggestions:", error);
      toast.error("Failed to get AI suggestions.", { description: error.message });
    } finally {
      setIsFetchingAISuggestions(false);
    }
  };

  const handleAddSuggestedNode = async (suggestedNode: { label: string, parentId?: string, attributes?: any }) => {
    // Basic implementation: adds the node. Does not handle complex relationships or attribute types yet.
    if (!suggestedNode.label) {
      toast.error("Suggested node is missing a label.");
      return;
    }
    try {
      const newNode = OntologyService.createNode(suggestedNode.label, suggestedNode.parentId, suggestedNode.attributes);
      const newOntology = OntologyService.addNode(ontology, newNode);
      await updateOntology(newOntology);
      setStoreOntology(newOntology);
      toast.success(`Added suggested concept: ${suggestedNode.label}`);
      // Remove the added suggestion from the list
      setAISuggestions(prev => prev.filter(s => s.label !== suggestedNode.label));
    } catch (error: any) {
      toast.error("Failed to add suggested node.", { description: error.message });
    }
  };
  */

  /*
  const renderNode = (node: OntologyNode, level: number = 0) => {
    const children = getChildNodes(node.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(node.id);

    return (
      <div key={node.id} className="mb-1">
        <div 
          className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
          style={{ paddingLeft: `${level * 16 + 8}px` }}
        >
          {hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => toggleExpanded(node.id)}
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </Button>
          ) : (
            <div className="w-6" />
          )}

          <Badge variant="outline" className="text-xs cursor-default">
            {node.label}
          </Badge>
          {node.attributes && Object.keys(node.attributes).length > 0 && (
            <Badge variant="secondary" className="text-xs ml-1 cursor-default">
              {Object.entries(node.attributes).map(([key, value]) => `${key}: ${value}`).join(', ')}
            </Badge>
          )}

          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => handleOpenEditDialog(node)}
            >
              <Edit2 size={12} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-destructive"
              onClick={() => handleDeleteNode(node.id)}
            >
              <Trash2 size={12} />
            </Button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };
  */

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Ontology</h2>
          <div className="flex items-center gap-2">
            {userProfile?.preferences.aiEnabled && aiService.isAIEnabled() && (
              <Dialog open={isAISuggestionsDialogOpen} onOpenChange={setIsAISuggestionsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Sparkles size={16} className="mr-2" /> AI Suggest
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>AI Ontology Suggestions</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label htmlFor="aiSuggestionContext" className="text-sm font-medium">
                        Context (Optional)
                      </label>
                      <Textarea
                        id="aiSuggestionContext"
                        value={aiSuggestionContext}
                        onChange={(e) => setAISuggestionContext(e.target.value)}
                        placeholder="Provide context like a note, a domain, or specific area of interest..."
                        className="min-h-[80px]"
                      />
                    </div>
                    <Button onClick={handleFetchAISuggestions} disabled={isFetchingAISuggestions} className="w-full">
                      {isFetchingAISuggestions ? (
                        <LoadingSpinner className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 size={16} className="mr-2" />
                      )}
                      Get Suggestions
                    </Button>
                    {aiSuggestions.length > 0 && (
                      <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                        <h3 className="text-sm font-medium">Suggestions:</h3>
                        {aiSuggestions.map((suggestion, index) => (
                          <Card key={index} className="p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold">{suggestion.label}</p>
                              <Button size="xs" onClick={() => handleAddSuggestedNode(suggestion)}>
                                <Plus size={12} className="mr-1"/> Add
                              </Button>
                            </div>
                            {suggestion.parentId && <p className="text-xs text-muted-foreground">Parent: {ontology.nodes[suggestion.parentId]?.label || suggestion.parentId}</p>}
                            {suggestion.attributes && <p className="text-xs text-muted-foreground">Attributes: {JSON.stringify(suggestion.attributes)}</p>}
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Close</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus size={16} /> Add Concept
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Concept</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <label htmlFor="newNodeLabel" className="text-sm font-medium">Label</label>
                  <Input
                    id="newNodeLabel"
                    value={newNodeLabel}
                    onChange={(e) => setNewNodeLabel(e.target.value)}
                    placeholder="e.g., AI, Project, Person"
                  />
                </div>
                
                <div>
                  <label htmlFor="newNodeParent" className="text-sm font-medium">Parent (optional)</label>
                  <select
                    id="newNodeParent"
                    value={newNodeParentId || ""}
                    onChange={(e) => setNewNodeParentId(e.target.value || undefined)}
                    className="w-full p-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md text-sm"
                  >
                    <option value="">Root level</option>
                    {Object.values(ontology.nodes).map(node => (
                      <option key={node.id} value={node.id}>
                        {node.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleAddNode}>
                  <Plus size={16} className="mr-2" /> Add Concept
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {(!ontology || Object.keys(ontology.nodes).length === 0) ? (
          <div className="text-center text-muted-foreground py-8">
            <Hash size={48} className="mx-auto mb-4 opacity-50" />
            <p>No concepts yet</p>
            <p className="text-sm mt-1">Create your first concept to organize your notes</p>
          </div>
        ) : (
          <div> {/* This div wraps the mapped nodes */}
            {ontology.rootIds?.map(rootId => {
              const node = ontology.nodes[rootId];
              return node ? renderNode(node) : null;
            })}
          </div> {/* This is the FIX: closing the div that wraps mapped nodes */}
        )}

        {/* Edit Node Dialog */}
        {editingNode && (
          <Dialog open={!!editingNode} onOpenChange={(open) => !open && handleCloseEditDialog()}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Concept: {editingNode.label}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label htmlFor="editNodeLabel" className="text-sm font-medium">Label</label>
                  <Input
                    id="editNodeLabel"
                    value={editNodeLabel}
                    onChange={(e) => setEditNodeLabel(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Attributes</label>
                  {Object.entries(editNodeAttributes).map(([key, value], index) => (
                    <div key={index} className="flex items-center gap-2 mt-1">
                      <Input
                        value={key}
                        onChange={(e) => {
                          const newKey = e.target.value;
                          const oldKey = Object.keys(editNodeAttributes)[index];
                          const {[oldKey]: _, ...rest} = editNodeAttributes;
                          setEditNodeAttributes({...rest, [newKey]: value});
                        }}
                        placeholder="Attribute Name"
                        className="flex-1"
                      />
                      <Input
                        value={value}
                        onChange={(e) => handleAttributeChange(key, e.target.value)}
                        placeholder="Attribute Value"
                        className="flex-1"
                      />
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveAttribute(key)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={handleAddAttribute} className="mt-2">
                    <Plus size={14} className="mr-1" /> Add Attribute
                  </Button>
                </div>
              </div>
              <DialogFooter>
                 <DialogClose asChild>
                  <Button variant="outline" onClick={handleCloseEditDialog}>Cancel</Button>
                </DialogClose>
                <Button onClick={handleUpdateNode}>
                  <Save size={16} className="mr-2" /> Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        {/* Ontology Info Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm">About Ontology</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>
              The ontology helps organize your notes with semantic structure. 
              Tags like #AI can have children like #MachineLearning and #NLP.
            </p>
            <p>
              Use # for topics (e.g. #AI) and @ for people (e.g. @JohnDoe).
              Relationships enable smart matching - searching for notes tagged with #AI will also find notes tagged with #NLP if #NLP is a child of #AI.
            </p>
            <p>
              You can define attributes for concepts, like `due:date` for a #Project, which can then be used in notes.
            </p>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}