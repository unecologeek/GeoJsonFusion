// Basic GeoJSON Types
export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface GeoJSONMultiPoint {
  type: 'MultiPoint';
  coordinates: Array<[number, number]>;
}

export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: Array<[number, number]>;
}

export interface GeoJSONMultiLineString {
  type: 'MultiLineString';
  coordinates: Array<Array<[number, number]>>;
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: Array<Array<[number, number]>>;
}

export interface GeoJSONMultiPolygon {
  type: 'MultiPolygon';
  coordinates: Array<Array<Array<[number, number]>>>;
}

export interface GeoJSONGeometryCollection {
  type: 'GeometryCollection';
  geometries: Array<GeoJSONGeometry>;
}

export type GeoJSONGeometry =
  | GeoJSONPoint
  | GeoJSONMultiPoint
  | GeoJSONLineString
  | GeoJSONMultiLineString
  | GeoJSONPolygon
  | GeoJSONMultiPolygon
  | GeoJSONGeometryCollection;

export interface GeoJSONFeature<G extends GeoJSONGeometry | null = GeoJSONGeometry, P = any> {
  type: 'Feature';
  geometry: G;
  properties: P;
  id?: string | number;
}

export interface GeoJSONFeatureCollection<G extends GeoJSONGeometry | null = GeoJSONGeometry, P = any> {
  type: 'FeatureCollection';
  features: Array<GeoJSONFeature<G, P>>;
  crs?: any;
  name?: string;
  [key: string]: any; // Allow other properties
}

// Application Specific Types
export interface FileSource {
  key: string;
  name: string;
  path: string; // Changed from 'data' to 'path'
}

export interface CountryDetail {
  name: string;
  isDependency: boolean;
  sovereignState?: string;
}

export interface FileAnalysisResult {
  fileName: string;
  numFeatures: number;
  languages: string[];
  geometryPrecisionScore: number; // Sum of all coordinates
  maxCoordinatePrecision: number; // Maximum decimal places found in coordinates
  commonProperties: string[];
  potentialIdKeys: string[];
  countryNameProperty: string | null; // The property key used for country names
  sovereigntyPropertyKey: string | null; // The property key used for sovereignty
  countryDetails: CountryDetail[]; // List of extracted country details
}

export type MergeSourceOption = 'fileA' | 'fileB';

// Used for translationsSource
export interface PropertySourcePreference { 
  primary: MergeSourceOption | 'discard'; 
  additive: boolean;
}

// Specific for otherPropertiesSource to include 'discard'
export type OtherPropertiesPrimaryOption = MergeSourceOption | 'discard';

export interface OtherPropertyDetail {
  primary: OtherPropertiesPrimaryOption;
  additive: boolean;
  selectedProperties: Record<string, boolean>; 
}


export interface MergeConfig {
  idProperty: string;
  geometryPrecision: number; 
  geometrySource: { // MODIFIED HERE
    recognized: { additive: boolean };
    dependent: { additive: boolean };
  };
  translationsSource: {
    recognized: PropertySourcePreference;
    dependent: PropertySourcePreference;
  };
  otherPropertiesSource: {
    recognized: OtherPropertyDetail; 
    dependent: OtherPropertyDetail;   
  };
}

export type SetSelectedFileFn = (fileKey: string | null) => void;

// For CharacteristicControl's configKey prop
export type MergeConfigStructuredCharacteristicKey = 'translationsSource' | 'otherPropertiesSource'; 
export type MergeConfigEntitySubKey = 'recognized' | 'dependent';
export type MergeConfigPropertySubKey = 'primary' | 'additive' | 'toggleSelectedProperty' | 'setSelectedPropertiesMap';

export type SetMergeConfigFn = (
  key: MergeConfigStructuredCharacteristicKey | 'idProperty' | 'geometryPrecision' | 'geometrySource', // 'geometrySource' is for specific additive updates
  value: MergeSourceOption | boolean | string | { name: string; selected: boolean } | Record<string, boolean> | number, 
  entitySubKey?: MergeConfigEntitySubKey, 
  propertySubKey?: MergeConfigPropertySubKey 
) => void;