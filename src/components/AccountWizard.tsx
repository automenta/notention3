import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Terminal, Copy, Check } from 'lucide-react';
import { nostrService } from '../services/NostrService'; // For direct private key generation display

interface AccountWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountWizard({ isOpen, onClose }: AccountWizardProps) {
  const { userProfile, generateAndStoreNostrKeys, updateUserProfile } = useAppStore();
  const [step, setStep] = useState(1);
  const [generatedKeys, setGeneratedKeys] = useState<{ publicKey: string; privateKey: string } | null>(null);
  const [importedPrivateKey, setImportedPrivateKey] = useState<string>("");
  const [showImportField, setShowImportField] = useState<boolean>(false);
  const [privateKeyBackedUp, setPrivateKeyBackedUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedPub, setCopiedPub] = useState(false);
  const [copiedPriv, setCopiedPriv] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset state when dialog opens
      setStep(1);
      setGeneratedKeys(null);
      setImportedPrivateKey("");
      setShowImportField(false);
      setPrivateKeyBackedUp(false);
      setError(null);
      setCopiedPub(false);
      setCopiedPriv(false);
    }
  }, [isOpen]);

  const handleGenerateKeys = async () => {
    setError(null);
    setShowImportField(false); // Hide import field if user chooses to generate
    setImportedPrivateKey(""); // Clear imported key
    const { privateKey: sk, publicKey: pk } = nostrService.generateNewKeyPair();
    setGeneratedKeys({ publicKey: pk, privateKey: sk });
    setPrivateKeyBackedUp(false); // Reset backup confirmation for new keys
  };

  const handleImportPrivateKey = async () => {
    setError(null);
    if (!importedPrivateKey.trim().startsWith("nsec")) {
      setError("Invalid private key format. It should start with 'nsec'.");
      return;
    }
    try {
      // Validate and derive public key from the imported private key
      const pk = nostrService.getPublicKey(importedPrivateKey.trim()); // nostr-tools getPublicKey handles nsec
      // For display purposes, before saving.
      setGeneratedKeys({ publicKey: pk, privateKey: importedPrivateKey.trim() });
      setShowImportField(false); // Hide import field after successful import for display
      setPrivateKeyBackedUp(false); // User still needs to acknowledge they have this key
    } catch (e) {
      setError("Invalid private key. Could not derive public key.");
      console.error("Error deriving public key from imported private key:", e);
      setGeneratedKeys(null);
    }
  };

  const handleConfirmAndSaveKeys = async () => {
    if (!generatedKeys || !generatedKeys.privateKey || !generatedKeys.publicKey) {
      setError("Keys not available. Please generate or import keys.");
      return;
    }
    if (!privateKeyBackedUp) {
      setError("Please confirm you have backed up your private key.");
      return;
    }
    try {
      await generateAndStoreNostrKeys(generatedKeys.privateKey, generatedKeys.publicKey);
      setStep(3);
    } catch (e: any) {
      setError(`Failed to save keys: ${e.message}`);
      console.error("Failed to save keys during wizard:", e);
    }
  };

  const copyToClipboard = async (text: string, type: 'pub' | 'priv') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'pub') setCopiedPub(true);
      if (type === 'priv') setCopiedPriv(true);
      setTimeout(() => {
        if (type === 'pub') setCopiedPub(false);
        if (type === 'priv') setCopiedPriv(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard.');
    }
  };


  const renderStepContent = () => {
    switch (step) {
      case 1: // Welcome
        return (
          <>
            <DialogDescription className="my-4 text-sm text-muted-foreground">
              Welcome to Notention! To get started with decentralized features,
              you'll need a Nostr identity. This wizard will help you create or import one.
              Your identity is secured by a pair of cryptographic keys.
            </DialogDescription>
            <DialogFooter className="gap-2 sm:justify-start">
              <Button onClick={() => { setStep(2); setShowImportField(false); handleGenerateKeys(); }}>Create New Identity</Button>
              <Button variant="outline" onClick={() => { setStep(2); setShowImportField(true); setGeneratedKeys(null); }}>Import Existing Identity</Button>
            </DialogFooter>
          </>
        );
      case 2: // Key Generation / Import & Backup
        return (
          <>
            {!generatedKeys && showImportField ? (
              // Import Private Key UI
              <div className="space-y-4 my-4">
                <DialogDescription className="my-2 text-sm text-muted-foreground">
                  Paste your existing Nostr private key (starting with 'nsec') below.
                </DialogDescription>
                <div>
                  <Label htmlFor="importPrivateKey">Private Key (nsec)</Label>
                  <Input
                    id="importPrivateKey"
                    value={importedPrivateKey}
                    onChange={(e) => setImportedPrivateKey(e.target.value)}
                    placeholder="nsec1..."
                    className="font-mono text-xs"
                  />
                </div>
                <Button onClick={handleImportPrivateKey} className="w-full">Import Key</Button>
                <Button variant="link" onClick={() => {setShowImportField(false); setError(null); handleGenerateKeys(); }} className="text-xs">Or, generate new keys instead</Button>
              </div>
            ) : !generatedKeys && !showImportField ? (
                 // Initial state for step 2, before generation or import choice is fully processed
                <div className="my-4">
                    <DialogDescription className="my-2 text-sm text-muted-foreground">
                        Generating your new secure keys...
                    </DialogDescription>
                    {/* Optionally, a loading spinner here if generation was async, but it's sync */}
                </div>
            )
            : generatedKeys ? (
              // Display Generated or Imported Keys & Backup Prompt
              <div className="space-y-4 my-4">
                <Alert variant="default">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>{importedPrivateKey && generatedKeys.privateKey === importedPrivateKey ? "Keys Imported!" : "Keys Generated!"}</AlertTitle>
                  <AlertDescription>
                    Your identity keys are shown below.
                  </AlertDescription>
                </Alert>
                <div>
                  <Label htmlFor="publicKey">Public Key (npub)</Label>
                  <div className="flex items-center gap-2">
                    <Input id="publicKey" value={generatedKeys.publicKey} readOnly className="font-mono text-xs"/>
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(generatedKeys.publicKey, 'pub')}>
                      {copiedPub ? <Check size={16} /> : <Copy size={16} />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="privateKey">Private Key (nsec)</Label>
                   <div className="flex items-center gap-2">
                    <Input id="privateKey" value={generatedKeys.privateKey} readOnly className="font-mono text-xs"/>
                     <Button variant="outline" size="icon" onClick={() => copyToClipboard(generatedKeys.privateKey, 'priv')}>
                      {copiedPriv ? <Check size={16} /> : <Copy size={16} />}
                    </Button>
                  </div>
                </div>
                <Alert variant="destructive">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>CRITICAL: Secure Your Private Key!</AlertTitle>
                  <AlertDescription>
                    Your private key is your password. <strong>It cannot be recovered if lost.</strong>
                    Save it somewhere extremely safe and secret (e.g., a password manager, offline storage).
                    Do not share it with anyone. {importedPrivateKey && generatedKeys.privateKey === importedPrivateKey ? "Ensure you still have this key backed up." : "This is the ONLY time it will be shown to you by this app."}
                  </AlertDescription>
                </Alert>
                <div className="flex items-center space-x-2 mt-4">
                  <Checkbox
                    id="privateKeyBackedUp"
                    checked={privateKeyBackedUp}
                    onCheckedChange={(checked) => setPrivateKeyBackedUp(checked as boolean)}
                  />
                  <label
                    htmlFor="privateKeyBackedUp"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I understand the importance of the private key and have it securely stored.
                  </label>
                </div>
              </div>
            ) : null}

            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => { setStep(1); setGeneratedKeys(null); setShowImportField(false); setError(null); }}>Back</Button>
              <Button
                onClick={handleConfirmAndSaveKeys}
                disabled={!generatedKeys || !privateKeyBackedUp }
              >
                Confirm & Save Identity
              </Button>
            </DialogFooter>
          </>
        );
        case 3: // Finish
        return (
          <>
            <DialogDescription className="my-4 text-sm text-muted-foreground">
              Your Nostr identity has been set up and saved locally! You can manage your profile,
              relays, and privacy settings in the main Settings panel.
            </DialogDescription>
            <DialogFooter>
              <Button onClick={onClose}>Start Using Notention</Button>
            </DialogFooter>
          </>
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[525px]" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {step === 1 && "Welcome to Notention"}
            {step === 2 && (showImportField && !generatedKeys? "Import Existing Identity" : "Your Nostr Identity")}
            {step === 3 && "Setup Complete!"}
          </DialogTitle>
        </DialogHeader>
        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
}
