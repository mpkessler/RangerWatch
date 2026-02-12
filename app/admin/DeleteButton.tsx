'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteButton({ sighting_id }: { sighting_id: string }) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm('Soft-delete this sighting?')) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sighting_id }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error ?? 'Delete failed');
      }
    } catch {
      alert('Network error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-red-500 hover:text-red-300 disabled:text-slate-600 px-2 py-1 rounded hover:bg-red-900/30 transition-colors text-xs"
    >
      {deleting ? '…' : 'Delete'}
    </button>
  );
}
