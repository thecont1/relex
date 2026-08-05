// Generates the fictional test-dept workbook used to prove the multi-tenant
// architecture: a second tenant that runs with zero core code changes.
//
// Usage:
//   bun run scripts/make-test-dept-workbook.ts
//
// Output: tenants/test-dept/public/data/test_dept_dataset.xlsx
// The dataset is entirely fictional and safe to commit (the .gitignore rule
// for tenant workbooks has an explicit exception for test-dept).

import * as XLSX from 'xlsx';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

const OUT_DIR = resolve(import.meta.dir, '../tenants/test-dept/public/data');
const OUT_FILE = resolve(OUT_DIR, 'test_dept_dataset.xlsx');

const platforms = [
  { 'Platform ID': 'PLAT-001', Platform: 'Distributed Systems Lab', Description: 'Large-scale distributed computing research infrastructure.', Sector: 'Systems' },
  { 'Platform ID': 'PLAT-002', Platform: 'Applied ML Studio', Description: 'Applied machine learning prototyping environment.', Sector: 'AI' },
  { 'Platform ID': 'PLAT-003', Platform: 'Human-Computer Interaction Suite', Description: 'Usability testing and interaction research facility.', Sector: 'Design' },
  { 'Platform ID': 'PLAT-004', Platform: 'Formal Methods Workbench', Description: 'Verification and program analysis tooling.', Sector: 'Theory' },
  { 'Platform ID': 'PLAT-005', Platform: 'Data Engineering Pipeline', Description: 'Shared ETL and analytics infrastructure.', Sector: 'Data' },
  { 'Platform ID': 'PLAT-006', Platform: 'Cyber-Physical Testbed', Description: 'Robotics and embedded systems experimentation area.', Sector: 'Systems' },
];

const faculty = [
  { 'Faculty ID': 'FAC-001', Faculty: 'Ada Verhoeven' },
  { 'Faculty ID': 'FAC-002', Faculty: 'Bruno Castellanos' },
  { 'Faculty ID': 'FAC-003', Faculty: 'Chika Okafor' },
  { 'Faculty ID': 'FAC-004', Faculty: 'Dmitri Volkov' },
  { 'Faculty ID': 'FAC-005', Faculty: 'Elena Marchetti' },
  { 'Faculty ID': 'FAC-006', Faculty: 'Farid Rahmani' },
  { 'Faculty ID': 'FAC-007', Faculty: 'Greta Lindqvist' },
  { 'Faculty ID': 'FAC-008', Faculty: 'Hiro Tanabe' },
  { 'Faculty ID': 'FAC-009', Faculty: 'Ines Duarte' },
  { 'Faculty ID': 'FAC-010', Faculty: 'Jamal Whitfield' },
];

const facultyPlatforms = [
  { Faculty: 'Ada Verhoeven', Platform: 'Distributed Systems Lab' },
  { Faculty: 'Ada Verhoeven', Platform: 'Cyber-Physical Testbed' },
  { Faculty: 'Bruno Castellanos', Platform: 'Applied ML Studio' },
  { Faculty: 'Bruno Castellanos', Platform: 'Data Engineering Pipeline' },
  { Faculty: 'Chika Okafor', Platform: 'Human-Computer Interaction Suite' },
  { Faculty: 'Dmitri Volkov', Platform: 'Formal Methods Workbench' },
  { Faculty: 'Dmitri Volkov', Platform: 'Distributed Systems Lab' },
  { Faculty: 'Elena Marchetti', Platform: 'Applied ML Studio' },
  { Faculty: 'Farid Rahmani', Platform: 'Data Engineering Pipeline' },
  { Faculty: 'Greta Lindqvist', Platform: 'Formal Methods Workbench' },
  { Faculty: 'Hiro Tanabe', Platform: 'Cyber-Physical Testbed' },
  { Faculty: 'Ines Duarte', Platform: 'Human-Computer Interaction Suite' },
  { Faculty: 'Jamal Whitfield', Platform: 'Distributed Systems Lab' },
];

const verticals = [
  { 'Vertical ID': 'VERT-001', 'Research Vertical': 'Trustworthy AI', Sector: 'AI' },
  { 'Vertical ID': 'VERT-002', 'Research Vertical': 'Edge Computing', Sector: 'Systems' },
  { 'Vertical ID': 'VERT-003', 'Research Vertical': 'Accessible Interfaces', Sector: 'Design' },
  { 'Vertical ID': 'VERT-004', 'Research Vertical': 'Program Verification', Sector: 'Theory' },
  { 'Vertical ID': 'VERT-005', 'Research Vertical': 'Responsible Data Science', Sector: 'Data' },
];

const facultyVerticals = [
  { Faculty: 'Bruno Castellanos', 'Research Vertical': 'Trustworthy AI' },
  { Faculty: 'Elena Marchetti', 'Research Vertical': 'Trustworthy AI' },
  { Faculty: 'Ada Verhoeven', 'Research Vertical': 'Edge Computing' },
  { Faculty: 'Jamal Whitfield', 'Research Vertical': 'Edge Computing' },
  { Faculty: 'Chika Okafor', 'Research Vertical': 'Accessible Interfaces' },
  { Faculty: 'Ines Duarte', 'Research Vertical': 'Accessible Interfaces' },
  { Faculty: 'Dmitri Volkov', 'Research Vertical': 'Program Verification' },
  { Faculty: 'Greta Lindqvist', 'Research Vertical': 'Program Verification' },
  { Faculty: 'Farid Rahmani', 'Research Vertical': 'Responsible Data Science' },
  { Faculty: 'Hiro Tanabe', 'Research Vertical': 'Edge Computing' },
];

const collaborations = [
  { 'Faculty A': 'Ada Verhoeven', 'Faculty B': 'Hiro Tanabe', 'Project/Topic': 'Resilient sensor networks' },
  { 'Faculty A': 'Bruno Castellanos', 'Faculty B': 'Elena Marchetti', 'Project/Topic': 'Bias audits for ranking models' },
  { 'Faculty A': 'Chika Okafor', 'Faculty B': 'Ines Duarte', 'Project/Topic': 'Screen-reader-first design patterns' },
  { 'Faculty A': 'Dmitri Volkov', 'Faculty B': 'Greta Lindqvist', 'Project/Topic': 'Verified consensus protocols' },
  { 'Faculty A': 'Farid Rahmani', 'Faculty B': 'Jamal Whitfield', 'Project/Topic': 'Streaming provenance tracking' },
  { 'Faculty A': 'Ada Verhoeven', 'Faculty B': 'Dmitri Volkov', 'Project/Topic': 'Fault injection for verified systems' },
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(platforms), 'Platforms');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(faculty), 'Faculty');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(facultyPlatforms), 'Faculty_Platforms');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(verticals), 'Research_Verticals');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(facultyVerticals), 'Faculty_Verticals');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(collaborations), 'Collaborations');

mkdirSync(OUT_DIR, { recursive: true });
XLSX.writeFile(wb, OUT_FILE);
console.log(`Wrote ${OUT_FILE}`);
