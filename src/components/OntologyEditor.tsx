import { useState } from "react";
import { Hash, Plus, Edit2, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { useAppStore } from "../store";
import { OntologyNode } from "../../shared/types";

export function OntologyEditor() {
  const { ontology, updateOntology } = useAppStore();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newNodeParent, setNewNodeParent] = useState<string | undefined>();

  const toggleExpanded = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const getChildNodes = (parentId?: string) => {
    return Object.values(ontology.nodes).filter(node => node.parentId === parentId);
  };

  const addNode = async () => {
    if (!newNodeLabel.trim()) return;

    const nodeId = newNodeLabel.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const newNode: OntologyNode = {
      id: nodeId,
      label: newNodeLabel.startsWith('#') || newNodeLabel.startsWith('@') 
        ? newNodeLabel 
        : `#${newNodeLabel}`,
      parentId: newNodeParent,
    };

    const updatedOntology = {
      ...ontology,
      nodes: {
        ...ontology.nodes,
        [nodeId]: newNode,
      },
      rootIds: newNodeParent 
        ? ontology.rootIds 
        : [...ontology.rootIds, nodeId],
    };

    // Update parent's children
    if (newNodeParent && ontology.nodes[newNodeParent]) {
      const parent = ontology.nodes[newNodeParent];
      updatedOntology.nodes[newNodeParent] = {
        ...parent,
        children: [...(parent.children || []), nodeId],
      };
    }

    await updateOntology(updatedOntology);
    setNewNodeLabel("");
    setNewNodeParent(undefined);
  };

  const deleteNode = async (nodeId: string) => {
    const node = ontology.nodes[nodeId];
    if (!node) return;

    const updatedNodes = { ...ontology.nodes };
    delete updatedNodes[nodeId];

    // Remove from parent's children
    if (node.parentId && updatedNodes[node.parentId]) {
      const parent = updatedNodes[node.parentId];
      updatedNodes[node.parentId] = {
        ...parent,
        children: (parent.children || []).filter(id => id !== nodeId),
      };
    }

    // Remove from root IDs
    const updatedRootIds = ontology.rootIds.filter(id => id !== nodeId);

    // Move children to parent or root
    const children = getChildNodes(nodeId);
    children.forEach(child => {
      updatedNodes[child.id] = {
        ...child,
        parentId: node.parentId,
      };
      
      if (!node.parentId) {
        updatedRootIds.push(child.id);
      } else if (updatedNodes[node.parentId]) {
        const parent = updatedNodes[node.parentId];
        updatedNodes[node.parentId] = {
          ...parent,
          children: [...(parent.children || []), child.id],
        };
      }
    });

    await updateOntology({
      nodes: updatedNodes,
      rootIds: updatedRootIds,
    });
  };

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

          <Badge variant="outline" className="text-xs">
            {node.label}
          </Badge>

          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setEditingNode(node.id)}
            >
              <Edit2 size={12} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-destructive"
              onClick={() => deleteNode(node.id)}
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

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Ontology</h2>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus size={16} />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Concept</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Label</label>
                  <Input
                    value={newNodeLabel}
                    onChange={(e) => setNewNodeLabel(e.target.value)}
                    placeholder="e.g., AI, Project, Person"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Parent (optional)</label>
                  <select
                    value={newNodeParent || ""}
                    onChange={(e) => setNewNodeParent(e.target.value || undefined)}
                    className="w-full p-2 border border-border rounded-md"
                  >
                    <option value="">Root level</option>
                    {Object.values(ontology.nodes).map(node => (
                      <option key={node.id} value={node.id}>
                        {node.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <Button onClick={addNode} className="w-full">
                  Add Concept
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {Object.keys(ontology.nodes).length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Hash size={48} className="mx-auto mb-4 opacity-50" />
            <p>No concepts yet</p>
            <p className="text-sm mt-1">Create your first concept to organize your notes</p>
          </div>
        ) : (
          <div>
            {ontology.rootIds.map(rootId => {
              const node = ontology.nodes[rootId];
              return node ? renderNode(node) : null;
            })}
          </div>
        )}

        {/* Default concepts info */}
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
              Use # for topics and @ for people. Relationships enable smart 
              matching - searching #AI will also find #NLP notes.
            </p>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}