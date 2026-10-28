import type { Dictionary } from "../../en";

// Import from Excel (excel-import-dialog.tsx, lib/excel-import.ts) — same keys as
// en/app/excelImport.ts. The module's English nouns ({noun}/{many}) are left out here,
// so Khmer reads "ទិន្នន័យ" / "ជួរ" instead. {field} is the Excel column header.

export const excelImport: Dictionary["app"]["excelImport"] = {
  // ── Header ────────────────────────────────────────────────────────
  title: "នាំចូលទិន្នន័យពី Excel",
  description: "បន្ថែមទិន្នន័យច្រើនក្នុងពេលតែមួយពីឯកសារ Excel។ ជួរនីមួយៗត្រូវបានពិនិត្យដូចគ្នានឹងការបញ្ចូលដោយដៃ។",

  // ── Step 1: upload ────────────────────────────────────────────────
  upload: {
    templateTitle: "ទាញយកគំរូ",
    templateBody: "ចំណងជើងជួរឈរ បញ្ជីជម្រើស និងការណែនាំ បានរៀបចំរួចរាល់។",
    fillTitle: "បំពេញទិន្នន័យរបស់លោកអ្នក",
    fillBody: "មួយជួរសម្រាប់មួយកំណត់ត្រា។ ចំណងជើងពណ៌ខៀវគឺចាំបាច់។",
    uploadTitle: "ផ្ទុកឡើងនៅទីនេះ",
    uploadBody: "ពិនិត្យជួរទាំងអស់មុនពេលរក្សាទុក។",
    downloadTemplate: "ទាញយកគំរូ",
    reading: "កំពុងអានឯកសារ…",
    drop: "ទម្លាក់ឯកសារ Excel របស់លោកអ្នកនៅទីនេះ ឬចុចដើម្បីជ្រើសរើស",
    fileHint: "ឯកសារ Excel (.xlsx) មិនលើសពី {max} ជួរ",
    blankCells: "ក្រឡាទទេលើកំណត់ត្រាដែលមានស្រាប់ នឹងមិនផ្លាស់ប្តូរព័ត៌មាននោះទេ។",
  },

  // ── File problems ─────────────────────────────────────────────────
  file: {
    missingColumnOne: "ឯកសារនេះគ្មានជួរឈរ {columns} ទេ។ សូមប្រើគំរូ ដើម្បីឱ្យចំណងជើងជួរឈរត្រូវគ្នា។",
    missingColumnOther: "ឯកសារនេះគ្មានជួរឈរ {columns} ទេ។ សូមប្រើគំរូ ដើម្បីឱ្យចំណងជើងជួរឈរត្រូវគ្នា។",
    noRows: "ឯកសារនេះមានជួរចំណងជើង ប៉ុន្តែគ្មានទិន្នន័យនៅខាងក្រោមទេ។",
    tooManyRows: "ឯកសារនេះមាន {n} ជួរ។ សូមនាំចូលម្តងមិនលើសពី {max} ជួរ — សូមបំបែកវាជាឯកសារតូចៗ។",
    unreadable: "មិនអាចអានឯកសារនេះបានទេ។",
    oldXls: "នេះជាឯកសារ .xls ទម្រង់ចាស់។ សូមបើកវាក្នុង Excel ហើយរក្សាទុកជា Excel Workbook (.xlsx) ជាមុនសិន។",
    notXlsx: "សូមជ្រើសរើសឯកសារ Excel (.xlsx)។",
    damaged: "មិនអាចបើកឯកសារនេះជា Excel បានទេ។ ឯកសារអាចខូច ឬមានពាក្យសម្ងាត់ការពារ។",
    noSheets: "ឯកសារ Excel នេះគ្មានសន្លឹកទេ។",
    emptySheet: "សន្លឹកទីមួយគ្មានទិន្នន័យទេ។",
  },

  // ── Step 2: review ────────────────────────────────────────────────
  review: {
    chooseAnother: "ជ្រើសរើសឯកសារផ្សេង",
    rowsFound: "ជួរដែលបានរកឃើញ",
    ready: "រួចរាល់",
    needFixing: "ត្រូវកែ",
    skippedHint: "ជួរទាំងនេះនឹងត្រូវរំលង។ សូមកែវានៅក្នុងឯកសារ ហើយផ្ទុកឡើងម្តងទៀត ឬនាំចូលជួរដែលនៅសល់ឥឡូវនេះ។",
    ignored: "មិនបាននាំចូល (មិនមែនជាជួរឈរដែលទំព័រនេះប្រើ)៖ {columns}។",
    row: "ជួរ",
    rowN: "ជួរ {n}",
    showingFirst: "បង្ហាញ 100 ជួរដំបូង ក្នុងចំណោម {n} ជួរ។",
    importOne: "នាំចូល {n} ជួរ",
    importOther: "នាំចូល {n} ជួរ",
    yes: "មែន",
    no: "មិនមែន",
  },

  // ── Step 3: running ───────────────────────────────────────────────
  running: {
    progress: "កំពុងនាំចូល… {done} ក្នុងចំណោម {total}",
    keepOpen: "សូមទុកផ្ទាំងនេះឱ្យបើក រហូតដល់ការនាំចូលបញ្ចប់។",
    stopAfterRow: "បញ្ឈប់បន្ទាប់ពីជួរនេះ",
    stopped: "លោកអ្នកបានបញ្ឈប់ការនាំចូល។",
  },

  // ── Step 4: results ───────────────────────────────────────────────
  done: {
    added: "បានបន្ថែម",
    updated: "បានធ្វើបច្ចុប្បន្នភាព",
    unchanged: "មិនផ្លាស់ប្តូរ",
    failed: "បរាជ័យ",
    stoppedEarly: "ការនាំចូលបានបញ្ឈប់មុនពេលបញ្ចប់",
    notRunOne: "{n} ជួរមិនត្រូវបាននាំចូលទេ។",
    notRunOther: "{n} ជួរមិនត្រូវបាននាំចូលទេ។",
    downloadFailures: "ទាញយកជួរដែលត្រូវកែ",
    allImported: "ជួរទាំងអស់ត្រូវបាននាំចូលរួចរាល់។",
    importAnother: "នាំចូលឯកសារផ្សេងទៀត",
    importedOne: "បាននាំចូល {n} ជួរ",
    importedOther: "បាននាំចូល {n} ជួរ",
    needAttentionOne: "មាន {n} ជួរត្រូវពិនិត្យ។",
    needAttentionOther: "មាន {n} ជួរត្រូវពិនិត្យ។",
  },

  // ── Row checks (lib/excel-import.ts) ──────────────────────────────
  check: {
    invalidOption: "{field} \"{text}\" មិនត្រឹមត្រូវទេ។ សូមប្រើមួយក្នុងចំណោម៖ {options}។",
    wholeNumber: "{field} ត្រូវតែជាចំនួនគត់។",
    number: "{field} ត្រូវតែជាលេខ។",
    date: "{field} ត្រូវតែជាកាលបរិច្ឆេទ ឧ. 2026-09-01។",
    time: "{field} ត្រូវតែជាម៉ោង ឧ. 08:30។",
    yesNo: "{field} ត្រូវតែជា Yes ឬ No។",
    email: "{field} មិនមែនជាអាសយដ្ឋានអ៊ីមែលត្រឹមត្រូវទេ។",
    required: "សូមបំពេញ {field}។",
    ambiguous: "មាន {what} ច្រើនជាងមួយដែលមានឈ្មោះ \"{value}\"។ សូមប្រើលេខកូដ ឬអត្តលេខជំនួសឱ្យឈ្មោះ។",
    notFound: "រកមិនឃើញ {what} ដែលមានឈ្មោះ \"{value}\" ទេ។",
  },
};
