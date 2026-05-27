import type { MetadataSnapshot } from '@scrubsafe/shared-types';

export interface StripResult {
  clean: ArrayBuffer;
  before: MetadataSnapshot;
  after: MetadataSnapshot;
}

export async function stripOffice(_buffer: ArrayBuffer): Promise<StripResult> {
  throw new Error('Office processor not yet implemented — Phase 2');
}
