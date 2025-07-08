import { OntologyTree, OntologyNode } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

export class OntologyService {
  /**
   * Create a new ontology node
   */
  static createNode(
    label: string,
    parentId?: string,
    attributes?: { [key: string]: string }
  ): OntologyNode {
    const id = label.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + uuidv4().slice(0, 8);

    return {
      id,
      label: label.startsWith('#') || label.startsWith('@') ? label : `#${label}`,
      parentId,
      attributes,
      children: []
    };
  }

  /**
   * Add a node to the ontology tree
   */
  static addNode(
    ontology: OntologyTree,
    node: OntologyNode
  ): OntologyTree {
    const updatedNodes = { ...ontology.nodes, [node.id]: node };
    let updatedRootIds = [...ontology.rootIds];

    // If node has a parent, add it to parent's children
    if (node.parentId && updatedNodes[node.parentId]) {
      const parent = updatedNodes[node.parentId];
      updatedNodes[node.parentId] = {
        ...parent,
        children: [...(parent.children || []), node.id]
      };
    } else {
      // Add to root level
      updatedRootIds.push(node.id);
    }

    return {
      nodes: updatedNodes,
      rootIds: updatedRootIds
    };
  }

  /**
   * Remove a node from the ontology tree
   */
  static removeNode(
    ontology: OntologyTree,
    nodeId: string
  ): OntologyTree {
    const node = ontology.nodes[nodeId];
    if (!node) return ontology;

    const updatedNodes = { ...ontology.nodes };
    delete updatedNodes[nodeId];

    // Remove from parent's children
    if (node.parentId && updatedNodes[node.parentId]) {
      const parent = updatedNodes[node.parentId];
      updatedNodes[node.parentId] = {
        ...parent,
        children: (parent.children || []).filter(id => id !== nodeId)
      };
    }

    // Remove from root IDs
    let updatedRootIds = ontology.rootIds.filter(id => id !== nodeId);

    // Move children to parent or root
    const children = this.getChildNodes(ontology, nodeId);
    children.forEach(child => {
      updatedNodes[child.id] = {
        ...child,
        parentId: node.parentId
      };

      if (!node.parentId) {
        updatedRootIds.push(child.id);
      } else if (updatedNodes[node.parentId]) {
        const parent = updatedNodes[node.parentId];
        updatedNodes[node.parentId] = {
          ...parent,
          children: [...(parent.children || []), child.id]
        };
      }
    });

    return {
      nodes: updatedNodes,
      rootIds: updatedRootIds
    };
  }

  /**
   * Update a node in the ontology tree
   */
  static updateNode(
    ontology: OntologyTree,
    nodeId: string,
    updates: Partial<OntologyNode>
  ): OntologyTree {
    const node = ontology.nodes[nodeId];
    if (!node) return ontology;

    const updatedNodes = {
      ...ontology.nodes,
      [nodeId]: { ...node, ...updates }
    };

    return {
      ...ontology,
      nodes: updatedNodes
    };
  }

  /**
   * Move a node to a new parent
   */
  static moveNode(
    ontology: OntologyTree,
    nodeId: string,
    newParentId?: string,
    position?: number
  ): OntologyTree {
    const node = ontology.nodes[nodeId];
    if (!node) return ontology;

    const updatedNodes = { ...ontology.nodes };
    let updatedRootIds = [...ontology.rootIds];

    // Remove from old parent
    if (node.parentId && updatedNodes[node.parentId]) {
      const oldParent = updatedNodes[node.parentId];
      updatedNodes[node.parentId] = {
        ...oldParent,
        children: (oldParent.children || []).filter(id => id !== nodeId)
      };
    } else {
      // Remove from root
      updatedRootIds = updatedRootIds.filter(id => id !== nodeId);
    }

    // Add to new parent
    updatedNodes[nodeId] = { ...node, parentId: newParentId };

    if (newParentId && updatedNodes[newParentId]) {
      const newParent = updatedNodes[newParentId];
      const children = [...(newParent.children || [])];

      if (position !== undefined && position >= 0 && position <= children.length) {
        children.splice(position, 0, nodeId);
      } else {
        children.push(nodeId);
      }

      updatedNodes[newParentId] = {
        ...newParent,
        children
      };
    } else {
      // Add to root
      if (position !== undefined && position >= 0 && position <= updatedRootIds.length) {
        updatedRootIds.splice(position, 0, nodeId);
      } else {
        updatedRootIds.push(nodeId);
      }
    }

    return {
      nodes: updatedNodes,
      rootIds: updatedRootIds
    };
  }

