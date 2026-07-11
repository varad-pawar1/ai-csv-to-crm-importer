'use client';

import { useMemo } from 'react';
import { DuplicateGroup } from '@/types/crm';
import { normalizeEmail, normalizePhone } from '@/lib/csvParser';

export function useDuplicates(rows: Record<string, string>[], headers: string[]) {
  return useMemo(() => {
    const emailHeader = headers.find((h) => /email/i.test(h));
    const phoneHeader = headers.find((h) => /phone|mobile|mob/i.test(h));

    const emailMap = new Map<string, number[]>();
    const phoneMap = new Map<string, number[]>();

    rows.forEach((row, index) => {
      if (emailHeader && row[emailHeader]) {
        const key = normalizeEmail(row[emailHeader]);
        if (key) {
          const existing = emailMap.get(key) ?? [];
          existing.push(index);
          emailMap.set(key, existing);
        }
      }
      if (phoneHeader && row[phoneHeader]) {
        const key = normalizePhone(row[phoneHeader]);
        if (key.length >= 7) {
          const existing = phoneMap.get(key) ?? [];
          existing.push(index);
          phoneMap.set(key, existing);
        }
      }
    });

    const duplicates: DuplicateGroup[] = [];

    for (const [key, indices] of Array.from(emailMap.entries())) {
      if (indices.length > 1) {
        duplicates.push({ key, type: 'email', rowIndices: indices });
      }
    }
    for (const [key, indices] of Array.from(phoneMap.entries())) {
      if (indices.length > 1) {
        duplicates.push({ key, type: 'phone', rowIndices: indices });
      }
    }

    return duplicates;
  }, [rows, headers]);
}
