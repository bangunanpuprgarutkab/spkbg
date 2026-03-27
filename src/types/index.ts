/**
 * DATA MODEL - TypeScript Types & JSON Schemas
 * Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)
 */

// ============================================================
// 1. ENUM TYPES
// ============================================================

export type UserRole = 'admin' | 'surveyor' | 'verifikator' | 'approver';

export type WorkflowStatus = 
  | 'disposisi' 
  | 'persiapan' 
  | 'survey' 
  | 'analisis' 
  | 'penilaian' 
  | 'diperiksa' 
  | 'disetujui' 
  | 'ditolak';

export type ComponentCategory = 'struktur' | 'arsitektur' | 'utilitas' | 'finishing';

export type DamageClassification = '1' | '2' | '3' | '4' | '5' | '6' | '7';

export type DamageCategory = 'ringan' | 'sedang' | 'berat';

export type TemplateType = 'excel' | 'pdf' | 'docx';

export type NotificationType = 'info' | 'warning' | 'success' | 'error';

// ============================================================
// 2. CORE INTERFACES
// ============================================================

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  nip?: string; // Nomor Induk Pegawai
  jabatan?: string;
  instansi?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  file_path: string;
  file_name: string;
  version: string;
  template_type: TemplateType;
  max_lantai?: number;
  is_active: boolean;
  metadata?: TemplateMetadata;
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateMetadata {
  sheets: SheetMetadata[];
  structure: ColumnMapping[];
  formulas?: Record<string, string>;
  styles?: Record<string, unknown>;
}

export interface SheetMetadata {
  name: string;
  index: number;
  headers: string[];
  data_range: string;
}

export interface ColumnMapping {
  excel_column: string;
  json_field: string;
  data_type: 'string' | 'number' | 'boolean' | 'date';
  is_required: boolean;
  validation_rules?: ValidationRule[];
}

export interface ValidationRule {
  type: 'min' | 'max' | 'range' | 'regex' | 'enum';
  value: unknown;
  message: string;
}

export interface TemplateMapping {
  id: string;
  template_id: string;
  excel_column: string;
  json_field: string;
  db_field: string;
  data_type: string;
  is_required: boolean;
  validation_rules?: Record<string, unknown>;
  created_at: string;
}

// ============================================================
// 3. PROJECT & SURVEY
// ============================================================

export interface Project {
  id: string;
  kode_project: string;
  nama_bangunan: string;
  alamat: string;
  kelurahan?: string;
  kecamatan?: string;
  kota?: string;
  provinsi?: string;
  kode_pos?: string;
  jumlah_lantai: number;
  luas_tanah?: number;
  luas_bangunan?: number;
  tahun_pembangunan?: number;
  jenis_bangunan?: string;
  pemilik_bangunan?: string;
  pengguna_bangunan?: string;
  status_bangunan?: string;
  koordinat_lat?: number;
  koordinat_lng?: number;
  template_id?: string;
  status_workflow: WorkflowStatus;
  created_by?: string;
  assigned_surveyor?: string;
  assigned_verifikator?: string;
  assigned_approver?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface ProjectInput {
  nama_bangunan: string;
  alamat: string;
  kelurahan?: string;
  kecamatan?: string;
  kota?: string;
  provinsi?: string;
  kode_pos?: string;
  jumlah_lantai: number;
  luas_tanah?: number;
  luas_bangunan?: number;
  tahun_pembangunan?: number;
  jenis_bangunan?: string;
  pemilik_bangunan?: string;
  pengguna_bangunan?: string;
  status_bangunan?: string;
  koordinat_lat?: number;
  koordinat_lng?: number;
  template_id?: string;
}

export interface Survey {
  id: string;
  project_id: string;
  kode_survey: string;
  tanggal_survey: string;
  surveyor_id?: string;
  verifikator_id?: string;
  approver_id?: string;
  
  // Tahap 1: Safety Check
  has_kolom_patah: boolean;
  has_pondasi_bergeser: boolean;
  has_struktur_runtuh: boolean;
  is_critical: boolean;
  
  // Kondisi umum
  kondisi_umum?: string;
  catatan_umum?: string;
  rekomendasi?: string;
  