  /**
   * Get child nodes of a parent
   */
  static getChildNodes(
    ontology: OntologyTree,
    parentId?: string
  ): OntologyNode[] {
    if (parentId) {
      const parent = ontology.nodes[parentId];
      if (!parent || !parent.children) return [];

      return parent.children
        .map(childId => ontology.nodes[childId])
        .filter(Boolean);
    }

    // Return root nodes
    return ontology.rootIds
      .map(rootId => ontology.nodes[rootId])
      .filter(Boolean);
  }

  /**
   * Get all descendants of a node
   */
  static getDescendants(
    ontology: OntologyTree,
    nodeId: string
  ): OntologyNode[] {
    const descendants: OntologyNode[] = [];
    const children = this.getChildNodes(ontology, nodeId);

    for (const child of children) {
      descendants.push(child);
      descendants.push(...this.getDescendants(ontology, child.id));
    }

    return descendants;
  }

  /**
   * Get all ancestors of a node
   */
  static getAncestors(
    ontology: OntologyTree,
    nodeId: string
  ): OntologyNode[] {
    const ancestors: OntologyNode[] = [];
    const node = ontology.nodes[nodeId];

    if (node && node.parentId) {
      const parent = ontology.nodes[node.parentId];
      if (parent) {
        ancestors.push(parent);
        ancestors.push(...this.getAncestors(ontology, parent.id));
      }
    }

    return ancestors;
  }

  /**
   * Find nodes by label pattern
   */
  static findNodes(
    ontology: OntologyTree,
    pattern: string
  ): OntologyNode[] {
    const lowercasePattern = pattern.toLowerCase();

    return Object.values(ontology.nodes).filter(node =>
      node.label.toLowerCase().includes(lowercasePattern)
    );
  }

  /**
   * Get semantic matches for a tag (including hierarchical relationships)
   */
  static getSemanticMatches(
    ontology: OntologyTree,
    tag: string
  ): string[] {
    const matches = new Set<string>([tag]);

    // Find the node for this tag
    const node = Object.values(ontology.nodes).find(n => n.label === tag);
    if (!node) return [tag];

    // Add ancestors (parent concepts)
    const ancestors = this.getAncestors(ontology, node.id);
    ancestors.forEach(ancestor => matches.add(ancestor.label));

    // Add descendants (child concepts)
    const descendants = this.getDescendants(ontology, node.id);
    descendants.forEach(descendant => matches.add(descendant.label));

    return Array.from(matches);
  }

  /**
   * Validate ontology structure
   */
  static validate(ontology: OntologyTree): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for circular references
    for (const nodeId of Object.keys(ontology.nodes)) {
      if (this.hasCircularReference(ontology, nodeId)) {
        errors.push(`Circular reference detected for node: ${nodeId}`);
      }
    }

    // Check for orphaned nodes
    for (const node of Object.values(ontology.nodes)) {
      if (node.parentId && !ontology.nodes[node.parentId]) {
        errors.push(`Orphaned node: ${node.id} references non-existent parent: ${node.parentId}`);
      }
    }

    // Check root IDs exist
    for (const rootId of ontology.rootIds) {
      if (!ontology.nodes[rootId]) {
        errors.push(`Root ID references non-existent node: ${rootId}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check for circular reference starting from a node
   */
  private static hasCircularReference(
    ontology: OntologyTree,
    nodeId: string,
    visited: Set<string> = new Set()
  ): boolean {
    if (visited.has(nodeId)) return true;

    visited.add(nodeId);
    const node = ontology.nodes[nodeId];

    if (node && node.parentId) {
      return this.hasCircularReference(ontology, node.parentId, visited);
    }

    return false;
  }

  /**
   * Export ontology to JSON
   */
  static exportToJSON(ontology: OntologyTree): string {
    return JSON.stringify(ontology, null, 2);
  }

  /**
   * Import ontology from JSON
   */
  static importFromJSON(json: string): OntologyTree {
    try {
      const parsed = JSON.parse(json);

      // Validate structure
      if (!parsed.nodes || !parsed.rootIds) {
        throw new Error('Invalid ontology structure');
      }

      return parsed as OntologyTree;
    } catch (error) {
      throw new Error(`Failed to parse ontology JSON: ${error}`);
    }
  }
}
