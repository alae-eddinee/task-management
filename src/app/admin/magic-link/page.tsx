'use client';

import { useState } from 'react';
import { Button, Input, Card } from '@/components/ui';

export default function MagicLinkGenerator() {
  const [email, setEmail] = useState('');
  const [magicLink, setMagicLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMagicLink('');
    setCopied(false);

    try {
      const response = await fetch('/api/admin/generate-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate magic link');
      }

      setMagicLink(data.magicLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(magicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen p-8">
      <Card className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Magic Link Generator</h1>
          <p className="text-[var(--foreground-secondary)] mt-2">
            Generate direct login links for managers
          </p>
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          <Input
            label="Manager Email"
            type="email"
            placeholder="Enter manager's email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {error && (
            <p className="text-sm text-[var(--danger)]">{error}</p>
          )}

          <Button type="submit" className="w-full" loading={loading}>
            Generate Magic Link
          </Button>
        </form>

        {magicLink && (
          <div className="mt-6 p-4 bg-[var(--background-secondary)] rounded-lg">
            <p className="text-sm font-medium mb-2">Magic Link (valid for 7 days):</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={magicLink}
                readOnly
                className="flex-1 p-2 text-sm bg-white dark:bg-gray-800 border border-[var(--border)] rounded"
              />
              <Button onClick={copyToClipboard} variant="secondary">
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <p className="text-xs text-[var(--foreground-tertiary)] mt-2">
              Share this link with the manager. They can use it once to log in directly.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
