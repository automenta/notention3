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


test('ontology management and impact on note tagging', async ({ page }) => {
  await page.goto('/');

  // 1. Navigate to Ontology Editor
  const ontologyTabButton = page.getByRole('tab', { name: /Tags/i }); // "Tags" is the visible name for ontology
  await ontologyTabButton.click();
  await expect(page.getByRole('heading', { name: 'Ontology' })).toBeVisible();

  // 2. Add a new root concept
  const addConceptButton = page.getByRole('button', { name: /Add Concept/i });
  await addConceptButton.click();

  const conceptLabelInput = page.getByPlaceholder('e.g., AI, Project, Person');
  await expect(conceptLabelInput).toBeVisible();
  const newConceptName = `#MyE2EConcept${Date.now()}`;
  await conceptLabelInput.fill(newConceptName);

  const addConceptModalButton = page.locator('div[role="dialog"] button:has-text("Add Concept")');
  await addConceptModalButton.click();
  await expect(page.getByText(newConceptName, { exact: true })).toBeVisible({timeout: 10000});

  // 3. Navigate back to Notes and create a new note
  const notesTabButton = page.getByRole('tab', { name: /Notes/i });
  await notesTabButton.click();

  const createNoteButton = page.locator('div.p-4.border-b button:has(svg[lucide="plus"])').first();
  await createNoteButton.click();

  const noteTitleInput = page.getByPlaceholder('Untitled Note');
  await expect(noteTitleInput).toBeVisible();
  const noteTitleWithOntology = `Note With ${newConceptName}`;
  await noteTitleInput.fill(noteTitleWithOntology);

  // 4. Tag the note with the new concept using autocomplete
  const editorContentArea = page.locator('.ProseMirror[contenteditable="true"]');
  await editorContentArea.click(); // Focus editor
  await page.keyboard.type(newConceptName.substring(0, newConceptName.length - 5)); // Type part of the concept to trigger autocomplete

  // Wait for autocomplete suggestion and click it
  const suggestionOption = page.locator(`button.justify-start:has-text("${newConceptName}")`);
  await expect(suggestionOption).toBeVisible({ timeout: 10000 });
  await suggestionOption.click();

  // Verify the tag is in the editor (Tiptap Mention renders it with a specific class)
  await expect(editorContentArea.locator(`span.semantic-tag:has-text("${newConceptName}")`)).toBeVisible();

  // 5. Save the note
  const saveButton = page.getByRole('button', { name: /Save/i });
  await saveButton.click();

  // 6. Verify the note appears in the list
  const notesListScrollArea = page.locator('div[data-state="active"][role="tabpanel"][aria-labelledby*="notes-tab"] div[data-radix-scroll-area-viewport]');
  await expect(notesListScrollArea.getByText(noteTitleWithOntology, { exact: true })).toBeVisible({ timeout: 10000 });

  // 7. Filter by the new ontology tag
  const filterByOntologyButton = page.getByRole('button', { name: /Filter by Ontology Tags/i });
  if (!await filterByOntologyButton.isVisible()) { // If not visible, it might be in a collapsible, try to open
    const collapsibleTrigger = page.locator('button:has-text("Filter by Ontology Tags")'); // More generic
    if (await collapsibleTrigger.count() > 0) await collapsibleTrigger.first().click();
  }
  await expect(filterByOntologyButton).toBeVisible(); // Should be visible now
  // If it's a trigger for a collapsible, click it.
  // This check is to ensure the collapsible content is open IF the button itself is the trigger.
  // If the button is always visible and the content is collapsible, this might need adjustment.
  // For this test, assuming clicking this button or its parent section makes tags visible.

  // Click the tag in the filter list
  // The filter list is within a CollapsibleContent, ensure it's expanded if necessary.
  const tagInFilterList = page.locator(`div[role="button"][data-state*="open"] ~ div button:has-text("${newConceptName}")`, { timeout: 5000 }).or(page.locator(`button span:has-text("${newConceptName}")`));
  // A more direct way if the collapsible is open:
  const tagBadgeInFilter = page.locator(`div[data-state="open"] span.cursor-pointer:has-text("${newConceptName}")`);


  // This part is tricky due to how filters are structured. Let's click the main "Filter by Ontology Tags" button
  // to ensure the collapsible is open.
  await filterByOntologyButton.click(); // Assuming this expands the filter list

  const specificTagFilterBadge = page.locator(`span.cursor-pointer:has-text("${newConceptName}")`);
  await expect(specificTagFilterBadge).toBeVisible({ timeout: 10000 });
  await specificTagFilterBadge.click();


  // Verify only the note with that tag is visible
  await expect(notesListScrollArea.getByText(noteTitleWithOntology, { exact: true })).toBeVisible();
  const otherNotes = notesListScrollArea.locator('h3').filter({ hasNotText: noteTitleWithOntology });
  await expect(otherNotes).toHaveCount(0, { timeout: 5000 }); // Check that no other notes are visible

  // 8. (Cleanup) Delete the concept (optional, but good for test hygiene)
  // Navigate back to Ontology Editor
  await ontologyTabButton.click();
  const conceptInEditor = page.getByText(newConceptName, { exact: true });
  await expect(conceptInEditor).toBeVisible();
  // Find delete button for this concept - this requires careful DOM inspection
  // Assuming delete button is a sibling or child of the concept's display element
  const conceptRow = conceptInEditor.locator('xpath=ancestor::div[contains(@class, "group")]'); // Find the ancestor row
  const deleteConceptButton = conceptRow.locator('button:has(svg[lucide="trash-2"])'); // Simpler selector for lucide icon
  await deleteConceptButton.click();
  await expect(page.getByText(newConceptName, { exact: true })).not.toBeVisible({timeout: 5000});
});

