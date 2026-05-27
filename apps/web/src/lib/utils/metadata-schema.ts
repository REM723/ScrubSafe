import type { MetadataCategory, MetadataField } from '@scrubsafe/shared-types';

// ─── Known-field registry ─────────────────────────────────────────────────────
// Keyed by "group/TagName" matching exifr's mergeOutput:false group names.

interface FieldMeta {
  label: string;
  category: MetadataCategory;
  sensitive: boolean;
}

const FIELD_MAP: Record<string, FieldMeta> = {
  // ── GPS / Location ───────────────────────────────────────────────────────
  'gps/GPSLatitude':        { label: 'GPS Latitude',        category: 'location',  sensitive: true  },
  'gps/GPSLatitudeRef':     { label: 'GPS Latitude Ref',    category: 'location',  sensitive: true  },
  'gps/GPSLongitude':       { label: 'GPS Longitude',       category: 'location',  sensitive: true  },
  'gps/GPSLongitudeRef':    { label: 'GPS Longitude Ref',   category: 'location',  sensitive: true  },
  'gps/GPSAltitude':        { label: 'GPS Altitude',        category: 'location',  sensitive: true  },
  'gps/GPSAltitudeRef':     { label: 'GPS Altitude Ref',    category: 'location',  sensitive: true  },
  'gps/GPSSpeed':           { label: 'GPS Speed',           category: 'location',  sensitive: true  },
  'gps/GPSSpeedRef':        { label: 'GPS Speed Ref',       category: 'location',  sensitive: true  },
  'gps/GPSImgDirection':    { label: 'GPS Direction',       category: 'location',  sensitive: true  },
  'gps/GPSImgDirectionRef': { label: 'GPS Direction Ref',   category: 'location',  sensitive: true  },
  'gps/GPSTimestamp':       { label: 'GPS Timestamp',       category: 'location',  sensitive: true  },
  'gps/GPSDateStamp':       { label: 'GPS Date',            category: 'location',  sensitive: true  },
  'gps/GPSDestLatitude':    { label: 'GPS Dest Latitude',   category: 'location',  sensitive: true  },
  'gps/GPSDestLongitude':   { label: 'GPS Dest Longitude',  category: 'location',  sensitive: true  },
  'gps/GPSHPositioningError':{ label: 'GPS Accuracy',       category: 'location',  sensitive: true  },

  // ── Identity ─────────────────────────────────────────────────────────────
  'ifd0/Artist':            { label: 'Artist',              category: 'identity',  sensitive: true  },
  'ifd0/Copyright':         { label: 'Copyright',           category: 'identity',  sensitive: true  },
  'ifd0/ImageDescription':  { label: 'Image Description',   category: 'identity',  sensitive: false },
  'exif/CameraOwnerName':   { label: 'Camera Owner',        category: 'identity',  sensitive: true  },
  'exif/BodySerialNumber':  { label: 'Camera Serial No.',   category: 'identity',  sensitive: true  },
  'exif/LensSerialNumber':  { label: 'Lens Serial No.',     category: 'identity',  sensitive: true  },
  'exif/ImageUniqueID':     { label: 'Image Unique ID',     category: 'identity',  sensitive: true  },
  'iptc/By-line':           { label: 'Author (IPTC)',       category: 'identity',  sensitive: true  },
  'iptc/CopyrightNotice':   { label: 'Copyright (IPTC)',    category: 'identity',  sensitive: true  },
  'iptc/Contact':           { label: 'Contact (IPTC)',      category: 'identity',  sensitive: true  },
  'xmp/Creator':            { label: 'Creator (XMP)',       category: 'identity',  sensitive: true  },
  'xmp/Rights':             { label: 'Rights (XMP)',        category: 'identity',  sensitive: false },

  // ── Device ───────────────────────────────────────────────────────────────
  'ifd0/Make':              { label: 'Camera Make',         category: 'device',    sensitive: false },
  'ifd0/Model':             { label: 'Camera Model',        category: 'device',    sensitive: false },
  'ifd0/HostComputer':      { label: 'Host Computer',       category: 'device',    sensitive: false },
  'exif/LensModel':         { label: 'Lens Model',          category: 'device',    sensitive: false },
  'exif/LensMake':          { label: 'Lens Make',           category: 'device',    sensitive: false },
  'exif/FocalLength':       { label: 'Focal Length',        category: 'device',    sensitive: false },
  'exif/FocalLengthIn35mmFormat': { label: 'Focal Length (35mm)', category: 'device', sensitive: false },
  'exif/FNumber':           { label: 'Aperture',            category: 'device',    sensitive: false },
  'exif/ExposureTime':      { label: 'Exposure Time',       category: 'device',    sensitive: false },
  'exif/ISO':               { label: 'ISO Speed',           category: 'device',    sensitive: false },
  'exif/ISOSpeedRatings':   { label: 'ISO Speed',           category: 'device',    sensitive: false },
  'exif/Flash':             { label: 'Flash',               category: 'device',    sensitive: false },
  'exif/ExposureMode':      { label: 'Exposure Mode',       category: 'device',    sensitive: false },
  'exif/ExposureProgram':   { label: 'Exposure Program',    category: 'device',    sensitive: false },
  'exif/MeteringMode':      { label: 'Metering Mode',       category: 'device',    sensitive: false },
  'exif/WhiteBalance':      { label: 'White Balance',       category: 'device',    sensitive: false },
  'exif/DigitalZoomRatio':  { label: 'Digital Zoom',        category: 'device',    sensitive: false },
  'exif/SceneCaptureType':  { label: 'Scene Capture Type',  category: 'device',    sensitive: false },
  'exif/Sharpness':         { label: 'Sharpness',           category: 'device',    sensitive: false },
  'exif/Saturation':        { label: 'Saturation',          category: 'device',    sensitive: false },
  'exif/Contrast':          { label: 'Contrast',            category: 'device',    sensitive: false },

  // ── Software ─────────────────────────────────────────────────────────────
  'ifd0/Software':          { label: 'Software',            category: 'software',  sensitive: false },
  'xmp/CreatorTool':        { label: 'Creator Tool (XMP)',  category: 'software',  sensitive: false },
  'xmp/ProcessingSoftware': { label: 'Processing Software', category: 'software',  sensitive: false },

  // ── History ──────────────────────────────────────────────────────────────
  // exifr renames IFD0 tag 0x0132 from "DateTime" to "ModifyDate"
  'ifd0/ModifyDate':        { label: 'File Modified',       category: 'history',   sensitive: false },
  'exif/DateTimeOriginal':  { label: 'Date Taken',          category: 'history',   sensitive: false },
  'exif/DateTimeDigitized': { label: 'Date Digitized',      category: 'history',   sensitive: false },
  'exif/OffsetTime':        { label: 'Timezone Offset',     category: 'history',   sensitive: false },
  'xmp/CreateDate':         { label: 'Create Date (XMP)',   category: 'history',   sensitive: false },
  'xmp/ModifyDate':         { label: 'Modify Date (XMP)',   category: 'history',   sensitive: false },
  'xmp/MetadataDate':       { label: 'Metadata Date (XMP)', category: 'history',   sensitive: false },
};

