import { Folder, Note } from '../../shared/types';
import { DBService } from './db';
import { v4 as uuidv4 } from 'uuid';

export class FolderService {
	/**
	 * Create a new folder.
	 */
	static async createFolder(name: string, parentId?: string): Promise<Folder> {
		const now = new Date();
		const newFolder: Folder = {
			id: `folder-${uuidv4()}`,
			name,
			parentId,
			children: [],
			noteIds: [],
			createdAt: now,
			updatedAt: now,
		};

		await DBService.saveFolder(newFolder);

		// If a parentId is provided, update the parent folder's children array
		if (parentId) {
			const parentFolder = await DBService.getFolder(parentId);
			if (parentFolder) {
				parentFolder.children = [
					...(parentFolder.children || []),
					newFolder.id,
				];
				parentFolder.updatedAt = new Date();
				await DBService.saveFolder(parentFolder);
			}
		}
		return newFolder;
	}

	/**
	 * Get all folders.
	 */
	static async getAllFolders(): Promise<Folder[]> {
		return DBService.getAllFolders();
	}

	/**
	 * Get a single folder by ID.
	 */
	static async getFolder(id: string): Promise<Folder | null> {
		return DBService.getFolder(id);
	}

	/**
	 * Update a folder.
	 * Generic update, used for renaming, changing parent, etc.
	 * More specific methods might be needed for complex operations like moving.
	 */
	static async updateFolder(
		id: string,
		updates: Partial<Folder>
	): Promise<Folder | null> {
		const folder = await DBService.getFolder(id);
		if (!folder) return null;

		const oldParentId = folder.parentId;
		const newParentId = updates.parentId;

		const updatedFolderData = { ...folder, ...updates, updatedAt: new Date() };
		// If parentId is explicitly set to null in updates, it means move to root.
		// The ...updates spread will handle this. If parentId is not in updates, it remains unchanged.
		if (updates.parentId === null) {
			updatedFolderData.parentId = undefined; // Ensure it's undefined for root, not null
		}

		await DBService.saveFolder(updatedFolderData);

		const actualNewParentId = updatedFolderData.parentId; // Use the parentId from the saved data

		// If parentage actually changed
		if (oldParentId !== actualNewParentId) {
			// Remove from old parent's children if oldParentId existed
			if (oldParentId) {
				const oldParent = await DBService.getFolder(oldParentId);
				if (oldParent && oldParent.children) {
					oldParent.children = oldParent.children.filter(
						childId => childId !== id
					);
					oldParent.updatedAt = new Date();
					await DBService.saveFolder(oldParent);
				}
			}
			// Add to new parent's children if actualNewParentId exists
			if (actualNewParentId) {
				const newParent = await DBService.getFolder(actualNewParentId);
				if (newParent) {
					newParent.children = [
						...new Set([...(newParent.children || []), id]),
					]; // Ensure uniqueness
					newParent.updatedAt = new Date();
					await DBService.saveFolder(newParent);
				}
			}
		}
		return updatedFolderData;
	}

	/**
	 * Delete a folder. This will also recursively delete child folders
	 * and move notes from deleted folders to a default location (e.g., root or an "Unfiled" folder).
	 * For simplicity, this example moves notes to have no folderId (root).
	 */
	static async deleteFolder(
		id: string,
		allFoldersMap: { [folderId: string]: Folder }
	): Promise<void> {
		const folderToDelete = allFoldersMap[id];
		if (!folderToDelete) return;

		// Recursively delete children
		if (folderToDelete.children && folderToDelete.children.length > 0) {
			for (const childId of folderToDelete.children) {
				await this.deleteFolder(childId, allFoldersMap);
			}
		}

		// Unassign notes from this folder
		if (folderToDelete.noteIds && folderToDelete.noteIds.length > 0) {
			for (const noteId of folderToDelete.noteIds) {
				const note = await DBService.getNote(noteId);
				if (note) {
					note.folderId = undefined; // Move to root/unfiled
					await DBService.saveNote(note);
				}
			}
		}

		// Remove from parent's children list
		if (folderToDelete.parentId) {
			const parentFolder = await DBService.getFolder(folderToDelete.parentId);
			if (parentFolder && parentFolder.children) {
				parentFolder.children = parentFolder.children.filter(
					childId => childId !== id
				);
				parentFolder.updatedAt = new Date();
				await DBService.saveFolder(parentFolder);
			}
		}

		await DBService.deleteFolder(id);
	}

	/**
	 * Add a note to a folder.
	 */
	static async addNoteToFolder(
		noteId: string,
		folderId: string
	): Promise<void> {
		const note = await DBService.getNote(noteId);
		const folder = await DBService.getFolder(folderId);

		if (note && folder) {
			// Remove from old folder if any
			if (note.folderId && note.folderId !== folderId) {
				const oldFolder = await DBService.getFolder(note.folderId);
				if (oldFolder) {
					oldFolder.noteIds = oldFolder.noteIds.filter(id => id !== noteId);
					oldFolder.updatedAt = new Date();
					await DBService.saveFolder(oldFolder);
				}
			}

			note.folderId = folderId;
			note.updatedAt = new Date();
			await DBService.saveNote(note);

			if (!folder.noteIds.includes(noteId)) {
				folder.noteIds.push(noteId);
				folder.updatedAt = new Date();
				await DBService.saveFolder(folder);
			}
		}
	}

	/**
	 * Remove a note from its folder.
	 */
	static async removeNoteFromFolder(
		noteId: string,
		folderId: string
	): Promise<void> {
		const note = await DBService.getNote(noteId);
		const folder = await DBService.getFolder(folderId);

		if (note && folder && note.folderId === folderId) {
			note.folderId = undefined; // Or move to a default "Unfiled" folder
			note.updatedAt = new Date();
			await DBService.saveNote(note);

			folder.noteIds = folder.noteIds.filter(id => id !== noteId);
			folder.updatedAt = new Date();
			await DBService.saveFolder(folder);
		}
	}

	/**
	 * Build a tree structure from a flat list of folders.
	 */
	static buildFolderTree(folders: Folder[]): Folder[] {
		const folderMap: { [id: string]: Folder & { childrenNodes?: Folder[] } } =
			{};
		folders.forEach(folder => {
			folderMap[folder.id] = { ...folder, childrenNodes: [] };
		});

		const tree: Folder[] = [];
		folders.forEach(folder => {
			if (folder.parentId && folderMap[folder.parentId]) {
				folderMap[folder.parentId].childrenNodes?.push(folderMap[folder.id]);
			} else {
				tree.push(folderMap[folder.id]);
			}
		});
		return tree;
	}
}
