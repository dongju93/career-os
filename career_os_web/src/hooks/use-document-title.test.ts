import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useDocumentTitle } from './use-document-title';

describe('useDocumentTitle', () => {
  afterEach(() => {
    document.title = '';
  });

  it('suffixes the route label with the site name', () => {
    renderHook(() => useDocumentTitle('채용공고'));
    expect(document.title).toBe('채용공고 · Career OS');
  });

  it('falls back to the bare site name for an empty label', () => {
    renderHook(() => useDocumentTitle(''));
    expect(document.title).toBe('Career OS');
  });

  it('updates the title when the label changes', () => {
    const { rerender } = renderHook(
      ({ title }: { title: string }) => useDocumentTitle(title),
      { initialProps: { title: '프로필' } },
    );
    expect(document.title).toBe('프로필 · Career OS');

    rerender({ title: '지원 전략' });
    expect(document.title).toBe('지원 전략 · Career OS');
  });
});
