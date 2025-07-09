import { useState, useMemo, useCallback } from "react";
import { Hash, Plus, Edit2, Trash2, ChevronRight, ChevronDown, Save, Sparkles, Wand2, GripVertical } from "lucide-react"; // Added Sparkles, Wand2, GripVertical
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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


  // Drag and Drop State
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null); // ID of the currently dragged item
  const activeNode = useMemo(() => activeId ? ontology.nodes[activeId as string] : null, [activeId, ontology.nodes]);


  // State for adding/editing node dialogs
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newNodeParentId, setNewNodeParentId] = useState<string | undefined>();

  // State for editing an existing node
  const [editingNode, setEditingNode] = useState<OntologyNode | null>(null);
  const [editNodeLabel, setEditNodeLabel] = useState("");
  const [editNodeAttributes, setEditNodeAttributes] = useState<{[key: string]: string}>({});

  // Handlers for node operations, AI suggestions etc.
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
    // Optimistically prepare the new ontology state for UI update
    const newOntologyState = OntologyService.addNode(ontology, newNode);

    try {
      await updateOntology(newOntologyState); // Attempt to save to DB via store action
      setStoreOntology(newOntologyState); // Update Zustand store state upon successful save

      setNewNodeLabel("");
      setNewNodeParentId(undefined);
      setIsAddDialogOpen(false);
      toast.success(`Concept "${newNode.label}" added successfully.`);
    } catch (error: any) {
      console.error("Failed to add concept:", error);
      toast.error("Failed to add concept.", { description: error.message || "Could not save to database." });
      // Do not clear inputs or close dialog on error, so user can retry or correct.
      // The store state (ontology) should also not be updated with newOntologyState if save failed.
      // The mocked setStoreOntology in test would need to be conditional or not called on error path.
      // However, the actual setStoreOntology is called by updateOntology on success in the real store.
      // Here, we ensure UI reflects that the operation was attempted but failed.
    }
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
    setEditNodeAttributes(prev => ({...prev, "":"-"})); // Add a new empty attribute
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

  // Recursive function to render nodes
  const renderNode = (node: OntologyNode, level: number = 0): JSX.Element => {
    const {
      attributes: dndAttributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: node.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      paddingLeft: `${level * 20 + 8}px`, // Indentation based on level
    };

    const children = getChildNodes(node.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(node.id);

    return (
      <div ref={setNodeRef} style={style} className="mb-1 bg-card group" {...dndAttributes}>
        <div 
          className={`flex items-center gap-1 p-2 rounded hover:bg-accent ${isDragging ? 'shadow-lg' : ''}`}
        >
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 cursor-grab group-hover:opacity-100 opacity-25" {...listeners}>
            <GripVertical size={14} />
          </Button>
          {hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => { e.stopPropagation(); toggleExpanded(node.id); }}
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </Button>
          ) : (
            <div className="w-6" /> // Placeholder for alignment
          )}

          <Badge variant="outline" className="text-xs cursor-default truncate max-w-xs">
            {node.label}
          </Badge>
          {node.attributes && Object.keys(node.attributes).length > 0 && (
            <Badge variant="secondary" className="text-xs ml-1 cursor-default truncate max-w-xs hidden sm:inline-block">
              {Object.entries(node.attributes).map(([key, value]) => `${key}: ${value}`).join(', ')}
            </Badge>
          )}

          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => { e.stopPropagation(); handleOpenEditDialog(node);}}
            >
              <Edit2 size={12} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-destructive"
              onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id);}}
            >
              <Trash2 size={12} />
            </Button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="pl-0"> {/* No extra padding here, parent div controls it */}
            {/* For SortableContext with children, ensure items are direct descendants or manage IDs carefully */}
            {/* This basic SortableContext might need adjustment for nested D&D if children are also sortable independently */}
            <SortableContext items={children.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {children.map(child => renderNode(child, level + 1))}
            </SortableContext>
          </div>
        )}
      </div>
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return; // No change or dropped on itself
    }

    const activeNodeId = active.id as string;
    const overNodeId = over.id as string; // This could be a node ID or a droppable area ID

    const activeNode = ontology.nodes[activeNodeId];
    const overNode = ontology.nodes[overNodeId]; // Might be undefined if `over.id` is not a node ID

    let newOntology = ontology;

    // Scenario 1: Reordering within the same parent (or root)
    // This is typically when `over.data.current.sortable.containerId` (if `over` is a sortable item)
    // is the same as `active.data.current.sortable.containerId`.
    // Or, if both `activeNode.parentId` and `overNode.parentId` are the same.

    const oldParentId = activeNode.parentId;
    const oldList = oldParentId ? ontology.nodes[oldParentId]?.children || [] : ontology.rootIds;
    const oldIndex = oldList.indexOf(activeNodeId);

    // Determine if it's a re-parenting operation or reordering
    // A simple heuristic: if `overNodeId` is a node, and we are dropping "onto" it,
    // it might mean making `activeNodeId` a child of `overNodeId`.
    // If `overNodeId` is a sibling (same parent), it's reordering.

    // For robust tree DnD, `over.data.current` might provide info about whether
    // it's a drop target for re-parenting or just a sortable item for reordering.
    // @dnd-kit/tree or custom logic would handle this more gracefully.
    // For now, let's assume basic reordering first, then consider re-parenting.

    // Attempt to find the parent of the 'over' node to determine if it's a sibling reorder
    let targetParentId = overNode?.parentId;
    let targetList = targetParentId ? ontology.nodes[targetParentId]?.children || [] : ontology.rootIds;
    let newIndex = targetList.indexOf(overNodeId);

    if (oldParentId === targetParentId) { // Reordering within the same list (siblings or root items)
      if (oldIndex !== -1 && newIndex !== -1) {
        newOntology = OntologyService.moveNode(ontology, activeNodeId, oldParentId, newIndex);
      }
    } else {
      // This is a potential re-parenting or moving to/from root
      // If `overNode` exists, we might be dropping ONTO it (making active a child of over)
      // Or, if `overNodeId` represents a drop zone between items of a different parent.
      // This part needs more sophisticated logic for a true tree DnD.
      // Let's assume for now we are dropping ONTO overNode, making activeNode its child.
      // A more complete solution would involve checking if `overNode` is a valid drop target
      // and potentially its position (e.g. above, below, or on the item).

      // Simplified re-parenting: make activeNode a child of overNodeId (if overNodeId is a node)
      // Or, if overNodeId is not a node (e.g. a generic drop area for root), make it root.
      if (overNode) { // Dropped onto another node, make it a child of overNode
        newOntology = OntologyService.moveNode(ontology, activeNodeId, overNodeId, (overNode.children || []).length); // Add to end of children
      } else {
        // This case is tricky. `over.id` might not be a node.
        // If `dnd-kit` is set up with droppable areas for "between items" or "root area",
        // `over.id` would represent that. Without that setup, this might not work as expected.
        // For a simple list-like reorder of roots, this might be okay if over.id is another root node.
        // Let's assume if overNode is not found, it's potentially a drop to root or invalid.
        // For now, if we can't determine a valid re-parenting or re-order, we do nothing.
        // A true tree DnD would check if `over.id` is a droppable container for root items.

        // Example: If we want to allow dropping to root, we'd need a root droppable area.
        // For now, only allow reordering within existing lists or dropping onto a node to make it a child.
        // If `overNode` is null, it means `over.id` was not a node.
        // This could be a drop on the root container.
        // Let's try to find the index in rootIds if over.id is a rootId
        const overIsRootIndex = ontology.rootIds.indexOf(overNodeId);
        if (overIsRootIndex !== -1 && activeNode.parentId !== undefined) { // Moving from child to root
            newOntology = OntologyService.moveNode(ontology, activeNodeId, undefined, overIsRootIndex);
        } else {
            console.warn("Drag and drop target is not a valid node or position for re-parenting in this simplified setup.");
            return; // Or handle specific drop zones
        }
      }
    }

    if (newOntology !== ontology) {
      updateOntology(newOntology); // Persist via store action (which should call DB)
      setStoreOntology(newOntology); // Update Zustand state
      toast.success(`Ontology item '${activeNode.label}' moved.`);
    }
  }, [ontology, updateOntology, setStoreOntology]);

  const handleExportOntology = () => {
    if (!ontology || Object.keys(ontology.nodes).length === 0) {
      toast.error("Ontology is empty. Nothing to export.");
      return;
    }
    try {
      const jsonString = OntologyService.exportToJSON(ontology);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `notention-ontology-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Ontology exported successfully!");
    } catch (error) {
      toast.error("Failed to export ontology.", { description: String(error) });
    }
  };

  const handleImportOntology = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonString = e.target?.result as string;
        const importedOntology = OntologyService.importFromJSON(jsonString);
        // Validate the imported ontology (OntologyService.validate could be used if more checks are needed)
        if (!importedOntology || !importedOntology.nodes || !importedOntology.rootIds) {
          throw new Error("Invalid ontology file structure.");
        }

        // Optional: Confirm overwrite if current ontology is not empty
        if (Object.keys(ontology.nodes).length > 0) {
          if (!window.confirm("This will replace your current ontology. Are you sure you want to proceed?")) {
            // Reset file input so the same file can be selected again if needed
            if (event.target) event.target.value = "";
            return;
          }
        }

        await updateOntology(importedOntology); // This should save to DB via store action
        setStoreOntology(importedOntology); // Update store state
        toast.success("Ontology imported successfully!");
      } catch (error) {
        toast.error("Failed to import ontology.", { description: String(error) });
      } finally {
        // Reset file input so the same file can be selected again if needed
        if (event.target) event.target.value = "";
      }
    };
    reader.readAsText(file);
  };


  return (
    <ScrollArea className="h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
      </DndContext>
    </ScrollArea>
  );
}