export type Language = 'ar' | 'en';

export interface AttachmentFile {
  name: string;
  size: string;
  type: string;
  dataUrl?: string; // For image previews
}

export interface Permit {
  id: string; // Automatic sequential ID, e.g., PRM-1001, PRM-1002
  permitteeName: string; // الاسم المصرح له
  permitteeId: string; // رقم هوية المصرح له
  ownerName: string; // اسم المالك
  ownerId: string; // رقم هوية المالك
  actualUser: string; // المستخدم الفعلي
  actualUserId: string; // رقم هوية المستخدم الفعلي
  vehicleType: string; // نوع السيارة
  vehicleModel: string; // موديل السيارة
  plateNumber: string; // رقم اللوحة
  vehicleColor: string; // لون السيارة
  startDate: string; // تاريخ بداية التصريح
  endDate: string; // تاريخ نهاية التصريح
  attachments: AttachmentFile[]; // المستندات
  createdBy?: string; // منشئ التصريح
}

export interface UserAccount {
  username: string;
  fullName: string;
  password?: string;
  role: 'admin' | 'user';
  status: 'pending' | 'approved';
  createdAt: string;
}

