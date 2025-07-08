import { Settings, User, Key, Palette, Zap, Download, Upload, Trash2, Plus, LogOut, Server, ShieldCheck } from "lucide-react";
import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { ScrollArea } from "./ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useAppStore } from "../store";
import { DBService } from "../services/db";
import { UserProfile as UserProfileComponent } from "./UserProfile"; // Import the new component

export function SettingsPanel() {
  const {
    userProfile,
    // updateUserProfile, // This will be handled by UserProfileComponent internally for its scope
    generateAndStoreNostrKeys,
    logoutFromNostr,
    nostrRelays,
    addNostrRelay,
    removeNostrRelay,
    updateUserProfile: storeUpdateUserProfile // Keep for other settings like theme, AI
  } = useAppStore();

  // State for relay management is kept here
  const [newRelayUrl, setNewRelayUrl] = useState("");

  const handleExportData = async () => {
    const data = await DBService.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notention-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        await DBService.importData(data);
        alert('Data imported successfully! Please refresh the page.');
      } catch (error) {
        alert('Failed to import data. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearData = async () => {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      await DBService.clearAllData();
      alert('All data cleared! Please refresh the page.');
    }
  };

  const handleGenerateKeypair = async () => {
    if (confirm('Are you sure you want to generate a new keypair? This will change your Nostr identity and you MUST back up the new private key.')) {
      const newPublicKey = await generateAndStoreNostrKeys();
      if (newPublicKey) {
        alert(`New keypair generated! Your new public key is: ${newPublicKey}. Please ensure your private key is backed up (this app does not display it again after generation).`);
      } else {
        alert('Failed to generate keypair. Check console for errors.');
      }
    }
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out? This will clear your local keys.')) {
      await logoutFromNostr();
      alert('Logged out successfully.');
    }
  };

  // Shared tag and value logic is now within UserProfile.tsx
  // Relay management remains here or could be moved to a dedicated component too.

  const handleAddRelay = () => {
    if (newRelayUrl.trim() && !nostrRelays.includes(newRelayUrl.trim())) {
      addNostrRelay(newRelayUrl.trim());
      setNewRelayUrl("");
    } else if (nostrRelays.includes(newRelayUrl.trim())) {
      alert("Relay already exists.");
    }
  };

  const handleRemoveRelay = (relayUrl: string) => {
    removeNostrRelay(relayUrl);
  };

  const toggleTheme = () => {
    if (userProfile) {
      const newTheme = userProfile.preferences.theme === 'light' ? 'dark' : 'light';
      storeUpdateUserProfile({ // Use storeUpdateUserProfile for settings outside UserProfileComponent
        ...userProfile,
        preferences: {
          ...userProfile.preferences,
          theme: newTheme,
        },
      });
      
      // Apply theme to document
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* User Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <User size={16} />
              User Profile & Identity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userProfile ? (
              <UserProfileComponent />
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">
                  User profile not fully loaded or not set up.
                </p>
                <Button size="sm" onClick={handleGenerateKeypair} variant="default">
                  Initialize Profile & Generate Keys
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Nostr Key Management (Moved out from UserProfileComponent to keep it focused) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Key size={16} />
              Identity & Keys
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start"
                onClick={handleGenerateKeypair} // Corrected handler
              >
                <Key size={16} className="mr-2" />
                Generate New Keys
              </Button>
               <p className="text-xs text-muted-foreground mt-1">
                Warning: This replaces your current keys. Back up your old private key if needed.
                You MUST back up the new private key.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start mt-2"
                onClick={handleLogout}
                disabled={!userProfile?.nostrPubkey}
              >
                <LogOut size={16} className="mr-2" />
                Log Out & Clear Keys
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Nostr Relays Management */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Server size={16} /> Nostr Relays
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground mb-2">Manage the Nostr relays your app connects to.</p>
            <div className="space-y-1 mb-2">
              {nostrRelays.map((relayUrl) => (
                <div key={relayUrl} className="flex items-center justify-between bg-muted p-1.5 rounded">
                  <span className="text-xs font-mono truncate flex-1 mr-2">{relayUrl}</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-5 w-5 p-0 text-destructive"
                    onClick={() => handleRemoveRelay(relayUrl)}
                  >
                    <Trash2 size={12}/>
                  </Button>
                </div>
              ))}
              {nostrRelays.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No relays configured. Using defaults.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={newRelayUrl}
                onChange={(e) => setNewRelayUrl(e.target.value)}
                placeholder="wss://your.relay.com"
                className="text-xs h-8"
              />
              <Button size="sm" onClick={handleAddRelay} className="h-8">
                <Plus size={14}/> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck size={16} /> {/* Changed Icon */}
              Note Sharing Privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="sharePublicNotesGlobally" className="text-sm">Share Notes Publicly</Label>
                <p className="text-xs text-muted-foreground">
                  Allow publishing non-encrypted notes to the Nostr network.
                </p>
              </div>
              <Switch
                id="sharePublicNotesGlobally"
                checked={userProfile?.privacySettings?.sharePublicNotesGlobally || false}
                onCheckedChange={(checked) => {
                  if (userProfile) {
                    updateUserProfile({
                      ...userProfile,
                      privacySettings: {
                        ...(userProfile.privacySettings || { shareTagsWithPublicNotes: true, shareValuesWithPublicNotes: true }), // keep other settings if they exist
                        sharePublicNotesGlobally: checked,
                      },
                    });
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="shareTagsWithPublicNotes" className="text-sm">Share Tags with Public Notes</Label>
                <p className="text-xs text-muted-foreground">
                  Include tags when sharing notes publicly.
                </p>
              </div>
              <Switch
                id="shareTagsWithPublicNotes"
                checked={userProfile?.privacySettings?.shareTagsWithPublicNotes || false}
                disabled={!userProfile?.privacySettings?.sharePublicNotesGlobally} // Disable if global public sharing is off
                onCheckedChange={(checked) => {
                  if (userProfile && userProfile.privacySettings) {
                    updateUserProfile({
                      ...userProfile,
                      privacySettings: {
                        ...userProfile.privacySettings,
                        shareTagsWithPublicNotes: checked,
                      },
                    });
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="shareValuesWithPublicNotes" className="text-sm">Share Values with Public Notes</Label>
                <p className="text-xs text-muted-foreground">
                  Include key-value pairs when sharing notes publicly.
                </p>
              </div>
              <Switch
                id="shareValuesWithPublicNotes"
                checked={userProfile?.privacySettings?.shareValuesWithPublicNotes || false}
                disabled={!userProfile?.privacySettings?.sharePublicNotesGlobally} // Disable if global public sharing is off
                onCheckedChange={(checked) => {
                  if (userProfile && userProfile.privacySettings) {
                    updateUserProfile({
                      ...userProfile,
                      privacySettings: {
                        ...userProfile.privacySettings,
                        shareValuesWithPublicNotes: checked,
                      },
                    });
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Palette size={16} />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Dark Mode</Label>
              <Switch
                checked={userProfile?.preferences.theme === 'dark'}
                onCheckedChange={toggleTheme}
              />
            </div>
          </CardContent>
        </Card>

        {/* AI Features */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap size={16} />
              AI Features
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Enable AI</Label>
                <p className="text-xs text-muted-foreground">
                  Requires local Ollama installation
                </p>
              </div>
              <Switch
                checked={userProfile?.preferences.aiEnabled || false}
                onCheckedChange={(checked) => {
                  if (userProfile) {
                    storeUpdateUserProfile({ // Use storeUpdateUserProfile
                      ...userProfile,
                      preferences: {
                        ...userProfile.preferences,
                        aiEnabled: checked,
                      },
                    });
                  }
                }}
              />
            </div>

            {userProfile?.preferences.aiEnabled && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="ollamaApiEndpoint" className="text-sm">Ollama API Endpoint</Label>
                  <Input
                    id="ollamaApiEndpoint"
                    value={userProfile.preferences.ollamaApiEndpoint || ""}
                    placeholder="e.g., http://localhost:11434"
                    onChange={(e) => {
                      if (userProfile) {
                        storeUpdateUserProfile({ // Use storeUpdateUserProfile
                          ...userProfile,
                          preferences: {
                            ...userProfile.preferences,
                            ollamaApiEndpoint: e.target.value,
                          },
                        });
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    The local API endpoint for your Ollama instance.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="geminiApiKey" className="text-sm">Google Gemini API Key</Label>
                  <Input
                    id="geminiApiKey"
                    type="password"
                    value={userProfile.preferences.geminiApiKey || ""}
                    placeholder="Enter your Gemini API Key"
                    onChange={(e) => {
                      if (userProfile) {
                        storeUpdateUserProfile({ // Use storeUpdateUserProfile
                          ...userProfile,
                          preferences: {
                            ...userProfile.preferences,
                            geminiApiKey: e.target.value,
                          },
                        });
                      }
                    }}
                  />
                   <p className="text-xs text-muted-foreground">
                    Your API key for Google Gemini (optional).
                  </p>
                </div>
              </>
            )}
            
            <p className="text-xs text-muted-foreground">
              AI features can help with ontology suggestions, auto-tagging, and summarization. Configure your preferred provider.
            </p>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Data Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start"
              onClick={handleExportData}
            >
              <Download size={16} className="mr-2" />
              Export Data
            </Button>
            
            <div>
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
                id="import-file"
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start"
                onClick={() => document.getElementById('import-file')?.click()}
              >
                <Upload size={16} className="mr-2" />
                Import Data
              </Button>
            </div>
            
            <Button 
              variant="destructive" 
              size="sm" 
              className="w-full justify-start"
              onClick={handleClearData}
            >
              <Trash2 size={16} className="mr-2" />
              Clear All Data
            </Button>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">About Notention</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>
              Notention is a decentralized note-taking app with semantic 
              structure and Nostr integration.
            </p>
            <p>
              Version 0.6.0 (Implementing Phase 6)
            </p>
            <p>
              Your data is stored locally in your browser and can be optionally shared via the
              decentralized Nostr network according to your privacy settings.
            </p>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}