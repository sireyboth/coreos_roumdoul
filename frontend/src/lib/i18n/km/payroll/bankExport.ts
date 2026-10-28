import type { Dictionary } from "../../en";

// Bank transfer file dialog — same keys as en/payroll/bankExport.ts.

export const bankExport: Dictionary["payroll"]["bankExport"] = {
  menu: "ឯកសារផ្ទេរប្រាក់តាមធនាគារ (Excel)",
  menuHint: "ផ្ទុកប្រាក់បៀវត្សរ៍ជាដុំសម្រាប់ធនាគារ Chip Mong ឬ ABA",
  title: "ឯកសារផ្ទេរប្រាក់តាមធនាគារ",
  description: "សូមជ្រើសរើសធនាគាររបស់អ្នក។ ឯកសារនឹងរៀបចំតាមទម្រង់ដែលធនាគារតម្រូវសម្រាប់ការផ្ទុកប្រាក់បៀវត្សរ៍ជាដុំ។",
  bank: "ធនាគារ",
  currency: "រូបិយប័ណ្ណ",
  currencyHint: "មួយឯកសារសម្រាប់រូបិយប័ណ្ណនីមួយៗ — ធនាគារមិនទទួលរូបិយប័ណ្ណចម្រុះទេ។",
  companyCode: "លេខកូដក្រុមហ៊ុន",
  debitAccount: "គណនីដកប្រាក់",
  valueDate: "កាលបរិច្ឆេទផ្ទេរ",
  remembered: "លេខកូដក្រុមហ៊ុន និងគណនីដកប្រាក់ នឹងត្រូវរក្សាទុកសម្រាប់លើកក្រោយ។",
  remarks: "កំណត់សម្គាល់",
  sameBankOnly: "តែបុគ្គលិកដែលមានគណនី {bank} ប៉ុណ្ណោះ",
  sameBankOnlyHint: "ផ្ទៀងផ្ទាត់តាមឈ្មោះធនាគារក្នុងប្រវត្តិរូបបុគ្គលិកនីមួយៗ។",
  noneAtBank: "គ្មានបុគ្គលិកណាប្រើ {bank} ទេ ដូច្នេះបុគ្គលិកទាំងអស់ដែលបើកប្រាក់តាមធនាគារ ត្រូវបានបញ្ចូល។",
  transfersOne: "ការផ្ទេរចំនួន {n}",
  transfersOther: "ការផ្ទេរចំនួន {n}",
  skipped: {
    noAccount: "{n} នាក់មិនបានបញ្ចូល៖ គ្មានលេខគណនី",
    cash: "{n} នាក់មិនបានបញ្ចូល៖ បើកជាសាច់ប្រាក់",
    otherBank: "{n} នាក់មិនបានបញ្ចូល៖ ធនាគារផ្សេង",
    nothingToPay: "{n} នាក់មិនបានបញ្ចូល៖ គ្មានប្រាក់ត្រូវបើក",
  },
  missingTitle: "{n} នាក់គ្មានលេខគណនី",
  download: "ទាញយកឯកសារ",
  downloaded: "ឯកសារធនាគាររួចរាល់ — ការផ្ទេរចំនួន {n}",
};