test('Nostr publishing and DM', async ({ page }) => {
  await page.goto('/');

  // Ensure Nostr identity is set up - Check settings or run wizard part
  const settingsTab = page.getByRole('tab', { name: /Set/i }); // "Set" is visible name for Settings
  await settingsTab.click();

  const identityKeysCardTitle = page.getByRole('heading', { name: 'Identity & Keys' });
  await expect(identityKeysCardTitle).toBeVisible();

  // Check if pubkey is present. If not, generate.
  // This relies on the UserProfile component within SettingsPanel correctly showing the pubkey.
  // A more robust way would be to check a specific data-testid for the pubkey display.
  // For now, let's assume if "Generate New Keys" is the prominent action, keys are not set.
  const generateKeysButtonInSettings = page.getByRole('button', { name: /Generate New Keys/i });
  const logoutButtonInSettings = page.getByRole('button', { name: /Log Out & Clear Keys/i });

  if (await logoutButtonInSettings.isDisabled()) { // Assuming logout is disabled if no keys
    await generateKeysButtonInSettings.click();
    // Handle the confirmation dialog for generating keys
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('This will generate a new Nostr keypair');
      await dialog.accept();
    });
    await page.waitForEvent('dialog'); // Wait for the previous dialog to be handled

    // Now handle the backup private key modal
    await expect(page.getByText('IMPORTANT: Back Up Your New Private Key')).toBeVisible({timeout: 10000});
    await page.locator('label[for="newSkBackupConfirmed"]').click();
    await page.getByRole('button', { name: /Confirm Backup & Continue/i }).click();
    await expect(page.getByText('New Nostr identity set up successfully!')).toBeVisible(); // Toast
  }
  await expect(logoutButtonInSettings).toBeEnabled({timeout:10000}); // Ensure logout is now enabled

  // 1. Create a new note
  const notesTabButton = page.getByRole('tab', { name: /Notes/i });
  await notesTabButton.click();
  const createNoteButton = page.locator('div.p-4.border-b button:has(svg[lucide="plus"])').first();
  await createNoteButton.click();

  const noteTitleInput = page.getByPlaceholder('Untitled Note');
  await expect(noteTitleInput).toBeVisible();
  const nostrNoteTitle = `Nostr Test Note ${Date.now()}`;
  await noteTitleInput.fill(nostrNoteTitle);
  const editorContentArea = page.locator('.ProseMirror[contenteditable="true"]');
  await editorContentArea.fill('This note will be published to Nostr.');
  const saveButton = page.getByRole('button', { name: /Save/i });
  await saveButton.click();
  // Wait for save confirmation if any, or just proceed.

  // 2. Publish publicly
  const networkTab = page.getByRole('tab', { name: /Net/i }); // "Net" is visible name for Network
  await networkTab.click();
  const publishButton = page.getByRole('button', { name: /Publish Current Note/i }); // In NetworkPanel Quick Actions

  // Before clicking publish, ensure the "Share Notes Publicly" toggle is ON in settings if it's a prerequisite.
  // For this test, we assume default settings allow it or the UI handles it.
  // A more robust test would explicitly set this.
  // For now, let's check the privacy setting in the UI
  await settingsTab.click();
  const sharePubliclySwitch = page.locator('#sharePublicNotesGlobally'); // Assuming this ID exists
  if (!await sharePubliclySwitch.isChecked()) {
    await sharePubliclySwitch.check();
    // Add a small wait for state to potentially update if needed
    await page.waitForTimeout(500);
  }
  await networkTab.click(); // Go back to network tab

  await publishButton.click();
  // Check for toast message indicating success (actual relay publish is hard to verify in E2E)
  await expect(page.getByText(/Note published to Nostr/i)).toBeVisible({ timeout: 10000 }); // Toast message

  // 3. Publish encrypted to self (Conceptual - UI might not have a direct "encrypt to self" button)
  // The `publishCurrentNoteToNostr` in store defaults to public.
  // We'll skip explicit "encrypt to self" E2E test as it's not a direct UI flow,
  // but covered by sync logic. `syncWithNostr` encrypts to self.

  // 4. Go to Contacts, add a dummy contact
  const contactsTab = page.getByRole('tab', { name: /People/i });
  await contactsTab.click();
  await page.getByRole('button', { name: /Add Contact/i }).click();

  const contactPubkeyInput = page.getByLabelText(/Nostr Public Key/i);
  // A valid but potentially non-existent public key for testing DMs
  const dummyContactPubkey = 'npub1sg6plzptd64u62a87dpyln5dqsfly8gl1n7g4p2tff5annvwd23s40w6k2';
  const dummyContactAlias = `DummyContact${Date.now()}`;
  await contactPubkeyInput.fill(dummyContactPubkey);
  await page.getByLabelText(/Alias/i).fill(dummyContactAlias);
  await page.locator('div[role="dialog"] button:has-text("Add Contact")').click();
  await expect(page.getByText(dummyContactAlias)).toBeVisible({timeout: 5000});

  // 5. Send a DM to that contact
  const contactRow = page.getByText(dummyContactAlias).locator('xpath=ancestor::div[contains(@class, "border")]');
  await contactRow.getByRole('button', { name: /DM/i }).click();

  await expect(page.getByRole('dialog', { name: /Send Direct Message/i })).toBeVisible();
  const dmContentInput = page.locator('div[role="dialog"] input[placeholder*="encrypted message"]');
  await dmContentInput.fill('Hello Dummy Contact, this is an E2E test DM!');
  await page.locator('div[role="dialog"] button:has-text("Send")').click();

  // Check for toast message indicating DM sent
  await expect(page.getByText(/Direct Message sent to DummyContact/i)).toBeVisible({ timeout: 10000 });
});

