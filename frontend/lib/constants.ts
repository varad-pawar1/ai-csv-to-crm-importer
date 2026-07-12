export const TABLE_PAGE_SIZE = 20;
export const PREVIEW_PAGE_SIZE = 20;

/** Shared max content width for layout + header (1400px) */
export const CONTENT_MAX_WIDTH = 'max-w-[1400px]';

/** sessionStorage key — set when navigating from upload to job page */
export const IMPORT_PENDING_KEY = 'import-pending';

export const FILTER_LABELS = {
  all: 'All',
  imported: 'Imported',
  skipped: 'Skipped',
  'low-confidence': 'Low confidence',
} as const;
