import { test, expect } from '@playwright/test';

test('homepage has expected title and a visible notes list area', async ({ page }) => {
  // Navigate to the app
  await page.goto('/');

  // Check if the title is "Notention"
  await expect(page).toHaveTitle(/Notention/);

  // Check if an element that looks like the notes list sidebar is visible
  // This is the search input within the sidebar.
  const notesListSearchInput = page.getByPlaceholder('Search notes...'); // From Sidebar.tsx
  await expect(notesListSearchInput).toBeVisible();
});

test('create, edit, and see a new note in the list', async ({ page }) => {
  await page.goto('/');

  // 1. Click the "Create Note" button (Plus icon in the Sidebar header)
  // More specific selector for the Plus button in the sidebar header.
  const createNoteButton = page.locator('div.p-4.border-b button:has(svg[lucide="plus"])').first();
  await expect(createNoteButton).toBeVisible();
  await createNoteButton.click();

  // 2. Wait for the editor to appear and set the title
  const noteTitleInput = page.getByPlaceholder('Untitled Note'); // From NoteEditor.tsx
  await expect(noteTitleInput).toBeVisible({ timeout: 10000 });
  await expect(noteTitleInput).toBeEditable();

  const testNoteTitle = `My E2E Test Note ${Date.now()}`;
  await noteTitleInput.fill(testNoteTitle);

  // 3. Add content to the Tiptap editor
  // The ProseMirror editor area is typically a div with contenteditable=true or role=textbox
  const editorContentArea = page.locator('.ProseMirror[contenteditable="true"]');
  await expect(editorContentArea).toBeVisible();
  await editorContentArea.fill('This is the content of my E2E test note.');

  // 4. Click the "Save" button
  const saveButton = page.getByRole('button', { name: /Save/i }); // From NoteEditor.tsx
  await expect(saveButton).toBeVisible();
  await saveButton.click();

  // 5. Verify the note appears in the notes list (NotesList.tsx)
  // Notes in NotesList are rendered with their title in an h3.
  // We need to ensure the list has time to update.
  // The selector targets an h3 within a note item structure.
  // A more robust selector would use data-testid on the note item and title.
  const newNoteInList = page.locator(`div[role="listitem"] h3:has-text("${testNoteTitle}")`, { timeout: 10000 });

  // As NotesList is virtualized, we might need to ensure the item is scrolled into view or simply check visibility.
  // For virtualized lists, it's often better to check for the item within the scrollable container.
  // The list items in NotesList are divs with class 'p-2.5 rounded-md border'.
  // The title is an H3 inside it.
  // A more specific selector might be:
  // page.locator('div.p-2.5.rounded-md.border:has(h3:text("${testNoteTitle}"))')

  // Let's try to find the note by its title text directly within the scroll area of the notes list.
  // The scroll area is within the 'NotesList' component, which is inside a TabsContent value="notes".
  const notesListScrollArea = page.locator('div[data-state="active"][role="tabpanel"][aria-labelledby*="notes-tab"] div[data-radix-scroll-area-viewport]');

  // This is a more robust way to find text within a specific container.
  await expect(notesListScrollArea.getByText(testNoteTitle, { exact: true })).toBeVisible({ timeout: 15000 });

  // 6. (Optional) Click on the note in the list to re-open it and verify content
  await notesListScrollArea.getByText(testNoteTitle, { exact: true }).click();
  await expect(noteTitleInput).toHaveValue(testNoteTitle);
  await expect(editorContentArea).toHaveText('This is the content of my E2E test note.');

});

// Placeholder for the old test, can be removed or adapted
// test('creating a new note navigates to editor', async ({ page }) => {
//   await page.goto('/');
//   const createNoteButtonOld = page.getByRole('button', { name: /New Note|Create Note/i });
//   if (await createNoteButtonOld.count() > 0) {
//     await createNoteButtonOld.first().click();
//     const noteTitleInput = page.getByPlaceholder('Untitled Note');
//     await expect(noteTitleInput).toBeVisible({ timeout: 10000 });
//     await expect(noteTitleInput).toBeEditable();
//   } else {
//     console.warn('Old Create Note button not found for E2E test.');
//   }
// });