test('AI features interaction', async ({ page }) => {
  await page.goto('/');

  // 1. Configure AI Settings
  const settingsTab = page.getByRole('tab', { name: /Set/i });
  await settingsTab.click();

  const aiFeaturesCardTitle = page.getByRole('heading', { name: 'AI Features' });
  await expect(aiFeaturesCardTitle).toBeVisible();

  const enableAISwitch = page.locator('//label[text()="Enable AI"]/following-sibling::button[@role="switch"]');
  if (!await enableAISwitch.isChecked()) {
    await enableAISwitch.click();
  }
  await expect(enableAISwitch).toBeChecked();

  const ollamaEndpointInput = page.getByLabelText('Ollama API Endpoint');
  // Ensure Ollama is running locally at http://localhost:11434 for this test to pass fully for suggestions.
  // If not, AI features requiring backend call might just show info/error toasts.
  if (await ollamaEndpointInput.inputValue() === '') {
    await ollamaEndpointInput.fill('http://localhost:11434');
  }
  // Add a small delay to ensure settings are processed if they rely on debounce or async updates in backend
  await page.waitForTimeout(500);


  // 2. Create a new note
  const notesTabButton = page.getByRole('tab', { name: /Notes/i });
  await notesTabButton.click();
  const createNoteButton = page.locator('div.p-4.border-b button:has(svg[lucide="plus"])').first();
  await createNoteButton.click();

  const noteTitleInput = page.getByPlaceholder('Untitled Note');
  await expect(noteTitleInput).toBeVisible();
  const aiNoteTitle = `AI Test Note ${Date.now()}`;
  await noteTitleInput.fill(aiNoteTitle);
  const editorContentArea = page.locator('.ProseMirror[contenteditable="true"]');
  await editorContentArea.fill('This note discusses artificial intelligence, machine learning, and natural language processing. It is a test for AI features.');

  // Wait for editor content to be processed for embeddings if applicable
  await page.waitForTimeout(1000); // Give time for potential auto-embedding on type/blur

  // 3. Use "Auto-tag"
  const autoTagButton = page.getByRole('button', { name: /Auto-tag/i });
  await expect(autoTagButton).toBeVisible();
  await autoTagButton.click();
  // Check for toast success or info (actual tags depend on mock/real AI service)
  // Example: await expect(page.getByText(/AI auto-tagging complete!/i)).toBeVisible({ timeout: 15000 });
  // For now, just ensure no error and proceed. We'll check for a tag added later.
  await expect(page.locator('div[role="status"]:has-text("AI auto-tagging complete")')).toBeVisible({timeout: 20000});


  // Verify at least one new tag was added (e.g. #AI or #Test from mock)
  // The tags are displayed as badges below the editor header
  await expect(page.locator('div.flex.flex-wrap.gap-1 span.badge:has-text("#AI")')).toBeVisible({timeout: 5000});


  // 4. Use "Summarize"
  const summarizeButton = page.getByRole('button', { name: /Summarize/i });
  await expect(summarizeButton).toBeVisible();
  await summarizeButton.click();
  // Check for summary modal
  await expect(page.getByRole('dialog', { name: /AI Generated Summary/i })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/This is an AI summary./i)).toBeVisible(); // From mock
  await page.getByRole('button', { name: 'Close' }).click(); // Close the summary modal

  // 5. Use "Find Similar by Content"
  const findSimilarButton = page.getByRole('button', { name: /Similar Content/i });
  await expect(findSimilarButton).toBeVisible();
  // Ensure the note has an embedding - save it first to trigger embedding generation.
  const saveButton = page.getByRole('button', { name: /Save/i });
  await saveButton.click();
  await page.waitForTimeout(500); // Give time for save and potential embedding update

  await findSimilarButton.click();
  await expect(page.getByText(/Searching for similar notes by content.../i)).toBeVisible(); // Toast
  // Verify navigation to Network panel
  await expect(page.getByRole('tab', { name: /Net/i, selected: true })).toBeVisible({ timeout: 5000 });
  // Check if "Content Matches (Local)" card is visible
  await expect(page.getByRole('heading', { name: /Content Matches \(Local\)/i})).toBeVisible();

  // 6. Go to Ontology Editor, use "AI Suggest"
  const ontologyTabButton = page.getByRole('tab', { name: /Tags/i });
  await ontologyTabButton.click();
  const aiSuggestButton = page.getByRole('button', { name: /AI Suggest/i });
  await expect(aiSuggestButton).toBeVisible();
  await aiSuggestButton.click();

  // Modal opens
  await expect(page.getByRole('dialog', { name: /AI Ontology Suggestions/i })).toBeVisible();
  const getSuggestionsButton = page.getByRole('button', { name: /Get Suggestions/i });
  await getSuggestionsButton.click();

  // Check for suggestions (from mock) or info toast
  // Example: await expect(page.getByText(/AI suggestions received!/i)).toBeVisible({ timeout: 15000 }); // Toast
  // Example: await expect(page.getByText(/#AISuggestion/i)).toBeVisible(); // Actual suggestion in modal
  // For robust test, wait for either a suggestion or an "info" toast if no suggestions.
  const suggestionText = page.locator('div[role="dialog"] mark:has-text("#AISuggestion")').or(page.locator('div[role="status"]:has-text("AI did not return any suggestions")'));
  await expect(suggestionText.first()).toBeVisible({timeout: 20000});

  await page.getByRole('button', { name: 'Close' }).click(); // Close AI suggestions modal
});