  // Status
  status: WorkflowStatus;
  is_draft: boolean;
  
  // Metadata
  weather_condition?: string;
  temperature?: number;
  humidity?: number;
  
  created_at: string;
  updated_at: string;
  submitted_at?: string;
  completed_at?: string;
}

export interface SurveyInput {
  project_id: string;
  tanggal_survey: string;
  kondisi_umum?: string;
  catatan_umum?: string;
  rekomendasi?: string;
  weather_condition?: string;
  temperature?: number;
  humidity?: number;
}

export interface SafetyCheck {
  has_kolom_patah: boolean;
  has_pondasi_bergeser: boolean;
  has_struktur_runtuh: boolean;
}

// ============================================================
// 4. COMPONENTS
// ============================================================

export interface Component {
  id: string;
  survey_id: string;
  
  // Identifikasi
  kode_komponen: string;
  nama_komponen: string;
  kategori: ComponentCategory;
  sub_kategori?: string;
  
  // Volume
  volume_total: number;
  volume_rusak: number;
  satuan: string;
  
  // Dimensi
  dimensi?: ComponentDimensions;
  
  // Klasifikasi
  klasifikasi?: DamageClassification;
  nilai_kerusakan?: number;
  
  // Bobot
  bobot_komponen: number;
  
  // Keterangan
  deskripsi_kerusakan?: string;
  lokasi_spesifik?: string;
  foto_urls?: string[];
  
  // Hasil
  nilai_hasil?: number;
  
  // Status
  is_draft: boolean;
  created_at: string;
  updated_at: string;
}

export interface ComponentDimensions {
  panjang?: number;
  lebar?: number;
  tinggi?: number;
  jumlah?: number;
  luas?: number;
  [key: string]: number | undefined;
}

export interface ComponentInput {
  kode_komponen: string;
  nama_komponen: string;
  kategori: ComponentCategory;
  sub_kategori?: string;
  volume_total: number;
  volume_rusak: number;
  satuan?: string;
  dimensi?: ComponentDimensions;
  klasifikasi?: DamageClassification;
  deskripsi_kerusakan?: string;
  lokasi_spesifik?: string;
  foto_urls?: string[];
}

export interface ComponentDefinition {
  id: string;
  template_id?: string;
  kode_komponen: string;
  nama_komponen: string;
  kategori: ComponentCategory;
  sub_kategori?: string;
  bobot_komponen: number;
  satuan: string;
  urutan: number;
  is_active: boolean;
  metadata?: ComponentMetadata;
  created_at: string;
}

export interface ComponentMetadata {
  aturan_validasi?: string[];
  catatan_teknis?: string;
  contoh_perhitungan?: string;
  gambar_referensi?: string[];
}

// ============================================================
// 5. CALCULATION & RESULTS
// ============================================================

export interface CalculationResult {
  id: string;
  survey_id: string;
  
  // Tahap 1
  is_critical: boolean;
  critical_reasons?: string[];
  
  // Tahap 2 - Totals per kategori
  total_kerusakan_struktur: number;
  total_kerusakan_arsitektur: number;
  total_kerusakan_utilitas: number;
  total_kerusakan_finishing: number;
  
  // Total keseluruhan
  total_kerusakan: number;
  kategori_kerusakan?: DamageCategory;
  
  // Detail
  detail_perhitungan?: DamageDetail[];
  
  // Approval
  calculated_at?: string;
  calculated_by?: string;
  verified_at?: string;
  verified_by?: string;
  approved_at?: string;
  approved_by?: string;
  
  created_at: string;
  updated_at: string;
}

export interface DamageDetail {
  komponen_id: string;
  kode_komponen: string;
  nama_komponen: string;
  kategori: ComponentCategory;
  volume_total: number;
  volume_rusak: number;
  klasifikasi: DamageClassification;
  nilai_kerusakan: number;
  bobot_komponen: number;
  nilai_hasil: number;
}

export interface CalculationInput {
  components: Component[];
  safety_check: SafetyCheck;
}

// ============================================================
// 6. WORKFLOW
// ============================================================

export interface WorkflowLog {
  id: string;
  survey_id: string;
  project_id: string;
  
