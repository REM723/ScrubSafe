// ─── Semantic categories ──────────────────────────────────────────────────────

export type MetadataCategory =
  | 'identity'   // author, copyright, contact info
  | 'location'   // GPS coordinates and place names
  | 'device'     // camera make/model, lens, settings
  | 'software'   // editing tools, processing pipeline
  | 'history'    // capture and modification timestamps
  | 'other';     // any field that doesn't fit above

// ─── Field representation ─────────────────────────────────────────────────────

export interface MetadataField {
  key: string;               // "group/TagName" — e.g. "gps/GPSLatitude"
  label: string;             // Human-readable — e.g. "GPS Latitude"
  category: MetadataCategory;
  value: string;             // Always stringified for display
  sensitive: boolean;        // True for fields that can identify people or location
}

// ─── Snapshots ────────────────────────────────────────────────────────────────

export interface MetadataSnapshot {
  fields: MetadataField[];
}

// ─── Report (worker → main thread) ───────────────────────────────────────────

export interface MetadataReport {
  before: MetadataSnapshot;   // metadata extracted from the original file
  after: MetadataSnapshot;    // metadata remaining in the cleaned file
  originalSize: number;       // bytes
  cleanSize: number;          // bytes
}

// ─── Scrub profile ────────────────────────────────────────────────────────────

export interface ScrubProfile {
  removeGps: boolean;
  removeDevice: boolean;
  removeAuthor: boolean;
  removeSoftware: boolean;
  removeHistory: boolean;
}