test('Contacts Management (Buddy List)', async ({ page }) => {
  await page.goto('/');

  // 1. Navigate to Contacts Tab
  const contactsTabButton = page.getByRole('tab', { name: /People/i });
  await contactsTabButton.click();
  await expect(page.getByRole('heading', { name: /Contacts/i })).toBeVisible();

  // 2. Add a new contact
  const addContactButton = page.getByRole('button', { name: /Add Contact/i });
  await addContactButton.click();

  const contactPubkeyInput = page.getByLabelText(/Nostr Public Key/i);
  const contactAliasInput = page.getByLabelText(/Alias/i); // More general label
  const newContactPubkey = 'npub1qt5g8e2q8kshphrr9z5yx80ryhlav29r72fr2v9x6zfpn7sy9z8q3zntq9'; // Another test pubkey
  const newContactAlias = `TestContact-${Date.now()}`;

  await contactPubkeyInput.fill(newContactPubkey);
  await contactAliasInput.fill(newContactAlias);
  await page.locator('div[role="dialog"] button:has-text("Add Contact")').click();

  await expect(page.getByText(newContactAlias)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(`(${newContactPubkey.substring(0, 10)}...)`)).toBeVisible();

  // 3. Edit the alias of the contact
  const contactRow = page.getByText(newContactAlias).locator('xpath=ancestor::div[contains(@class, "border")]');
  const editAliasButton = contactRow.locator('button:has(svg[lucide="edit-3"])');
  await editAliasButton.click();

  const aliasEditInput = contactRow.locator('input[value="' + newContactAlias + '"]');
  await expect(aliasEditInput).toBeVisible();
  const updatedContactAlias = `${newContactAlias}-Updated`;
  await aliasEditInput.fill(updatedContactAlias);

  const saveAliasButton = contactRow.locator('button:has(svg[lucide="check"])');
  await saveAliasButton.click();
  await expect(page.getByText(updatedContactAlias)).toBeVisible({ timeout: 5000 });

  // 4. Send a DM to the contact
  const dmButton = contactRow.getByRole('button', { name: /DM/i });
  await dmButton.click();

  await expect(page.getByRole('dialog', { name: /Send Direct Message/i })).toBeVisible();
  await expect(page.getByText(`To: ${updatedContactAlias}`)).toBeVisible();
  const dmContentInput = page.locator('div[role="dialog"] input[placeholder*="encrypted message"]');
  await dmContentInput.fill('Hello E2E Contact!');
  await page.locator('div[role="dialog"] button:has-text("Send")').click();
  await expect(page.getByText(/Direct Message sent to/i)).toBeVisible({ timeout: 10000 }); // Toast

  // 5. Delete the contact
  // Re-locate row as structure might have changed slightly or to be safe
  const contactRowForDelete = page.getByText(updatedContactAlias).locator('xpath=ancestor::div[contains(@class, "border")]');
  const deleteContactButton = contactRowForDelete.locator('button:has(svg[lucide="trash-2"])');

  page.once('dialog', async dialog => { // Handle confirmation dialog for delete
    expect(dialog.message()).toContain('Are you sure you want to remove this contact?');
    await dialog.accept();
  });
  await deleteContactButton.click();
  await page.waitForEvent('dialog'); // Wait for the previous dialog to be handled

  await expect(page.getByText(updatedContactAlias)).not.toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Contact removed.')).toBeVisible(); // Toast
});