  // Transition
  from_status: WorkflowStatus;
  to_status: WorkflowStatus;
  actor_id?: string;
  actor_role?: UserRole;
  
  // Detail
  action: string;
  note?: string;
  ip_address?: string;
  user_agent?: string;
  
  // Metadata
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface WorkflowContext {
  user: User;
  project: Project;
  survey: Survey;
  results?: CalculationResult;
  fromStatus: WorkflowStatus;
  toStatus: WorkflowStatus;
  action: string;
  note?: string;
}

export interface WorkflowTransition {
  from: WorkflowStatus;
  to: WorkflowStatus;
  action: string;
  label: string;
  allowedRoles: UserRole[];
}

export interface WorkflowState {
  id: WorkflowStatus;
  label: string;
  description: string;
  allowedRoles: UserRole[];
  editableFields: string[];
  actions: string[];
  isFinal?: boolean;
  isFailure?: boolean;
}

// ============================================================
// 7. SIGNATURE (TTE)
// ============================================================

export interface Signature {
  id: string;
  survey_id: string;
  
  // Signer
  signed_by?: string;
  signer_name: string;
  signer_nip?: string;
  signer_jabatan?: string;
  signer_role: UserRole;
  
  // Signature data
  signature_url: string;
  signature_hash?: string;
  
  // Context
  signature_type: 'surveyor' | 'verifikator' | 'approver';
  page_number?: number;
  position_x?: number;
  position_y?: number;
  
  // Timestamp
  signed_at: string;
  
  // Verification
  verified: boolean;
  verified_at?: string;
  verified_by?: string;
}

export interface SignatureInput {
  survey_id: string;
  signature_data: string; // Base64 or SVG
  signature_type: 'surveyor' | 'verifikator' | 'approver';
  page_number?: number;
  position_x?: number;
  position_y?: number;
}

// ============================================================
// 8. EXPORT
// ============================================================

export interface Export {
  id: string;
  survey_id: string;
  
  export_type: 'excel' | 'pdf' | 'google_sheets' | 'google_docs';
  file_name: string;
  file_url?: string;
  file_size?: number;
  
  // Google
  google_file_id?: string;
  google_drive_url?: string;
  
  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  
  // Metadata
  exported_by?: string;
  exported_at: string;
  downloaded_at?: string;
  download_count: number;
}

export interface ExportRequest {
  survey_id: string;
  export_type: 'excel' | 'pdf' | 'google_sheets' | 'google_docs';
  use_template?: boolean;
  template_id?: string;
}

// ============================================================
// 9. NOTIFICATIONS
// ============================================================

export interface Notification {
  id: string;
  user_id: string;
  
  title: string;
  message: string;
  type: NotificationType;
  
  // Link
  entity_type?: 'survey' | 'project' | 'workflow';
  entity_id?: string;
  link?: string;
  
  // Status
  is_read: boolean;
  read_at?: string;
  
  created_at: string;
}

export interface NotificationInput {
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  entity_type?: 'survey' | 'project' | 'workflow';
  entity_id?: string;
  link?: string;
}

// ============================================================
// 10. API RESPONSES
// ============================================================

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMeta {
  page?: number;
  per_page?: number;
  total?: number;
  total_pages?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: ResponseMeta;
}

// ============================================================
// 11. VIEW MODELS
// ============================================================

export interface SurveySummary {
  survey_id: string;
  kode_survey: string;
  tanggal_survey: string;
  status: WorkflowStatus;
  is_critical: boolean;
  
  project_id: string;
  kode_project: string;
  nama_bangunan: string;
  jumlah_lantai: number;
  alamat: string;
  kota?: string;
  
  surveyor_name?: string;
  verifikator_name?: string;
  approver_name?: string;
  
  total_kerusakan?: number;
  kategori_kerusakan?: DamageCategory;
  jumlah_komponen: number;
  
  created_at: string;
  updated_at: string;
}

export interface ProjectProgress {
  project_id: string;
  kode_project: string;
  nama_bangunan: string;
  status_workflow: WorkflowStatus;
  
  jumlah_survey: number;
  survey_selesai: number;
  last_completed?: string;
  
  progress_percentage: number;
}

export interface WorkflowTimeline {
  id: string;
  survey_id: string;
  kode_survey: string;
  nama_bangunan: string;
  
