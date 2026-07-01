import { Permit } from './types';

export const INITIAL_PERMITS: Permit[] = [
  {
    id: "1001",
    permitteeName: "خالد عبد العزيز الحربي",
    permitteeId: "1023456789",
    ownerName: "شركة الوفاق للنقل",
    ownerId: "7012345678",
    actualUser: "محمد أحمد خان",
    actualUserId: "2412345678",
    vehicleType: "شاحنة نقل ثقيل (Volvo)",
    vehicleModel: "2020",
    plateNumber: "أ ب ج 1234",
    vehicleColor: "أبيض",
    startDate: "1447-07-12",
    endDate: "1448-06-21", // Future Hijri date relative to 1447-12-09
    attachments: [
      { name: "رخصة_السير_الاستمارة.pdf", size: "2.4 MB", type: "application/pdf" },
      { name: "صورة_الهوية_الوطنية.jpg", size: "1.1 MB", type: "image/jpeg" }
    ],
    createdBy: "وسيم"
  },
  {
    id: "1002",
    permitteeName: "عبدالرحمن محمد العتيبي",
    permitteeId: "1056789123",
    ownerName: "عبدالرحمن محمد العتيبي",
    ownerId: "1056789123",
    actualUser: "صالح علي العتيبي",
    actualUserId: "1087654321",
    vehicleType: "سيارة سيدان (Toyota Camry)",
    vehicleModel: "2022",
    plateNumber: "د ر س 5678",
    vehicleColor: "فضي",
    startDate: "1447-07-26",
    endDate: "1447-11-15", // Past Hijri date
    attachments: [
      { name: "تفويض_المستخدم_الفعلي.pdf", size: "1.5 MB", type: "application/pdf" },
      { name: "فحص_الدورية_الفني.jpg", size: "950 KB", type: "image/jpeg" }
    ],
    createdBy: "عبدالرحمن"
  },
  {
    id: "1003",
    permitteeName: "فاطمة أحمد الزهراني",
    permitteeId: "1098765432",
    ownerName: "مؤسسة زوايا الإعمار",
    ownerId: "7023456781",
    actualUser: "سعيد عبدالغني",
    actualUserId: "2498765432",
    vehicleType: "سيارة دفع رباعي (Nissan Patrol)",
    vehicleModel: "2021",
    plateNumber: "ح ل م 9123",
    vehicleColor: "أسود",
    startDate: "1447-08-22",
    endDate: "1448-09-03", // Future Hijri date
    attachments: [
      { name: "السجل_التجاري_مؤسسة_زوايا.pdf", size: "3.2 MB", type: "application/pdf" }
    ],
    createdBy: "وسيم"
  },
  {
    id: "1004",
    permitteeName: "ماجد بن فيصل السديري",
    permitteeId: "1043210987",
    ownerName: "ماجد بن فيصل السديري",
    ownerId: "1043210987",
    actualUser: "سليم جاويد",
    actualUserId: "2354678901",
    vehicleType: "حافلة ركاب (Hyundai)",
    vehicleModel: "2019",
    plateNumber: "ط ي ر 4455",
    vehicleColor: "أزرق",
    startDate: "1447-04-08",
    endDate: "1447-09-27", // Past Hijri date
    attachments: [
      { name: "استمارة_الحافلة.jpg", size: "1.8 MB", type: "image/jpeg" },
      { name: "عقد_تأمين_المركبة.pdf", size: "4.1 MB", type: "application/pdf" }
    ],
    createdBy: "مدير النظام"
  }
];

