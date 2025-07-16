import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FolderService } from './FolderService';
import { DBService } from './db';
import { Folder, Note } from '../../shared/types';

// Mock DBService
vi.mock('./db', () => ({
	DBService: {
		saveFolder: vi.fn(),
		getFolder: vi.fn(),
		getAllFolders: vi.fn(),
		deleteFolder: vi.fn(),
		getNote: vi.fn(),
		saveNote: vi.fn(),
	},
}));

// Mock uuidv4
const mockUuid = 'mock-uuid-1234';
vi.mock('uuid', () => ({
	v4: () => mockUuid,
}));

describe('FolderService', () => {
	let mockFolders: Folder[];
	let mockNotes: Note[];

	beforeEach(() => {
		vi.resetAllMocks();

		mockFolders = [
			{
				id: 'folder-root1',
				name: 'Root Folder 1',
				noteIds: ['note1'],
				children: ['folder-child1'],
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			{
				id: 'folder-child1',
				name: 'Child Folder 1',
				parentId: 'folder-root1',
				noteIds: ['note2'],
				children: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			{
				id: 'folder-root2',
				name: 'Root Folder 2',
				noteIds: [],
				children: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		];
		mockNotes = [
			{
				id: 'note1',
				title: 'Note 1',
				folderId: 'folder-root1',
				content: '',
				tags: [],
				values: {},
				fields: {},
				status: 'draft',
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			{
				id: 'note2',
				title: 'Note 2',
				folderId: 'folder-child1',
				content: '',
				tags: [],
				values: {},
				fields: {},
				status: 'draft',
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			{
				id: 'note3',
				title: 'Note 3 (unfiled)',
				content: '',
				tags: [],
				values: {},
				fields: {},
				status: 'draft',
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		];

		(DBService.getAllFolders as vi.Mock).mockResolvedValue([...mockFolders]);
		(DBService.getFolder as vi.Mock).mockImplementation(
			async (id: string) => mockFolders.find(f => f.id === id) || null
		);
		(DBService.saveFolder as vi.Mock).mockResolvedValue(undefined);
		(DBService.deleteFolder as vi.Mock).mockResolvedValue(undefined);
		(DBService.getNote as vi.Mock).mockImplementation(
			async (id: string) => mockNotes.find(n => n.id === id) || null
		);
		(DBService.saveNote as vi.Mock).mockResolvedValue(undefined);
	});

	describe('createFolder', () => {
		it('should create a new root folder', async () => {
			const folderName = 'New Root';
			const newFolder = await FolderService.createFolder(folderName);

			expect(DBService.saveFolder).toHaveBeenCalledTimes(1);
			const savedArg = (DBService.saveFolder as vi.Mock).mock
				.calls[0][0] as Folder;

			expect(savedArg.name).toBe(folderName);
			expect(savedArg.parentId).toBeUndefined();
			expect(savedArg.id).toBe(`folder-${mockUuid}`);
			expect(newFolder.name).toBe(folderName);
		});

		it('should create a new child folder and update parent', async () => {
			const parentId = 'folder-root1';
			const folderName = 'New Child';

			// Ensure parent folder is returned by getFolder mock
			(DBService.getFolder as vi.Mock).mockResolvedValueOnce(
				mockFolders.find(f => f.id === parentId)
			);

			const newFolder = await FolderService.createFolder(folderName, parentId);

			expect(DBService.saveFolder).toHaveBeenCalledTimes(2); // Once for new folder, once for parent update
			const newFolderArg = (DBService.saveFolder as vi.Mock).mock.calls.find(
				c => c[0].id === newFolder.id
			)![0] as Folder;
			const parentUpdateArg = (DBService.saveFolder as vi.Mock).mock.calls.find(
				c => c[0].id === parentId
			)![0] as Folder;

			expect(newFolderArg.name).toBe(folderName);
			expect(newFolderArg.parentId).toBe(parentId);
			expect(parentUpdateArg.children).toContain(newFolder.id);
			expect(newFolder.name).toBe(folderName);
		});
	});

	describe('updateFolder', () => {
		it('should update folder name', async () => {
			const folderId = 'folder-root1';
			const updates = { name: 'Updated Root Name' };
			(DBService.getFolder as vi.Mock).mockResolvedValueOnce(
				mockFolders.find(f => f.id === folderId)
			);

			await FolderService.updateFolder(folderId, updates);

			expect(DBService.saveFolder).toHaveBeenCalledTimes(1);
			const savedArg = (DBService.saveFolder as vi.Mock).mock
				.calls[0][0] as Folder;
			expect(savedArg.id).toBe(folderId);
			expect(savedArg.name).toBe('Updated Root Name');
		});

		it('should move folder to new parent and update old/new parents', async () => {
			const folderToMoveId = 'folder-child1'; // child of folder-root1
			const newParentId = 'folder-root2';

			// Mock getFolder calls: 1. folderToMove, 2. oldParent, 3. newParent
			(DBService.getFolder as vi.Mock)
				.mockResolvedValueOnce(mockFolders.find(f => f.id === folderToMoveId)!) // folder-child1
				.mockResolvedValueOnce(mockFolders.find(f => f.id === 'folder-root1')!) // old parent: folder-root1
				.mockResolvedValueOnce(mockFolders.find(f => f.id === newParentId)!); // new parent: folder-root2

			await FolderService.updateFolder(folderToMoveId, {
				parentId: newParentId,
			});

			expect(DBService.saveFolder).toHaveBeenCalledTimes(3); // folder, old parent, new parent

			const movedFolderCall = (DBService.saveFolder as vi.Mock).mock.calls.find(
				c => c[0].id === folderToMoveId
			)!;
			expect(movedFolderCall[0].parentId).toBe(newParentId);

			const oldParentCall = (DBService.saveFolder as vi.Mock).mock.calls.find(
				c => c[0].id === 'folder-root1'
			)!;
			expect(oldParentCall[0].children).not.toContain(folderToMoveId);

			const newParentCall = (DBService.saveFolder as vi.Mock).mock.calls.find(
				c => c[0].id === newParentId
			)!;
			expect(newParentCall[0].children).toContain(folderToMoveId);
		});
		it('should move folder to root', async () => {
			const folderToMoveId = 'folder-child1'; // child of folder-root1
			(DBService.getFolder as vi.Mock)
				.mockResolvedValueOnce(mockFolders.find(f => f.id === folderToMoveId)!) // folder-child1
				.mockResolvedValueOnce(mockFolders.find(f => f.id === 'folder-root1')!); // old parent: folder-root1

			await FolderService.updateFolder(folderToMoveId, { parentId: undefined });

			expect(DBService.saveFolder).toHaveBeenCalledTimes(2); // folder, old parent
			const movedFolderCall = (DBService.saveFolder as vi.Mock).mock.calls.find(
				c => c[0].id === folderToMoveId
			)!;
			expect(movedFolderCall[0].parentId).toBeUndefined();
		});
	});

	describe('deleteFolder', () => {
		it('should delete a folder, its children, and unassign notes', async () => {
			const folderIdToDelete = 'folder-root1';
			const childFolderId = 'folder-child1';
			const noteInRootId = 'note1';
			const noteInChildId = 'note2';

			// Setup mocks for recursive calls and note updates
			// For deleteFolder, it needs the map of all folders
			const foldersMap: { [id: string]: Folder } = {};
			mockFolders.forEach(f => (foldersMap[f.id] = f));

			// Mock getFolder for parent update if folderToDelete had a parent (not in this case)
			// Mock getNote and saveNote for unassigning notes
			(DBService.getNote as vi.Mock).mockImplementation(
				async (id: string) => mockNotes.find(n => n.id === id) || null
			);

			await FolderService.deleteFolder(folderIdToDelete, foldersMap);

			// DBService.deleteFolder called for root1 and child1
			expect(DBService.deleteFolder).toHaveBeenCalledWith(folderIdToDelete);
			expect(DBService.deleteFolder).toHaveBeenCalledWith(childFolderId);

			// DBService.saveNote called for note1 and note2 to unassign folderId
			expect(DBService.saveNote).toHaveBeenCalledWith(
				expect.objectContaining({ id: noteInRootId, folderId: undefined })
			);
			expect(DBService.saveNote).toHaveBeenCalledWith(
				expect.objectContaining({ id: noteInChildId, folderId: undefined })
			);
		});
	});

	describe('addNoteToFolder', () => {
		it('should add a note to a folder and update note folderId', async () => {
			const noteId = 'note3'; // Unfiled note
			const folderId = 'folder-root2';
			(DBService.getNote as vi.Mock).mockResolvedValueOnce(
				mockNotes.find(n => n.id === noteId)!
			);
			(DBService.getFolder as vi.Mock).mockResolvedValueOnce(
				mockFolders.find(f => f.id === folderId)!
			);

			await FolderService.addNoteToFolder(noteId, folderId);

			expect(DBService.saveNote).toHaveBeenCalledTimes(1);
			expect((DBService.saveNote as vi.Mock).mock.calls[0][0].folderId).toBe(
				folderId
			);

			expect(DBService.saveFolder).toHaveBeenCalledTimes(1);
			expect(
				(DBService.saveFolder as vi.Mock).mock.calls[0][0].noteIds
			).toContain(noteId);
		});

		it('should move a note from an old folder to a new folder', async () => {
			const noteId = 'note1'; // In folder-root1
			const oldFolderId = 'folder-root1';
			const newFolderId = 'folder-root2';

			// Mock sequence for getNote, getFolder (new), getFolder (old)
			(DBService.getNote as vi.Mock).mockResolvedValueOnce(
				mockNotes.find(n => n.id === noteId)!
			);
			(DBService.getFolder as vi.Mock)
				.mockResolvedValueOnce(mockFolders.find(f => f.id === newFolderId)!) // new folder
				.mockResolvedValueOnce(mockFolders.find(f => f.id === oldFolderId)!); // old folder

			await FolderService.addNoteToFolder(noteId, newFolderId);

			expect(DBService.saveNote).toHaveBeenCalledTimes(1);
			expect((DBService.saveNote as vi.Mock).mock.calls[0][0].folderId).toBe(
				newFolderId
			);

			// Save folder called for old and new folder
			expect(DBService.saveFolder).toHaveBeenCalledTimes(2);
			const oldFolderSaveCall = (
				DBService.saveFolder as vi.Mock
			).mock.calls.find(c => c[0].id === oldFolderId)!;
			expect(oldFolderSaveCall[0].noteIds).not.toContain(noteId);

			const newFolderSaveCall = (
				DBService.saveFolder as vi.Mock
			).mock.calls.find(c => c[0].id === newFolderId)!;
			expect(newFolderSaveCall[0].noteIds).toContain(noteId);
		});
	});

	describe('removeNoteFromFolder', () => {
		it('should remove a note from a folder and clear note folderId', async () => {
			const noteId = 'note1'; // In folder-root1
			const folderId = 'folder-root1';
			(DBService.getNote as vi.Mock).mockResolvedValueOnce(
				mockNotes.find(n => n.id === noteId)!
			);
			(DBService.getFolder as vi.Mock).mockResolvedValueOnce(
				mockFolders.find(f => f.id === folderId)!
			);

			await FolderService.removeNoteFromFolder(noteId, folderId);

			expect(DBService.saveNote).toHaveBeenCalledTimes(1);
			expect(
				(DBService.saveNote as vi.Mock).mock.calls[0][0].folderId
			).toBeUndefined();

			expect(DBService.saveFolder).toHaveBeenCalledTimes(1);
			expect(
				(DBService.saveFolder as vi.Mock).mock.calls[0][0].noteIds
			).not.toContain(noteId);
		});
	});

	describe('buildFolderTree', () => {
		it('should build a correct tree structure', () => {
			const tree = FolderService.buildFolderTree(mockFolders);
			expect(tree).toHaveLength(2); // Two root folders

			const root1 = tree.find(f => f.id === 'folder-root1');
			expect(root1).toBeDefined();
			expect(root1?.childrenNodes).toHaveLength(1);
			expect(root1?.childrenNodes?.[0].id).toBe('folder-child1');

			const root2 = tree.find(f => f.id === 'folder-root2');
			expect(root2).toBeDefined();
			expect(root2?.childrenNodes).toHaveLength(0);
		});
	});
});
