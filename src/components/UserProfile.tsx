import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Trash2, Plus, Copy, Check } from 'lucide-react';
import { UserProfile as UserProfileType } from '../../shared/types'; // Renamed to avoid conflict
import { toast } from 'sonner';

export function UserProfile() {
  const { userProfile, updateUserProfile: storeUpdateUserProfile } = useAppStore(state => ({
    userProfile: state.userProfile,
    updateUserProfile: state.updateUserProfile,
  }));

  const [sharedTags, setSharedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  // For simplicity, sharedValues are stored as "key::value" strings in UserProfile
  // We'll manage them as such here.
  const [sharedValues, setSharedValues] = useState<string[]>([]);
  const [newSharedValueKey, setNewSharedValueKey] = useState('');
  const [newSharedValueVal, setNewSharedValueVal] = useState('');

  const [copiedPubkey, setCopiedPubkey] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setSharedTags(userProfile.sharedTags || []);
      setSharedValues(userProfile.sharedValues || []);
    }
  }, [userProfile]);

  const handleUpdateProfile = (updates: Partial<UserProfileType>) => {
    if (userProfile) {
      storeUpdateUserProfile({ ...userProfile, ...updates });
      toast.success("Profile updated!");
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !sharedTags.includes(newTag.trim())) {
      const updatedTags = [...sharedTags, newTag.trim()];
      setSharedTags(updatedTags);
      handleUpdateProfile({ sharedTags: updatedTags });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = sharedTags.filter(tag => tag !== tagToRemove);
    setSharedTags(updatedTags);
    handleUpdateProfile({ sharedTags: updatedTags });
  };

  const handleAddSharedValue = () => {
    if (newSharedValueKey.trim() && newSharedValueVal.trim()) {
      const entry = `${newSharedValueKey.trim()}::${newSharedValueVal.trim()}`;
      // Prevent duplicate keys by replacing if key exists
      const keyExistsIndex = sharedValues.findIndex(val => val.startsWith(newSharedValueKey.trim() + "::"));
      let updatedValues;
      if (keyExistsIndex !== -1) {
        updatedValues = [...sharedValues];
        updatedValues[keyExistsIndex] = entry;
      } else {
        updatedValues = [...sharedValues, entry];
      }
      setSharedValues(updatedValues);
      handleUpdateProfile({ sharedValues: updatedValues });
      setNewSharedValueKey('');
      setNewSharedValueVal('');
    }
  };

  const handleRemoveSharedValue = (valueEntryToRemove: string) => {
    const updatedValues = sharedValues.filter(val => val !== valueEntryToRemove);
    setSharedValues(updatedValues);
    handleUpdateProfile({ sharedValues: updatedValues });
  };

  const copyPubkeyToClipboard = () => {
    if (userProfile?.nostrPubkey) {
      navigator.clipboard.writeText(userProfile.nostrPubkey)
        .then(() => {
          setCopiedPubkey(true);
          toast.success("Public key copied to clipboard!");
          setTimeout(() => setCopiedPubkey(false), 2000);
        })
        .catch(() => toast.error("Failed to copy public key."));
    }
  };

  if (!userProfile) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        User profile not available. Please ensure you are connected to Nostr.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nostr Identity</CardTitle>
          <CardDescription>Your decentralized public identity.</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="nostrPubkey">Public Key (npub)</Label>
          <div className="flex items-center gap-2">
            <Input id="nostrPubkey" value={userProfile.nostrPubkey || "Not set"} readOnly className="font-mono text-sm" />
            {userProfile.nostrPubkey && (
              <Button variant="outline" size="icon" onClick={copyPubkeyToClipboard}>
                {copiedPubkey ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            This is your shareable Nostr identifier. Your private key is stored locally and never shown here.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Public Profile Information</CardTitle>
          <CardDescription>
            These tags and values can be publicly associated with your Nostr profile for discovery by others.
            They are typically published via a Kind 0 (profile metadata) event by Nostr clients.
            Notention currently uses these for matching if shared with notes, but doesn't publish a separate Kind 0.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-base">Shared Tags</Label>
            <div className="flex flex-wrap gap-2 my-2">
              {sharedTags.map(tag => (
                <Badge key={tag} variant="secondary" className="group relative pr-7 text-sm">
                  {tag}
                  <Button
                    variant="ghost"
                    size="xs"
                    className="absolute top-1/2 right-0.5 transform -translate-y-1/2 h-5 w-5 p-0 opacity-50 group-hover:opacity-100"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    <Trash2 size={12} />
                  </Button>
                </Badge>
              ))}
              {sharedTags.length === 0 && <p className="text-sm text-muted-foreground">No shared tags.</p>}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a public tag (e.g., #developer)"
              />
              <Button onClick={handleAddTag} size="sm"><Plus size={16} className="mr-1" />Add Tag</Button>
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="text-base">Shared Key-Values</Label>
            <div className="space-y-2 my-2">
              {sharedValues.map(entry => {
                const [key, ...valParts] = entry.split('::');
                const val = valParts.join('::');
                return (
                  <Badge key={entry} variant="outline" className="group relative pr-7 mr-2 text-sm py-1">
                    <span className="font-semibold">{key}:</span> {val}
                    <Button
                      variant="ghost"
                      size="xs"
                      className="absolute top-1/2 right-0.5 transform -translate-y-1/2 h-5 w-5 p-0 opacity-50 group-hover:opacity-100"
                      onClick={() => handleRemoveSharedValue(entry)}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </Badge>
                );
              })}
              {sharedValues.length === 0 && <p className="text-sm text-muted-foreground">No shared key-values.</p>}
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="newSharedValueKey" className="text-xs">Key</Label>
                <Input
                  id="newSharedValueKey"
                  value={newSharedValueKey}
                  onChange={(e) => setNewSharedValueKey(e.target.value)}
                  placeholder="e.g., website"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="newSharedValueVal" className="text-xs">Value</Label>
                <Input
                  id="newSharedValueVal"
                  value={newSharedValueVal}
                  onChange={(e) => setNewSharedValueVal(e.target.value)}
                  placeholder="e.g., https://example.com"
                />
              </div>
              <Button onClick={handleAddSharedValue} size="sm"><Plus size={16} className="mr-1" />Add Value</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Note: Full profile editing (like name, picture, bio for Nostr Kind 0 events) can be done in dedicated Nostr clients.
        Notention focuses on tags and values relevant for its matching features.
      </p>
    </div>
  );
}