export const TRANSLATIONS = {
  ar: {
    portalName: "أرشيف تصاريح التظليل",
    portalSubtitle: "المنصة الرقمية الموحدة لإصدار وتدقيق وتتبع تصاريح التظليل وتوثيق المستندات بالتقويم الهجري",
    allPermitsTab: "عرض جميع التصاريح",
    addPermitTab: "إضافة تصريح جديد",
    searchTab: "البحث عن تصريح",
    
    // Form fields & labels
    permitId: "رقم التصريح",
    permitteeName: "الاسم المصرح له",
    permitteeId: "رقم هوية المصرح له",
    ownerName: "اسم المالك",
    ownerId: "رقم هوية المالك",
    actualUser: "المستخدم الفعلي",
    actualUserId: "رقم هوية المستخدم الفعلي",
    vehicleType: "نوع السيارة",
    vehicleModel: "موديل السيارة",
    plateNumber: "رقم اللوحة",
    vehicleColor: "لون السيارة",
    startDate: "تاريخ بداية التصريح (هجري)",
    endDate: "تاريخ نهاية التصريح (هجري)",
    documents: "المستندات",
    
    // Status
    status: "حالة التصريح",
    statusValid: "ساري",
    statusExpired: "منتهي",
    
    // Actions & Buttons
    editPermit: "تعديل التصريح",
    deletePermit: "حذف التصريح",
    viewDocs: "عرض المستندات",
    saveChanges: "حفظ التعديلات",
    addNewPermit: "إنشاء تصريح جديد",
    cancel: "إلغاء",
    close: "إغلاق",
    deleteConfirm: "هل أنت متأكد من حذف هذا التصريح نهائياً؟",
    yesDelete: "نعم، حذف",
    noCancel: "تراجع",
    
    // Upload & Attachments
    attachFiles: "إرفاق صور أو ملفات المستندات",
    dragDropText: "اسحب وأفلت الملفات هنا، أو انقر للاختيار",
    fileSizeLimit: "صيغ الملفات المدعومة: PDF, PNG, JPG بحد أقصى 10 ميجابايت",
    noDocsAttached: "لا توجد مستندات مرفقة لهذا التصريح",
    
    // Placeholder & search
    searchPlaceholder: "البحث باسم المصرح له، رقم الهوية، رقم اللوحة، أو رقم التصريح...",
    searchBtn: "بحث",
    clearBtn: "مسح تصفية البحث",
    noResults: "لم يتم العثور على أي تصاريح تطابق معايير البحث المعطاة.",
    
    // Notification & stats
    successAdd: "تم إنشاء التصريح الجديد بنجاح برقم تسلسلي: ",
    successEdit: "تم تحديث بيانات التصريح بنجاح.",
    successDelete: "تم حذف التصريح بنجاح.",
    totalPermits: "إجمالي تصاريح التظليل",
    activePermits: "التصاريح السارية",
    expiredPermits: "التصاريح المنتهية",
    
    // Language Switch
    langToggle: "English"
  },
  en: {
    portalName: "Shading Permits Archive",
    portalSubtitle: "Unified digital platform for issuing, auditing, and tracking vehicle shading permits (Hijri Calendar)",
    allPermitsTab: "View All Permits",
    addPermitTab: "Add New Permit",
    searchTab: "Search Permits",
    
    // Form fields & labels
    permitId: "Permit ID",
    permitteeName: "Permittee Name",
    permitteeId: "Permittee ID",
    ownerName: "Owner Name",
    ownerId: "Owner ID",
    actualUser: "Actual User",
    actualUserId: "Actual User ID",
    vehicleType: "Vehicle Type",
    vehicleModel: "Vehicle Model",
    plateNumber: "Plate Number",
    vehicleColor: "Vehicle Color",
    startDate: "Start Date (Hijri)",
    endDate: "End Date (Hijri)",
    documents: "Documents",
    
    // Status
    status: "Permit Status",
    statusValid: "Valid",
    statusExpired: "Expired",
    
    // Actions & Buttons
    editPermit: "Edit Permit",
    deletePermit: "Delete Permit",
    viewDocs: "View Documents",
    saveChanges: "Save Changes",
    addNewPermit: "Create New Permit",
    cancel: "Cancel",
    close: "Close",
    deleteConfirm: "Are you sure you want to permanently delete this permit?",
    yesDelete: "Yes, Delete",
    noCancel: "Cancel",
    
    // Upload & Attachments
    attachFiles: "Attach images or document files",
    dragDropText: "Drag and drop files here, or click to browse",
    fileSizeLimit: "Supported formats: PDF, PNG, JPG up to 10MB",
    noDocsAttached: "No documents attached for this permit",
    
    // Placeholder & search
    searchPlaceholder: "Search by permittee name, national ID, plate number, or permit ID...",
    searchBtn: "Search",
    clearBtn: "Clear Search",
    noResults: "No permits found matching the search criteria.",
    
    // Notification & stats
    successAdd: "New permit created successfully with sequential ID: ",
    successEdit: "Permit updated successfully.",
    successDelete: "Permit deleted successfully.",
    totalPermits: "Total Shading Permits",
    activePermits: "Valid Permits",
    expiredPermits: "Expired Permits",
    
    // Language Switch
    langToggle: "العربية"
  }
};
