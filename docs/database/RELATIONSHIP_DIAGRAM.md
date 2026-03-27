# Database Relationship Diagram
# Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)

## Entity Relationship Diagram (Text Format)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SUPABASE DATABASE                                    │
│                    Sistem Penilaian Kerusakan Bangunan Gedung                     │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   auth.users    │         │     users       │         │   templates     │
├─────────────────┤         ├─────────────────┤         ├─────────────────┤
│ id (PK)         │────────▶│ id (PK, FK)     │         │ id (PK)         │
│ email           │         │ email (UQ)      │         │ name            │
│ ...             │         │ name            │         │ file_path       │
│                 │         │ role (enum)     │         │ version         │
│                 │         │ phone           │         │ is_active       │
│                 │         │ nip             │         │ metadata (JSON) │
│                 │         │ instansi        │         │ uploaded_by(FK) │
│                 │         │ is_active       │         └────────┬────────┘
└─────────────────┘         │ created_at      │                  │
                            │ updated_at      │                  │
                            └─────────────────┘                  │
                                                                   │
                                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              template_mappings                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│ id (PK) │ template_id (FK) │ excel_column │ json_field │ db_field │ data_type    │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│    projects     │         │    surveys      │         │   components    │
├─────────────────┤         ├─────────────────┤         ├─────────────────┤
│ id (PK)         │         │ id (PK)         │         │ id (PK)         │
│ kode_project(UQ)│◀────────│ project_id (FK) │         │ survey_id (FK)  │
│ nama_bangunan   │         │ kode_survey(UQ) │         │ kode_komponen   │
│ alamat          │         │ tanggal_survey  │         │ nama_komponen   │
│ jumlah_lantai   │         │ surveyor_id(FK) │         │ kategori (enum) │
│ created_by (FK) │         │ template_id(FK) │         │ sub_kategori    │
│ assigned_* (FKs)│         │ status (enum)   │         │ volume_total    │
│ status (enum)   │         │ is_critical     │         │ volume_rusak    │
│ template_id(FK) │         │ is_draft        │         │ klasifikasi     │
└─────────────────┘         │ kondisi_umum    │         │ nilai_kerusakan │
                            │ catatan_umum    │         │ bobot_komponen  │
                            │ rekomendasi     │         │ nilai_hasil     │
                            │ created_at      │         │ is_draft        │
                            │ updated_at      │         │ created_at      │
                            └────────┬────────┘         │ updated_at      │
                                     │                  └─────────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │     results     │
                            ├─────────────────┤
                            │ id (PK)         │
                            │ survey_id (FK)  │
                            │ is_critical     │
                            │ total_struktur  │
                            │ total_arsitektur│
                            │ total_utilitas  │
                            │ total_finishing │
                            │ total_kerusakan │
                            │ kategori (enum) │
                            │ detail (JSON)   │
                            │ calculated_by   │
                            │ verified_by     │
                            │ approved_by     │
                            │ timestamps      │
                            └─────────────────┘

┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│ workflow_logs   │         │   signatures    │         │    exports      │
├─────────────────┤         ├─────────────────┤         ├─────────────────┤
│ id (PK)         │         │ id (PK)         │         │ id (PK)         │
│ survey_id (FK)  │         │ survey_id (FK)  │         │ survey_id (FK)  │
│ project_id (FK) │         │ signed_by (FK)│         │ export_type     │
│ from_status     │         │ signer_name     │         │ file_name       │
│ to_status       │         │ signer_nip      │         │ file_url        │
│ actor_id (FK)   │         │ signer_role     │         │ google_file_id  │
│ actor_role      │         │ signature_url   │         │ status          │
│ action          │         │ signature_hash  │         │ exported_by(FK) │
│ note            │         │ signature_type  │         │ exported_at     │
│ ip_address      │         │ signed_at       │         │ download_count  │
│ user_agent      │         │ verified        │         └─────────────────┘
│ metadata (JSON) │         └─────────────────┘
│ created_at      │
└─────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                          component_definitions (MASTER)                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│ id (PK) │ template_id(FK) │ kode │ nama │ kategori │ sub │ bobot │ satuan │ order │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│  notifications  │
├─────────────────┤
│ id (PK)         │
│ user_id (FK)    │
│ title           │
│ message         │
│ type            │
│ entity_type     │
│ entity_id       │
│ link            │
│ is_read         │
│ read_at         │
│ created_at      │
└─────────────────┘
```

## Foreign Key Relationships

| Table | Column | References | On Delete | On Update |
|-------|--------|------------|-----------|-----------|
| users | id | auth.users(id) | CASCADE | CASCADE |
| templates | uploaded_by | users(id) | SET NULL | CASCADE |
| template_mappings | template_id | templates(id) | CASCADE | CASCADE |
| projects | created_by | users(id) | SET NULL | CASCADE |
| projects | assigned_surveyor | users(id) | SET NULL | CASCADE |
| projects | assigned_verifikator | users(id) | SET NULL | CASCADE |
| projects | assigned_approver | users(id) | SET NULL | CASCADE |
| projects | template_id | templates(id) | SET NULL | CASCADE |
| surveys | project_id | projects(id) | CASCADE | CASCADE |
| surveys | surveyor_id | users(id) | SET NULL | CASCADE |
| surveys | verifikator_id | users(id) | SET NULL | CASCADE |
| surveys | approver_id | users(id) | SET NULL | CASCADE |
| surveys | template_id | templates(id) | SET NULL | CASCADE |
| components | survey_id | surveys(id) | CASCADE | CASCADE |
| component_definitions | template_id | templates(id) | CASCADE | CASCADE |
| results | survey_id | surveys(id) | CASCADE | CASCADE |
| results | calculated_by | users(id) | SET NULL | CASCADE |
| results | verified_by | users(id) | SET NULL | CASCADE |
| results | approved_by | users(id) | SET NULL | CASCADE |
| workflow_logs | survey_id | surveys(id) | CASCADE | CASCADE |
| workflow_logs | project_id | projects(id) | CASCADE | CASCADE |
| workflow_logs | actor_id | users(id) | SET NULL | CASCADE |
| signatures | survey_id | surveys(id) | CASCADE | CASCADE |
| signatures | signed_by | users(id) | SET NULL | CASCADE |
| signatures | verified_by | users(id) | SET NULL | CASCADE |
| exports | survey_id | surveys(id) | CASCADE | CASCADE |
| exports | exported_by | users(id) | SET NULL | CASCADE |
| notifications | user_id | users(id) | CASCADE | CASCADE |

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW PATTERNS                                │
└──────────────────────────────────────────────────────────────────────────────┘

1. PROJECT CREATION FLOW
═══════════════════════════════════════════════════════════════════════════════

   Admin/Surveyor                    Database                          System
        │                               │                                  │
        │ 1. Create Project             │                                  │
        │──────────────────────────────▶│                                  │
        │                               │ 2. Auto-generate kode_project    │
        │                               │─────────▶┌──────────────┐        │
        │                               │          │ generate_    │        │
        │                               │          │ project_code │        │
        │                               │◀─────────└──────────────┘        │
        │                               │ 3. Set status = 'disposisi'      │
        │                               │                                  │
        │ 4. Assign Roles               │                                  │
        │──────────────────────────────▶│                                  │
        │                               │ 5. Notify Surveyor               │
        │                               │─────────▶┌──────────────┐        │
        │                               │          │ notify_      │        │
        │                               │          │ surveyor_    │        │
        │                               │◀─────────│ assigned     │        │
        │                               │          └──────────────┘        │
        │                               │ 6. Insert notification           │
        │                               │                                  │

2. SURVEY WORKFLOW FLOW
═══════════════════════════════════════════════════════════════════════════════

   Surveyor                      Survey Table                    Workflow System
        │                               │                                  │
        │ 1. Start Survey               │                                  │
        │──────────────────────────────▶│                                  │
        │                               │ 2. Set status = 'survey'         │
        │                               │       is_draft = true            │
        │                               │                                  │
        │ 3. Add Components             │                                  │
        │──────────────────────────────▶│                                  │
        │                               │ 4. Trigger: calculate_value      │
        │                               │                                  │
        │ 5. Submit Survey              │                                  │
        │──────────────────────────────▶│                                  │
        │                               │ 6. Set is_draft = false          │
        │                               │    status = 'analisis'           │
        │                               │                                  │
        │                               │ 7. Trigger: log_workflow         │
        │                               │─────────▶┌──────────────┐        │
        │                               │          │ workflow_logs│        │
        │                               │          │ insert       │        │
        │                               │◀─────────└──────────────┘        │
        │                               │                                  │
        │                               │ 8. Trigger: calculate_damage     │
        │                               │─────────▶┌──────────────┐        │
        │                               │          │ calculate_   │        │
        │                               │          │ survey_damage│        │
        │                               │◀─────────└──────────────┘        │
        │                               │ 9. Update results table          │
        │                               │                                  │
        │                               │ 10. Trigger: notify_verifikator  │
        │                               │                                  │

3. APPROVAL FLOW
═══════════════════════════════════════════════════════════════════════════════

   Verifikator                   Survey Table                    Notification
        │                               │                                  │
        │ 1. Review & Approve           │                                  │
        │──────────────────────────────▶│                                  │
        │                               │ 2. Set status = 'disetujui'      │
        │                               │                                  │
        │                               │ 3. Trigger: log_workflow         │
        │                               │                                  │
        │                               │ 4. Update results.approved_*     │
        │                               │                                  │
        │                               │ 5. Notify Surveyor & Approver    │
        │                               │                                  │
        │ 6. Approver Signs             │                                  │
        │──────────────────────────────▶│                                  │
        │                               │ 7. Insert signature record       │
        │                               │                                  │

4. CALCULATION FLOW
═══════════════════════════════════════════════════════════════════════════════

   Component Change              Trigger                        Calculation
        │                               │                              Engine
        │ 1. INSERT/UPDATE              │                               │
        │──────────────────────────────▶│                               │
        │                               │ 2. Calculate nilai_hasil      │
        │                               │    = (vol_rusak/vol_total)    │
        │                               │      * nilai_klasifikasi      │
        │                               │      * bobot_komponen         │
        │                               │                               │
        │                               │ 3. If survey in analysis:     │
        │                               │──────────────────────────────▶│
        │                               │                               │
        │                               │◀──────────────────────────────│
        │                               │ 4. Recalculate totals         │
        │                               │    by category                │
        │                               │                               │
        │                               │ 5. Update results table       │
        │                               │                               │
```