  from_status: WorkflowStatus;
  to_status: WorkflowStatus;
  action: string;
  
  actor_name?: string;
  actor_role?: UserRole;
  note?: string;
  
  created_at: string;
  prev_timestamp?: string;
  duration?: string;
}

// ============================================================
// 12. FORM STATE
// ============================================================

export interface SurveyFormState {
  // Step 1: Informasi Dasar
  informasi_dasar: {
    project_id: string;
    tanggal_survey: string;
    kondisi_umum: string;
    catatan_umum: string;
  };
  
  // Step 2: Safety Check (Tahap 1)
  safety_check: SafetyCheck;
  
  // Step 3: Komponen (Tahap 2)
  components: Record<string, ComponentFormState>; // key = kode_komponen
  
  // Step 4: Review
  review: {
    rekomendasi: string;
    catatan: string;
  };
}

export interface ComponentFormState {
  kode_komponen: string;
  dimensi: ComponentDimensions;
  volume_total: number;
  volume_rusak: number;
  klasifikasi: DamageClassification;
  deskripsi_kerusakan: string;
  lokasi_spesifik: string;
  foto_files?: File[];
}

// ============================================================
// 13. CONSTANTS & CONFIG
// ============================================================

export const CLASSIFICATION_VALUES: Record<DamageClassification, number> = {
  '1': 0.00,
  '2': 0.20,
  '3': 0.35,
  '4': 0.50,
  '5': 0.70,
  '6': 0.85,
  '7': 1.00
};

export const DAMAGE_CATEGORY_THRESHOLDS = {
  ringan: 30,
  sedang: 45,
  berat: Infinity
};

export const WORKFLOW_STATES: WorkflowState[] = [
  {
    id: 'disposisi',
    label: 'Disposisi',
    description: 'Proyek baru didaftarkan',
    allowedRoles: ['admin', 'surveyor'],
    editableFields: ['all'],
    actions: ['prepare']
  },
  {
    id: 'persiapan',
    label: 'Persiapan',
    description: 'Menugaskan tim survey',
    allowedRoles: ['admin'],
    editableFields: ['assigned_surveyor', 'assigned_verifikator', 'assigned_approver'],
    actions: ['startSurvey']
  },
  {
    id: 'survey',
    label: 'Survey',
    description: 'Input data survei lapangan',
    allowedRoles: ['surveyor', 'admin'],
    editableFields: ['components', 'safety_check', 'kondisi_umum'],
    actions: ['saveDraft', 'submitSurvey']
  },
  {
    id: 'analisis',
    label: 'Analisis',
    description: 'Perhitungan otomatis sistem',
    allowedRoles: ['surveyor', 'verifikator', 'admin'],
    editableFields: [],
    actions: ['recalculate', 'completeAnalysis']
  },
  {
    id: 'penilaian',
    label: 'Penilaian',
    description: 'Review hasil perhitungan',
    allowedRoles: ['surveyor', 'admin'],
    editableFields: ['catatan', 'rekomendasi'],
    actions: ['submitForApproval']
  },
  {
    id: 'diperiksa',
    label: 'Diperiksa',
    description: 'Verifikator memeriksa hasil',
    allowedRoles: ['verifikator', 'admin'],
    editableFields: ['verification_note'],
    actions: ['approve', 'reject']
  },
  {
    id: 'disetujui',
    label: 'Disetujui',
    description: 'Survey telah disetujui',
    allowedRoles: ['approver', 'admin'],
    editableFields: [],
    actions: ['sign', 'export'],
    isFinal: true
  },
  {
    id: 'ditolak',
    label: 'Ditolak',
    description: 'Survey ditolak',
    allowedRoles: ['verifikator', 'admin'],
    editableFields: ['rejection_reason'],
    actions: ['returnToSurvey'],
    isFailure: true
  }
];

// ============================================================
// 14. UTILITY TYPES
// ============================================================

export type WithTimestamps<T> = T & {
  created_at: string;
  updated_at: string;
};

export type WithId<T> = T & {
  id: string;
};

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};

// ============================================================
// 15. VALIDATION SCHEMAS (Zod-compatible)
// ============================================================

export const userRoleSchema = {
  enum: ['admin', 'surveyor', 'verifikator', 'approver']
};

export const workflowStatusSchema = {
  enum: ['disposisi', 'persiapan', 'survey', 'analisis', 'penilaian', 'diperiksa', 'disetujui', 'ditolak']
};

export const componentCategorySchema = {
  enum: ['struktur', 'arsitektur', 'utilitas', 'finishing']
};

export const damageClassificationSchema = {
  enum: ['1', '2', '3', '4', '5', '6', '7']
};

export const damageCategorySchema = {
  enum: ['ringan', 'sedang', 'berat']
};

// JSON Schema untuk validasi form
export const projectInputSchema = {
  type: 'object',
  required: ['nama_bangunan', 'alamat', 'jumlah_lantai'],
  properties: {
    nama_bangunan: { type: 'string', minLength: 3, maxLength: 200 },
    alamat: { type: 'string', minLength: 5, maxLength: 500 },
    jumlah_lantai: { type: 'integer', minimum: 1, maximum: 50 },
    luas_tanah: { type: 'number', minimum: 0 },
    luas_bangunan: { type: 'number', minimum: 0 }
  }
};

export const componentInputSchema = {
  type: 'object',
  required: ['kode_komponen', 'nama_komponen', 'kategori', 'volume_total', 'volume_rusak'],
  properties: {
    kode_komponen: { type: 'string', minLength: 3, maxLength: 10 },
    nama_komponen: { type: 'string', minLength: 3, maxLength: 100 },
    kategori: componentCategorySchema,
    volume_total: { type: 'number', minimum: 0 },
    volume_rusak: { type: 'number', minimum: 0 },
    klasifikasi: damageClassificationSchema
  }
};

// ============================================================
// 16. COMPONENT CATALOG (MASTER DATA)
// ============================================================

export const MASTER_COMPONENTS: ComponentDefinition[] = [
  // STRUKTUR - Pondasi
  {
    id: 'def-pondasi-1',
    kode_komponen: 'P001',
    nama_komponen: 'Pondasi Tapak Beton',
    kategori: 'struktur',
    sub_kategori: 'pondasi',
    bobot_komponen: 0.075,
    satuan: 'm³',
    urutan: 1,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'def-pondasi-2',
    kode_komponen: 'P002',
    nama_komponen: 'Pondasi Telapak Beton',
    kategori: 'struktur',
    sub_kategori: 'pondasi',
    bobot_komponen: 0.075,
    satuan: 'm³',
    urutan: 2,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'def-pondasi-3',
    kode_komponen: 'P003',
    nama_komponen: 'Sloof Beton',
    kategori: 'struktur',
    sub_kategori: 'pondasi',
    bobot_komponen: 0.075,
    satuan: 'm³',
    urutan: 3,
    is_active: true,
    created_at: new Date().toISOString()
  },
  // STRUKTUR - Kolom
  {
    id: 'def-kolom-1',
    kode_komponen: 'K001',
    nama_komponen: 'Kolom K1 (Kolom Utama)',
    kategori: 'struktur',
    sub_kategori: 'kolom',
    bobot_komponen: 0.120,
    satuan: 'm³',
    urutan: 4,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'def-kolom-2',
    kode_komponen: 'K002',
    nama_komponen: 'Kolom K2 (Kolom Primer)',
    kategori: 'struktur',
    sub_kategori: 'kolom',
    bobot_komponen: 0.100,
    satuan: 'm³',
    urutan: 5,
    is_active: true,
    created_at: new Date().toISOString()
  },
  // STRUKTUR - Balok
  {
    id: 'def-balok-1',
    kode_komponen: 'B001',
    nama_komponen: 'Balok B1 (Balok Utama)',
    kategori: 'struktur',
    sub_kategori: 'balok',
    bobot_komponen: 0.100,
    satuan: 'm³',
    urutan: 6,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'def-balok-2',
    kode_komponen: 'B002',
    nama_komponen: 'Balok B2 (Balok Sekunder)',
    kategori: 'struktur',
    sub_kategori: 'balok',
    bobot_komponen: 0.080,
    satuan: 'm³',
    urutan: 7,
    is_active: true,
    created_at: new Date().toISOString()
  },
  // STRUKTUR - Tangga & Plat
  {
    id: 'def-tangga-1',
    kode_komponen: 'T001',
    nama_komponen: 'Tangga Beton',
    kategori: 'struktur',
    sub_kategori: 'tangga',
    bobot_komponen: 0.050,
    satuan: 'm³',
    urutan: 8,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'def-plat-1',
    kode_komponen: 'PL01',
    nama_komponen: 'Plat Lantai Beton',
    kategori: 'struktur',
    sub_kategori: 'plat',
    bobot_komponen: 0.150,
    satuan: 'm³',
    urutan: 9,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'def-plat-2',
    kode_komponen: 'PL02',
    nama_komponen: 'Plat Atap Beton',
    kategori: 'struktur',
    sub_kategori: 'plat',
    bobot_komponen: 0.100,
    satuan: 'm³',
    urutan: 10,
    is_active: true,
    created_at: new Date().toISOString()
  },
  // STRUKTUR - Atap
  {
    id: 'def-atap-1',
    kode_komponen: 'A001',
    nama_komponen: 'Rangka Atap Baja',
    kategori: 'struktur',
    sub_kategori: 'atap',
    bobot_komponen: 0.075,
    satuan: 'm²',
    urutan: 11,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'def-atap-2',
    kode_komponen: 'A002',
    nama_komponen: 'Rangka Atap Kayu',
    kategori: 'struktur',
    sub_kategori: 'atap',
    bobot_komponen: 0.075,
    satuan: 'm²',
    urutan: 12,
    is_active: true,
    created_at: new Date().toISOString()
  }
  // ... (lanjutkan untuk komponen lainnya)
];

// ============================================================
// 17. TYPE GUARDS
// ============================================================

export const isValidUserRole = (role: string): role is UserRole => {
  return ['admin', 'surveyor', 'verifikator', 'approver'].includes(role);
};

export const isValidWorkflowStatus = (status: string): status is WorkflowStatus => {
  return ['disposisi', 'persiapan', 'survey', 'analisis', 'penilaian', 'diperiksa', 'disetujui', 'ditolak'].includes(status);
};

export const isValidComponentCategory = (category: string): category is ComponentCategory => {
  return ['struktur', 'arsitektur', 'utilitas', 'finishing'].includes(category);
};

export const isValidDamageClassification = (value: string): value is DamageClassification => {
  return ['1', '2', '3', '4', '5', '6', '7'].includes(value);
};

export const isValidDamageCategory = (category: string): category is DamageCategory => {
  return ['ringan', 'sedang', 'berat'].includes(category);
};

// ============================================================
// 18. MAPPER FUNCTIONS
// ============================================================

export const mapDamageClassificationToValue = (classification: DamageClassification): number => {
  return CLASSIFICATION_VALUES[classification];
};

export const mapTotalDamageToCategory = (total: number): DamageCategory => {
  if (total <= DAMAGE_CATEGORY_THRESHOLDS.ringan) return 'ringan';
  if (total <= DAMAGE_CATEGORY_THRESHOLDS.sedang) return 'sedang';
  return 'berat';
};

export const mapCategoryToLabel = (category: DamageCategory): string => {
  const labels: Record<DamageCategory, string> = {
    ringan: 'Ringan (≤30%)',
    sedang: 'Sedang (30-45%)',
    berat: 'Berat (>45%)'
  };
  return labels[category];
};

export const mapStatusToLabel = (status: WorkflowStatus): string => {
  const labels: Record<WorkflowStatus, string> = {
    disposisi: 'Disposisi',
    persiapan: 'Persiapan',
    survey: 'Survey',
    analisis: 'Analisis',
    penilaian: 'Penilaian',
    diperiksa: 'Diperiksa',
    disetujui: 'Disetujui',
    ditolak: 'Ditolak'
  };
  return labels[status];
};

export const mapRoleToLabel = (role: UserRole): string => {
  const labels: Record<UserRole, string> = {
    admin: 'Administrator',
    surveyor: 'Surveyor',
    verifikator: 'Verifikator',
    approver: 'Approver'
  };
  return labels[role];
};