// ─── Fallback categorisation ──────────────────────────────────────────────────

const CATEGORY_PATTERNS: Array<[RegExp, MetadataCategory]> = [
  [/GPS|LOCATION|COUNTRY|CITY|STATE|PLACE|REGION|SUBURB/i, 'location'],
  [/AUTHOR|ARTIST|COPYRIGHT|OWNER|CREATOR|CONTACT|BYLINE|BY-LINE|RIGHTS|EMAIL|PHONE/i, 'identity'],
  [/SERIAL|MAKE|MODEL|LENS|CAMERA|DEVICE|SENSOR|FLASH|FOCAL|APERTURE|ISO|EXPOSURE|METER|WHITE|SCENE|ZOOM/i, 'device'],
  [/SOFTWARE|TOOL|PRODUCER|APPLICA|GENERATOR|PROGRAM|ENCODER/i, 'software'],
  [/DATE|TIME|HISTORY|MODIF|CREAT|DIGIT|ORIGIN/i, 'history'],
];

function inferCategory(group: string, tagName: string): MetadataCategory {
  if (group === 'gps') return 'location';
  for (const [re, cat] of CATEGORY_PATTERNS) {
    if (re.test(tagName)) return cat;
  }
  return 'other';
}

// ─── Public helpers ───────────────────────────────────────────────────────────

export function buildField(group: string, tagName: string, value: unknown): MetadataField {
  const key = `${group}/${tagName}`;
  const known = FIELD_MAP[key];
  return {
    key,
    label: known?.label ?? tagName,
    category: known?.category ?? inferCategory(group, tagName),
    value: serialiseValue(value),
    sensitive: known?.sensitive ?? group === 'gps',
  };
}

function serialiseValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    // Rational: [[n,d], ...] → "41, 52, 41.16"
    if (Array.isArray(value[0])) {
      return (value as number[][])
        .map(([n, d]) => (d && d !== 0 ? n! / d : n ?? 0).toFixed(4).replace(/\.?0+$/, ''))
        .join(', ');
    }
    return value.map(String).join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
