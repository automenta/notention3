import { NodeViewWrapper } from '@tiptap/react';
import { Badge } from './ui/badge';

interface SemanticTagComponentProps {
  node: {
    attrs: {
      tag: string;
    };
  };
  updateAttributes: (attrs: any) => void;
  selected: boolean;
}

export function SemanticTagComponent({ node, selected }: SemanticTagComponentProps) {
  const { tag } = node.attrs;

  return (
    <NodeViewWrapper 
      as="span" 
      className={`inline-block ${selected ? 'ring-2 ring-primary' : ''}`}
    >
      <Badge 
        variant="secondary" 
        className="text-xs mx-1 cursor-pointer hover:bg-primary/10"
      >
        {tag}
      </Badge>
    </NodeViewWrapper>
  );
}