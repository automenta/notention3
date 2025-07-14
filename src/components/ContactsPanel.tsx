import { useState } from 'react';
import { UserPlus, Users, Trash2, MessageSquare, Edit3, Check, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea'; // Import Textarea
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "./ui/dialog";
import { ScrollArea } from './ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { useAppStore } from '../store';
import { Contact } from '../../shared/types';
import { toast } from 'sonner';

// Re-using DM Modal logic from NetworkPanel, might need refactoring into a shared component later.
// For now, this is a simplified version.
interface DmModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  recipientPubkey: string;
  recipientAlias?: string;
}

function SendDmModal({ isOpen, onOpenChange, recipientPubkey, recipientAlias }: DmModalProps) {
  const { sendDirectMessage, userProfile } = useAppStore();
  const [dmContent, setDmContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSendDm = async () => {
    if (!dmContent.trim()) {
      toast.error("Message content cannot be empty.");
      return;
    }
    if (!userProfile?.nostrPubkey) {
      toast.error("Please connect to Nostr to send DMs.");
      return;
    }
    setIsSending(true);
    try {
      await sendDirectMessage(recipientPubkey, dmContent.trim());
      toast.success(`Direct Message sent to ${recipientAlias || recipientPubkey.substring(0,10) + '...'}`);
      setDmContent('');
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Failed to send DM.", { description: e.message });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Direct Message</DialogTitle>
          <DialogDescription>To: {recipientAlias || recipientPubkey.substring(0,10) + '...'}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            value={dmContent}
            onChange={(e) => setDmContent(e.target.value)}
            placeholder="Your encrypted message..."
            className="min-h-[100px]"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={isSending}>Cancel</Button></DialogClose>
          <Button onClick={handleSendDm} disabled={!dmContent.trim() || isSending}>
            {isSending && <Users size={16} className="mr-2 animate-spin" />} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


export function ContactsPanel() {
  const { userProfile, addContact, removeContact, updateContactAlias } = useAppStore();
  const contacts = userProfile?.contacts || [];

  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
  const [newContactPubkey, setNewContactPubkey] = useState('');
  const [newContactAlias, setNewContactAlias] = useState('');

  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editAliasValue, setEditAliasValue] = useState('');

  const [dmModalOpen, setDmModalOpen] = useState(false);
  const [dmRecipient, setDmRecipient] = useState<{pubkey: string, alias?: string} | null>(null);


  const handleAddContact = async () => {
    if (!newContactPubkey.trim()) {
      toast.error("Public key cannot be empty.");
      return;
    }
    // Basic validation for pubkey format (npub or hex) - can be improved
    if (!/^(npub1[02-9ac-hj-np-z]+)|([0-9a-fA-F]{64})$/.test(newContactPubkey.trim())) {
        toast.error("Invalid Nostr public key format.");
        return;
    }
    try {
      await addContact({ pubkey: newContactPubkey.trim(), alias: newContactAlias.trim() || undefined });
      toast.success(`Contact ${newContactAlias.trim() || newContactPubkey.trim().substring(0,10)+'...'} added!`);
      setNewContactPubkey('');
      setNewContactAlias('');
      setIsAddContactModalOpen(false);
    } catch (e: any) {
      toast.error("Failed to add contact.", { description: e.message });
    }
  };

  const handleRemoveContact = async (pubkey: string) => {
    if (window.confirm(`Are you sure you want to remove this contact?`)) {
      try {
        await removeContact(pubkey);
        toast.success("Contact removed.");
      } catch (e: any) {
        toast.error("Failed to remove contact.", { description: e.message });
      }
    }
  };

  const handleStartEditAlias = (contact: Contact) => {
    setEditingContact(contact);
    setEditAliasValue(contact.alias || '');
  };

  const handleSaveAlias = async () => {
    if (!editingContact) return;
    try {
      await updateContactAlias(editingContact.pubkey, editAliasValue.trim());
      toast.success("Alias updated.");
      setEditingContact(null);
    } catch (e: any) {
      toast.error("Failed to update alias.", { description: e.message });
    }
  };

  const handleOpenDm = (contact: Contact) => {
    setDmRecipient({ pubkey: contact.pubkey, alias: contact.alias });
    setDmModalOpen(true);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users size={20} /> Contacts
              </CardTitle>
              <Button size="sm" onClick={() => setIsAddContactModalOpen(true)}>
                <UserPlus size={16} className="mr-2" /> Add Contact
              </Button>
            </div>
            <CardDescription>Manage your list of contacts for direct messaging.</CardDescription>
          </CardHeader>
          <CardContent>
            {contacts.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">
                <Users size={40} className="mx-auto mb-3 opacity-50" />
                <p className="text-base font-medium">No contacts yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add contacts to easily start direct messages.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.sort((a,b) => (a.alias || a.pubkey).localeCompare(b.alias || b.pubkey)).map((contact) => (
                  <div key={contact.pubkey} className="p-3 border rounded-lg flex items-center justify-between hover:bg-accent/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      {editingContact?.pubkey === contact.pubkey ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editAliasValue}
                            onChange={(e) => setEditAliasValue(e.target.value)}
                            placeholder="Set alias"
                            className="h-8 text-sm flex-grow"
                          />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveAlias}><Check size={16} className="text-green-500"/></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingContact(null)}><X size={16} /></Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                           <span className="font-medium text-sm truncate" title={contact.pubkey}>
                            {contact.alias || `${contact.pubkey.substring(0, 10)}...`}
                          </span>
                          {contact.alias && <span className="text-xs text-muted-foreground truncate">({contact.pubkey.substring(0, 10)}...)</span>}
                          <Button variant="ghost" size="icon" className="h-6 w-6 p-0 opacity-50 hover:opacity-100" onClick={() => handleStartEditAlias(contact)}>
                            <Edit3 size={12} />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleOpenDm(contact)}>
                        <MessageSquare size={14} className="mr-1.5" /> DM
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveContact(contact.pubkey)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Contact Modal */}
        <Dialog open={isAddContactModalOpen} onOpenChange={setIsAddContactModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label htmlFor="newContactPubkey" className="text-sm font-medium">Nostr Public Key (npub or hex)</label>
                <Input
                  id="newContactPubkey"
                  value={newContactPubkey}
                  onChange={(e) => setNewContactPubkey(e.target.value)}
                  placeholder="npub1..."
                />
              </div>
              <div>
                <label htmlFor="newContactAlias" className="text-sm font-medium">Alias (Optional)</label>
                <Input
                  id="newContactAlias"
                  value={newContactAlias}
                  onChange={(e) => setNewContactAlias(e.target.value)}
                  placeholder="e.g., Bob"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={handleAddContact}>Add Contact</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Send DM Modal */}
        {dmRecipient && (
          <SendDmModal
            isOpen={dmModalOpen}
            onOpenChange={setDmModalOpen}
            recipientPubkey={dmRecipient.pubkey}
            recipientAlias={dmRecipient.alias}
          />
        )}
      </div>
    </ScrollArea>
  );
}