## Cardinality Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CARDINALITY SUMMARY                                   │
└─────────────────────────────────────────────────────────────────────────────┘

auth.users (1) ────────────────────── (0..1) users
   │
   ├── (1) ────────────────────────── (0..N) projects (as created_by)
   ├── (1) ────────────────────────── (0..N) projects (as assigned_surveyor)
   ├── (1) ────────────────────────── (0..N) projects (as assigned_verifikator)
   ├── (1) ────────────────────────── (0..N) projects (as assigned_approver)
   ├── (1) ────────────────────────── (0..N) surveys (as surveyor)
   ├── (1) ────────────────────────── (0..N) surveys (as verifikator)
   ├── (1) ────────────────────────── (0..N) surveys (as approver)
   ├── (1) ────────────────────────── (0..N) templates (as uploaded_by)
   ├── (1) ────────────────────────── (0..N) workflow_logs (as actor)
   ├── (1) ────────────────────────── (0..N) signatures (as signed_by)
   ├── (1) ────────────────────────── (0..N) exports (as exported_by)
   └── (1) ────────────────────────── (0..N) notifications (as user)

templates (1) ─────────────────────── (0..N) template_mappings
   │
   ├── (1) ────────────────────────── (0..N) projects
   ├── (1) ────────────────────────── (0..N) surveys
   └── (1) ────────────────────────── (0..N) component_definitions

projects (1) ──────────────────────── (1..N) surveys
   │
   ├── (1) ────────────────────────── (0..N) workflow_logs
   └── (1) ────────────────────────── (0..1) project_progress (view)

surveys (1) ───────────────────────── (0..N) components
   │
   ├── (1) ────────────────────────── (0..N) workflow_logs
   ├── (1) ────────────────────────── (0..N) signatures
   ├── (1) ────────────────────────── (0..N) exports
   ├── (1) ────────────────────────── (0..1) results
   └── (1) ────────────────────────── (0..1) survey_summary (view)

component_definitions (N) ─────────── (1) component_category (enum)
```

## Constraints Summary

| Constraint Name | Table | Type | Definition |
|----------------|-------|------|------------|
| chk_volume_valid | components | CHECK | volume_rusak <= volume_total |
| chk_workflow_transition_valid | workflow_logs | CHECK | from_status != to_status |
| chk_survey_dates_valid | surveys | CHECK | submitted_at >= created_at |
| chk_completion_valid | surveys | CHECK | completed_at implies status='disetujui' |
| results_survey_id_key | results | UNIQUE | survey_id |

## Index Strategy

### Primary Query Patterns & Indexes

| Pattern | Query Example | Index(es) Used |
|---------|---------------|----------------|
| List user's surveys | `WHERE surveyor_id = ?` | idx_surveys_surveyor |
| Filter by status | `WHERE status = 'diperiksa'` | idx_surveys_status |
| List project surveys | `WHERE project_id = ?` | idx_surveys_project |
| Critical surveys | `WHERE is_critical = true` | idx_surveys_critical |
| Component by survey | `WHERE survey_id = ?` | idx_components_survey |
| Component by category | `WHERE kategori = 'struktur'` | idx_components_kategori |
| Results by category | `WHERE kategori_kerusakan = 'berat'` | idx_results_kategori |
| Workflow timeline | `WHERE survey_id = ? ORDER BY created_at` | idx_workflow_logs_survey + idx_workflow_logs_created |
| Unread notifications | `WHERE user_id = ? AND is_read = false` | idx_notifications_unread (partial) |

## RLS Policy Summary by Role

| Role | Read | Create | Update | Delete | Special |
|------|------|--------|--------|--------|---------|
| **Admin** | All | All | All | All | Full access |
| **Surveyor** | Own projects/surveys | Projects, Surveys | Own surveys (draft only) | - | Can manage own components |
| **Verifikator** | Assigned projects | - | Status fields only | - | Can verify results |
| **Approver** | Assigned projects | - | Approval fields only | - | Can sign documents |

## Views Summary

| View | Purpose | Key Columns |
|------|---------|-------------|
| survey_summary | Overview with counts | survey_id, project info, component count, damage total |
| project_progress | Completion tracking | project_id, progress_percentage, survey counts |
| workflow_timeline | Audit with duration | transition details, time between steps |
| component_damage_summary | Statistical analysis | component averages, damage distribution |

---

## Schema Version: 1.0.0
## Last Updated: 2024
## Compatible with: Supabase PostgreSQL 15+
