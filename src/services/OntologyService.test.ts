import { describe, it, expect, beforeEach } from 'vitest';
import { OntologyService } from './ontology';
import { OntologyTree, OntologyNode } from '../../shared/types';

describe('OntologyService', () => {
  let baseOntology: OntologyTree;

  beforeEach(() => {
    // Basic ontology for testing
    const aiNode = OntologyService.createNode('AI');
    const mlNode = OntologyService.createNode('MachineLearning', aiNode.id);
    const nlpNode = OntologyService.createNode('NLP', aiNode.id);
    const deepLearningNode = OntologyService.createNode('DeepLearning', mlNode.id);
    const projectNode = OntologyService.createNode('Project');

    let ontology: OntologyTree = { nodes: {}, rootIds: [] };
    ontology = OntologyService.addNode(ontology, aiNode);
    ontology = OntologyService.addNode(ontology, mlNode);
    ontology = OntologyService.addNode(ontology, nlpNode);
    ontology = OntologyService.addNode(ontology, deepLearningNode);
    ontology = OntologyService.addNode(ontology, projectNode);
    baseOntology = ontology;
  });

  it('should create a new node correctly', () => {
    const node = OntologyService.createNode('TestNode', 'parent-123', { color: 'blue' });
    expect(node.label).toBe('#TestNode'); // Default adds #
    expect(node.parentId).toBe('parent-123');
    expect(node.attributes).toEqual({ color: 'blue' });
    expect(node.id).toContain('testnode-');
  });

  it('should create a new node with # or @ prefix if provided', () => {
    const nodeHash = OntologyService.createNode('#Topic');
    expect(nodeHash.label).toBe('#Topic');
    const nodeAt = OntologyService.createNode('@Person');
    expect(nodeAt.label).toBe('@Person');
  });

  it('should add a root node to the ontology', () => {
    const newNode = OntologyService.createNode('NewRoot');
    const updatedOntology = OntologyService.addNode(baseOntology, newNode);
    expect(updatedOntology.nodes[newNode.id]).toEqual(newNode);
    expect(updatedOntology.rootIds).toContain(newNode.id);
  });

  it('should add a child node to an existing parent', () => {
    const aiNode = Object.values(baseOntology.nodes).find(n => n.label === '#AI')!;
    const newChild = OntologyService.createNode('NewAIChild', aiNode.id);
    const updatedOntology = OntologyService.addNode(baseOntology, newChild);

    expect(updatedOntology.nodes[newChild.id]).toEqual(newChild);
    expect(updatedOntology.nodes[aiNode.id].children).toContain(newChild.id);
    expect(updatedOntology.rootIds).not.toContain(newChild.id);
  });

  it('should remove a node and its references', () => {
    const mlNode = Object.values(baseOntology.nodes).find(n => n.label === '#MachineLearning')!;
    const aiNode = Object.values(baseOntology.nodes).find(n => n.label === '#AI')!;
    const dlNode = Object.values(baseOntology.nodes).find(n => n.label === '#DeepLearning')!; // child of ML

    const updatedOntology = OntologyService.removeNode(baseOntology, mlNode.id);

    expect(updatedOntology.nodes[mlNode.id]).toBeUndefined();
    expect(updatedOntology.nodes[aiNode.id].children).not.toContain(mlNode.id);
    // Check if child of removed node (DLNode) is re-parented to ML's parent (AI)
    expect(updatedOntology.nodes[dlNode.id].parentId).toBe(aiNode.id);
    expect(updatedOntology.nodes[aiNode.id].children).toContain(dlNode.id);
  });

  it('should remove a root node and promote its children to root', () => {
    const aiNode = Object.values(baseOntology.nodes).find(n => n.label === '#AI')!;
    const mlNode = Object.values(baseOntology.nodes).find(n => n.label === '#MachineLearning')!;
    const nlpNode = Object.values(baseOntology.nodes).find(n => n.label === '#NLP')!;

    const updatedOntology = OntologyService.removeNode(baseOntology, aiNode.id);

    expect(updatedOntology.nodes[aiNode.id]).toBeUndefined();
    expect(updatedOntology.rootIds).not.toContain(aiNode.id);
    expect(updatedOntology.rootIds).toContain(mlNode.id);
    expect(updatedOntology.rootIds).toContain(nlpNode.id);
    expect(updatedOntology.nodes[mlNode.id].parentId).toBeUndefined();
    expect(updatedOntology.nodes[nlpNode.id].parentId).toBeUndefined();
  });

  it('should update a node', () => {
    const projectNode = Object.values(baseOntology.nodes).find(n => n.label === '#Project')!;
    const updates = { label: '#ProjectUpdated', attributes: { status: 'active' } };
    const updatedOntology = OntologyService.updateNode(baseOntology, projectNode.id, updates);

    expect(updatedOntology.nodes[projectNode.id].label).toBe('#ProjectUpdated');
    expect(updatedOntology.nodes[projectNode.id].attributes).toEqual({ status: 'active' });
  });

  it('should move a node to a new parent', () => {
    const nlpNode = Object.values(baseOntology.nodes).find(n => n.label === '#NLP')!; // child of #AI
    const projectNode = Object.values(baseOntology.nodes).find(n => n.label === '#Project')!; // root
    const aiNode = Object.values(baseOntology.nodes).find(n => n.label === '#AI')!;

    const updatedOntology = OntologyService.moveNode(baseOntology, nlpNode.id, projectNode.id);

    expect(updatedOntology.nodes[nlpNode.id].parentId).toBe(projectNode.id);
    expect(updatedOntology.nodes[projectNode.id].children).toContain(nlpNode.id);
    expect(updatedOntology.nodes[aiNode.id].children).not.toContain(nlpNode.id);
  });

   it('should move a node to root', () => {
    const mlNode = Object.values(baseOntology.nodes).find(n => n.label === '#MachineLearning')!; // child of #AI
    const aiNode = Object.values(baseOntology.nodes).find(n => n.label === '#AI')!;

    const updatedOntology = OntologyService.moveNode(baseOntology, mlNode.id, undefined); // Move to root

    expect(updatedOntology.nodes[mlNode.id].parentId).toBeUndefined();
    expect(updatedOntology.rootIds).toContain(mlNode.id);
    expect(updatedOntology.nodes[aiNode.id].children).not.toContain(mlNode.id);
  });


  it('should get semantic matches correctly', () => {
    const mlNode = Object.values(baseOntology.nodes).find(n => n.label === '#MachineLearning')!;
    const matches = OntologyService.getSemanticMatches(baseOntology, mlNode.label);

    expect(matches).toContain('#MachineLearning'); // Self
    expect(matches).toContain('#AI'); // Parent
    expect(matches).toContain('#DeepLearning'); // Child
    expect(matches).not.toContain('#NLP');
    expect(matches).not.toContain('#Project');
  });

  it('should get semantic matches for a root node', () => {
    const aiNode = Object.values(baseOntology.nodes).find(n => n.label === '#AI')!;
    const matches = OntologyService.getSemanticMatches(baseOntology, aiNode.label);

    expect(matches).toContain('#AI');
    expect(matches).toContain('#MachineLearning');
    expect(matches).toContain('#NLP');
    expect(matches).toContain('#DeepLearning'); // Grandchild
  });

  it('should return only the tag itself if not found in ontology for semantic matches', () => {
    const matches = OntologyService.getSemanticMatches(baseOntology, '#NonExistentTag');
    expect(matches).toEqual(['#NonExistentTag']);
  });

  it('should validate a correct ontology', () => {
    const validation = OntologyService.validate(baseOntology);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should detect circular references', () => {
    let circularOntology = JSON.parse(JSON.stringify(baseOntology)); // Deep clone
    const aiNodeId = Object.keys(circularOntology.nodes).find(k => circularOntology.nodes[k].label === '#AI')!;
    const mlNodeId = Object.keys(circularOntology.nodes).find(k => circularOntology.nodes[k].label === '#MachineLearning')!;
    // Make AI a child of ML (AI -> ML -> AI)
    circularOntology.nodes[aiNodeId].parentId = mlNodeId;
    circularOntology.nodes[mlNodeId].children = [...(circularOntology.nodes[mlNodeId].children || []), aiNodeId];

    // This specific circular check might be tricky with current hasCircularReference,
    // as it only checks upwards via parentId. A more robust check would traverse full graph.
    // For now, let's test a simple parent pointing to itself scenario if possible, or a chain.
    // A->B, B->A.  A.parentId = B, B.parentId = A.

    const nodeA = OntologyService.createNode('A');
    const nodeB = OntologyService.createNode('B', nodeA.id);
    let testCircular: OntologyTree = { nodes: {}, rootIds: [] };
    testCircular = OntologyService.addNode(testCircular, nodeA);
    testCircular = OntologyService.addNode(testCircular, nodeB);

    // Create circular dependency: A is child of B, B is child of A (which is already true via createNode)
    testCircular.nodes[nodeA.id].parentId = nodeB.id;
    // Need to update B's children if A is no longer root
    testCircular.rootIds = testCircular.rootIds.filter(id => id !== nodeA.id);
    if(testCircular.nodes[nodeB.id].children){
        testCircular.nodes[nodeB.id].children!.push(nodeA.id);
    } else {
        testCircular.nodes[nodeB.id].children = [nodeA.id];
    }

    // The current hasCircularReference checks parent chain, so A -> B, and B -> A (parent)
    // Test A: A.parentId = B. B.parentId = A.
    // When validating A, it goes A -> B -> A (circular)
    const validation = OntologyService.validate(testCircular);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(err => err.includes('Circular reference detected'))).toBe(true);
  });

  it('should detect orphaned nodes', () => {
    let orphanedOntology = JSON.parse(JSON.stringify(baseOntology));
    const mlNodeId = Object.keys(orphanedOntology.nodes).find(k => orphanedOntology.nodes[k].label === '#MachineLearning')!;
    orphanedOntology.nodes[mlNodeId].parentId = 'non-existent-parent';

    const validation = OntologyService.validate(orphanedOntology);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(err => err.includes('Orphaned node'))).toBe(true);
  });

  it('should correctly export and import ontology to/from JSON', () => {
    const jsonExport = OntologyService.exportToJSON(baseOntology);
    expect(typeof jsonExport).toBe('string');

    const importedOntology = OntologyService.importFromJSON(jsonExport);
    expect(importedOntology).toEqual(baseOntology);

    // Test invalid JSON
    expect(() => OntologyService.importFromJSON('invalid json')).toThrowError('Failed to parse ontology JSON');
    // Test invalid structure
    expect(() => OntologyService.importFromJSON('{"foo":"bar"}')).toThrowError('Invalid ontology structure');
  });

});
