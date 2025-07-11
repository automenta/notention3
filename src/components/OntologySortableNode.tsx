import { useCallback, useMemo } from "react";
import { ChevronDown, ChevronRight, Edit2, GripVertical, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { OntologyNode, OntologyTree } from "../../shared/types";
import { OntologyService } from "../services/ontology"; // Assuming OntologyService is needed for getChildNodes

interface OntologySortableNodeProps {
  node: OntologyNode;
  level: number;
  toggleExpanded: (nodeId: string) => void;
  handleOpenEditDialog: (node: OntologyNode) => void;
  handleDeleteNode: (nodeId: string) => void;
  ontology: OntologyTree; // Pass ontology for getChildNodes
  expandedNodes: Set<string>; // Pass expandedNodes for state
}

export function OntologySortableNode({
  node,
  level,
  toggleExpanded,
  handleOpenEditDialog,
  handleDeleteNode,
  ontology,
  expandedNodes,
}: OntologySortableNodeProps) {
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

  // Re-define getChildNodes locally or pass it down if it's a memoized function from parent
  const getChildNodes = useCallback((parentId?: string): OntologyNode[] => {
    if (!ontology || !ontology.nodes) return [];
    return OntologyService.getChildNodes(ontology, parentId);
  }, [ontology]);

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
          <SortableContext items={children.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {children.map(child => (
              <OntologySortableNode
                key={child.id}
                node={child}
                level={level + 1}
                toggleExpanded={toggleExpanded}
                handleOpenEditDialog={handleOpenEditDialog}
                handleDeleteNode={handleDeleteNode}
                ontology={ontology}
                expandedNodes={expandedNodes}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
}