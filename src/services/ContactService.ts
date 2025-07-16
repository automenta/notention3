import { Contact } from '../../shared/types';
import { db } from './db';
import { store } from '../store';
import { nostrService } from './NostrService';

const CONTACTS_KEY = 'contacts';

class ContactService {
  async getContacts(): Promise<Contact[]> {
    let contacts = await db.getItem<Contact[]>(CONTACTS_KEY);
    if (!contacts) {
      contacts = [];
    }
    store.getState().setContacts(contacts);
    return contacts;
  }

  async addContact(contact: Contact): Promise<void> {
    const contacts = await this.getContacts();
    if (contacts.find((c) => c.pubkey === contact.pubkey)) {
      return; // Contact already exists
    }
    const newContacts = [...contacts, contact];
    await db.setItem(CONTACTS_KEY, newContacts);
    store.getState().setContacts(newContacts);
  }

  async removeContact(pubkey: string): Promise<void> {
    const contacts = await this.getContacts();
    const newContacts = contacts.filter((c) => c.pubkey !== pubkey);
    await db.setItem(CONTACTS_KEY, newContacts);
    store.getState().setContacts(newContacts);
  }

  async fetchContactsFromNostr() {
    // This will be implemented later
  }
}

export const contactService = new ContactService();
