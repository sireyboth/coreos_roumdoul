// Import from Excel (components/dashboard/excel/excel-import-dialog.tsx) and its row checks
// (lib/excel/import.ts). {noun}/{many} are the module's own words; {field} is the Excel
// column header, which never changes (lib/excel-specs/*). The Excel file's own contents
// (template, error report) stay as they are.

export const excelImport = {
  // ── Header ────────────────────────────────────────────────────────
  title: "Import {many} from Excel",
  description: "Add {many} in bulk from a spreadsheet. Each row is checked exactly as if it were entered by hand.",

  // ── Step 1: upload ────────────────────────────────────────────────
  upload: {
    templateTitle: "Download the template",
    templateBody: "Headers, dropdowns and instructions are ready.",
    fillTitle: "Add your {many}",
    fillBody: "One row each. Blue headers are required.",
    uploadTitle: "Upload it here",
    uploadBody: "Review the rows before anything is saved.",
    downloadTemplate: "Download template",
    reading: "Reading file…",
    drop: "Drop your Excel file here, or click to browse",
    fileHint: "Excel workbook (.xlsx), up to {max} rows",
    blankCells: "Blank cells on an existing record leave that detail unchanged.",
  },

  // ── File problems ─────────────────────────────────────────────────
  file: {
    missingColumnOne: "The file has no {columns} column. Start from the template so the headers match.",
    missingColumnOther: "The file has no {columns} columns. Start from the template so the headers match.",
    noRows: "The file has a header row but no {many} under it.",
    tooManyRows: "The file has {n} rows. Import at most {max} at a time — split it into smaller files.",
    unreadable: "That file couldn't be read.",
    oldXls: "That's an old-style .xls file. Open it in Excel and save it as an Excel Workbook (.xlsx) first.",
    notXlsx: "Choose an Excel workbook (.xlsx).",
    damaged: "That file couldn't be opened as an Excel workbook. It may be damaged or password-protected.",
    noSheets: "The workbook has no sheets.",
    emptySheet: "The first sheet is empty.",
  },

  // ── Step 2: review ────────────────────────────────────────────────
  review: {
    chooseAnother: "Choose another file",
    rowsFound: "Rows found",
    ready: "Ready",
    needFixing: "Need fixing",
    skippedHint: "These rows will be skipped. Fix them in the file and upload it again, or import the rest now.",
    ignored: "Not imported (not a column this page uses): {columns}.",
    row: "Row",
    rowN: "Row {n}",
    showingFirst: "Showing the first 100 of {n} rows.",
    importOne: "Import {n} {noun}",
    importOther: "Import {n} {noun}",
    yes: "Yes",
    no: "No",
  },

  // ── Step 3: running ───────────────────────────────────────────────
  running: {
    progress: "Importing {many}… {done} of {total}",
    keepOpen: "Keep this window open until it finishes.",
    stopAfterRow: "Stop after this row",
    stopped: "You stopped the import.",
  },

  // ── Step 4: results ───────────────────────────────────────────────
  done: {
    added: "Added",
    updated: "Updated",
    unchanged: "Unchanged",
    failed: "Failed",
    stoppedEarly: "The import stopped early",
    notRunOne: "{n} row was not attempted.",
    notRunOther: "{n} rows were not attempted.",
    downloadFailures: "Download rows that need fixing",
    allImported: "Every row was imported.",
    importAnother: "Import another file",
    importedOne: "{n} {noun} imported",
    importedOther: "{n} {noun} imported",
    needAttentionOne: "{n} row needs attention.",
    needAttentionOther: "{n} rows need attention.",
  },

  // ── Row checks (lib/excel/import.ts) ──────────────────────────────
  check: {
    invalidOption: "{field} \"{text}\" isn't valid. Use one of: {options}.",
    wholeNumber: "{field} must be a whole number.",
    number: "{field} must be a number.",
    date: "{field} must be a date like 2026-09-01.",
    time: "{field} must be a time like 08:30.",
    yesNo: "{field} must be Yes or No.",
    email: "{field} isn't a valid email address.",
    required: "{field} is required.",
    ambiguous: "More than one {what} is called \"{value}\". Use a code or ID instead of the name.",
    notFound: "No {what} called \"{value}\" was found.",
  },
};
