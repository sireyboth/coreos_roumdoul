// Export dialog (components/dashboard/attendance/attendance-export-dialog.tsx)
// Only the dialog is translated; the Excel / PDF files it makes stay in English.

export const exportDialog = {
  // ── Header ────────────────────────────────────────────────────────
  title: "Export attendance report",
  titleFor: "Export attendance — {name}",
  description: "Choose a format, the dates and what to include.",

  // ── Format ────────────────────────────────────────────────────────
  format: {
    label: "Format",
    excelTitle: "Excel workbook",
    excelText: "Every column you choose, to sort, filter and calculate. Opens in Google Sheets too.",
    pdfTitle: "PDF report",
    pdfText: "A finished, printable report — summary, ranking, month calendar and daily detail.",
  },

  // ── Dates & employee ──────────────────────────────────────────────
  thisMonth: "This month",
  lastMonth: "Last month",
  allEmployees: "All employees",

  // ── Excel sheets ──────────────────────────────────────────────────
  excel: {
    calendar: "Add a Calendar sheet",
    calendarHint: "Employees down the side, dates across the top, with status totals.",
    charts: "Add a Charts sheet",
    chartsHint: "Days by status, worked hours and late minutes per employee.",
  },

  // ── PDF contents ──────────────────────────────────────────────────
  pdf: {
    contains: "The report contains",
    summary: "Summary and ranking",
    summaryHint: "Late and absence rates, time lost, missed scans, leave — and every employee ranked, most late days first.",
    glance: "Month at a glance",
    glanceHint: "Everyone's month as a colour-coded grid, on a landscape page.",
    glanceTooLong: "Only for {n} days or less — longer ranges don't fit on a page.",
    detail: "Daily detail",
    detailHint: "Each person's days, grouped by month, with times and notes.",
    lateFrom: "Count lateness from",
    lateFromHint: "Ignore a few minutes' drift, everywhere in the report.",
    lateFromAria: "Count lateness from this many minutes",
    min: "min",
    pickOne: "Pick at least one thing for the daily detail.",
    printBefore: "The PDF opens in your browser's print window — choose",
    saveAsPdf: "Save as PDF",
    printAfter: ". Khmer names and notes come out exactly as on screen.",
  },

  // ── Excel columns ─────────────────────────────────────────────────
  columns: {
    label: "Columns",
    count: "({n} of {total})",
    all: "All",
    none: "None",
    reset: "Reset",
    moveUp: "Move {column} up",
    moveDown: "Move {column} down",
    tickOne: "Tick at least one column.",
  },

  // ── Footer ────────────────────────────────────────────────────────
  preparing: "Preparing…",
  createPdf: "Create PDF",
  downloadExcel: "Download Excel",
};
