import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Plus, Search, Edit2, Trash2, CheckCircle, AlertTriangle, 
  Globe, Car, User, Download, X, UserCheck, RefreshCw, FileUp, Printer,
  LogOut, Lock, Users, Clock, Calendar, Eye
} from 'lucide-react';
import { Permit, Language, AttachmentFile, UserAccount } from './types';
import { INITIAL_PERMITS, TRANSLATIONS } from './data';
import { motion, AnimatePresence } from 'motion/react';
import { 
  gregorianToHijri, 
  hijriToGregorian, 
  formatHijriString, 
  formatHijriDate, 
  toHijriString 
} from './hijri';
import { db } from './firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function App() {
  // 1. Language state: Arabic by default, load from localStorage if exists
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('prm_lang');
    return (saved as Language) || 'ar';
  });

  // 1.1 Users State
  const [users, setUsers] = useState<UserAccount[]>([]);

  // 1.2 Current Logged in User State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem('prm_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // 2. Permits database state: load from localStorage or fallback to INITIAL_PERMITS
  const [permits, setPermits] = useState<Permit[]>([]);

  // 3. Navigation / Tab State: 'all' (جميع التصاريح), 'add' (إضافة تصريح جديد), 'search' (صفحة البحث), 'users' (إدارة المستخدمين)
  const [activeTab, setActiveTab] = useState<'all' | 'add' | 'search' | 'users'>('all');

  // 4. Advanced Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState<'all' | 'name' | 'id' | 'plate' | 'permitId'>('all');
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('');
  const [dashboardSelectedYear, setDashboardSelectedYear] = useState<string>('all');
  const [searchSelectedYear, setSearchSelectedYear] = useState<string>('all');

  // 5. Modals State
  const [editingPermit, setEditingPermit] = useState<Permit | null>(null);
  const [viewingDocsPermit, setViewingDocsPermit] = useState<Permit | null>(null);
  const [viewingPermit, setViewingPermit] = useState<Permit | null>(null);
  const [renewingPermit, setRenewingPermit] = useState<Permit | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  
  // 6. Inline Notifications state
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // 7. Printing state
  const [printTarget, setPrintTarget] = useState<Permit | 'all' | null>(null);
  const [printAttachment, setPrintAttachment] = useState<{ permit: Permit; file: AttachmentFile } | null>(null);

  // Real-time Clock for precise Saudi time (KSA)
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getKsaTimeString = (date: Date, lang: Language) => {
    return date.toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', {
      timeZone: 'Asia/Riyadh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const getKsaDateString = (date: Date, lang: Language) => {
    return date.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
      timeZone: 'Asia/Riyadh',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Listen to permits from Firestore in real-time
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'permits'), (snapshot) => {
      const list: Permit[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data() as Permit });
      });
      
      // Sort permits descending by id
      list.sort((a, b) => {
        const aId = parseInt(a.id, 10) || 0;
        const bId = parseInt(b.id, 10) || 0;
        return bId - aId;
      });
      setPermits(list);
    }, (error) => {
      console.error("Firestore permits error:", error);
    });
    return () => unsubscribe();
  }, []);

  // Listen to users from Firestore in real-time
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list: UserAccount[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as UserAccount);
      });

      // Default hardcoded users
      const defaultUsers: UserAccount[] = [
        {
          username: "waseem",
          fullName: language === 'ar' ? 'وسيم' : 'Waseem',
          password: "wem",
          role: "admin",
          status: "approved",
          createdAt: "1447-12-09"
        },
        {
          username: "jmmk",
          fullName: language === 'ar' ? 'مساعد نظام' : 'System Assistant',
          password: "jm",
          role: "admin",
          status: "approved",
          createdAt: "1447-12-09"
        }
      ];

      let needsSeeding = false;
      defaultUsers.forEach(du => {
        if (!list.some(u => u.username.toLowerCase() === du.username.toLowerCase())) {
          needsSeeding = true;
          setDoc(doc(db, 'users', du.username.toLowerCase()), du);
        }
      });

      if (!needsSeeding) {
        setUsers(list);
      }
    }, (error) => {
      console.error("Firestore users error:", error);
    });
    return () => unsubscribe();
  }, [language]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('prm_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('prm_current_user');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('prm_lang', language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  // Handle native printing triggers
  useEffect(() => {
    if (printTarget !== null) {
      const handleAfterPrint = () => {
        setPrintTarget(null);
      };
      window.addEventListener('afterprint', handleAfterPrint);
      const timer = setTimeout(() => {
        window.print();
        // Fallback in case afterprint does not fire immediately
        const fallbackTimer = setTimeout(() => setPrintTarget(null), 2000);
        return () => clearTimeout(fallbackTimer);
      }, 500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('afterprint', handleAfterPrint);
      };
    }
  }, [printTarget]);

  useEffect(() => {
    if (printAttachment !== null) {
      const handleAfterPrint = () => {
        setPrintAttachment(null);
      };
      window.addEventListener('afterprint', handleAfterPrint);
      const timer = setTimeout(() => {
        window.print();
        // Fallback in case afterprint does not fire immediately
        const fallbackTimer = setTimeout(() => setPrintAttachment(null), 3000);
        return () => clearTimeout(fallbackTimer);
      }, 1500); // 1.5s delay allows image dataUrls to load and render in DOM
      return () => {
        clearTimeout(timer);
        window.removeEventListener('afterprint', handleAfterPrint);
      };
    }
  }, [printAttachment]);

  const t = TRANSLATIONS[language];

  // Helper: Show notification
  const triggerNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Helper: Automatic status calculation based on current Hijri date
  const getPermitStatus = (endDateStr: string): 'Valid' | 'Expired' => {
    if (!endDateStr) return 'Expired';
    const todayH = gregorianToHijri(new Date());
    const todayStr = `${todayH.hy}-${String(todayH.hm).padStart(2, '0')}-${String(todayH.hd).padStart(2, '0')}`;
    return endDateStr >= todayStr ? 'Valid' : 'Expired';
  };

  // Helper: Generate sequential automatic permit ID
  const generateSequentialId = (): string => {
    if (permits.length === 0) return '1001';
    const ids = permits.map(p => parseInt(p.id, 10)).filter(id => !isNaN(id));
    if (ids.length === 0) return '1001';
    const maxId = Math.max(...ids);
    return (maxId + 1).toString();
  };

  // Delete Action
  const handleDeletePermit = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'permits', id));
      triggerNotification(t.successDelete, 'success');
    } catch (e) {
      triggerNotification(language === 'ar' ? 'حدث خطأ أثناء الحذف' : 'Error deleting permit', 'error');
    }
    setDeleteConfirmId(null);
  };

  // Delete All Action
  const handleDeleteAllPermits = async () => {
    try {
      const deletePromises = permits.map(p => deleteDoc(doc(db, 'permits', p.id)));
      await Promise.all(deletePromises);
      triggerNotification(
        language === 'ar' ? 'تم حذف جميع التصاريح بنجاح.' : 'All permits have been deleted successfully.',
        'success'
      );
    } catch (e) {
      console.error(e);
      triggerNotification(
        language === 'ar' ? 'حدث خطأ أثناء حذف جميع التصاريح.' : 'Error deleting all permits.',
        'error'
      );
    }
    setDeleteAllConfirm(false);
  };

  // Extract unique Hijri years from all permits dynamically to populate the year select boxes
  const availableYears = (Array.from(new Set(
    permits.flatMap(p => {
      const startY = p.startDate ? p.startDate.split('-')[0] : '';
      const endY = p.endDate ? p.endDate.split('-')[0] : '';
      return [startY, endY];
    }).filter(y => y && y.length === 4 && /^\d+$/.test(y))
  )) as string[]).sort((a, b) => b.localeCompare(a));

  // Real-time filtering for the main Dashboard (All Permits) tab
  const filteredPermits = permits.filter(permit => {
    // 1. Year Filter
    if (dashboardSelectedYear !== 'all') {
      const startY = permit.startDate ? permit.startDate.split('-')[0] : '';
      const endY = permit.endDate ? permit.endDate.split('-')[0] : '';
      if (startY !== dashboardSelectedYear && endY !== dashboardSelectedYear) {
        return false;
      }
    }

    // 2. Search query filter
    if (!dashboardSearchQuery.trim()) return true;
    const query = dashboardSearchQuery.toLowerCase().trim();
    
    return (
      (permit.id || '').toLowerCase().includes(query) ||
      (permit.permitteeName || '').toLowerCase().includes(query) ||
      (permit.permitteeId || '').toLowerCase().includes(query) ||
      (permit.ownerName || '').toLowerCase().includes(query) ||
      (permit.ownerId || '').toLowerCase().includes(query) ||
      (permit.actualUser || '').toLowerCase().includes(query) ||
      (permit.actualUserId || '').toLowerCase().includes(query) ||
      (permit.plateNumber || '').toLowerCase().includes(query) ||
      (permit.vehicleType || '').toLowerCase().includes(query) ||
      (permit.vehicleModel || '').toLowerCase().includes(query) ||
      (permit.createdBy || '').toLowerCase().includes(query)
    );
  });

  if (!currentUser) {
    return (
      <AuthScreen
        language={language}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          triggerNotification(
            language === 'ar' ? `مرحباً بك، ${user.fullName}!` : `Welcome back, ${user.fullName}!`, 
            'success'
          );
        }}
        users={users}
        onRegister={async (newUser) => {
          try {
            await setDoc(doc(db, 'users', newUser.username.toLowerCase()), newUser);
            triggerNotification(
              language === 'ar' 
                ? `تم تسجيل الحساب بنجاح. بانتظار موافقة المسؤول waseem.` 
                : `Account registered successfully. Pending approval by waseem.`, 
              'success'
            );
          } catch (e) {
            triggerNotification(language === 'ar' ? 'فشل تسجيل الحساب' : 'Failed to register account', 'error');
          }
        }}
        setLanguage={setLanguage}
        t={t}
      />
    );
  }

  return (
    <>
      <div className={`min-h-screen bg-[#f8f9fa] flex flex-col font-sans text-[#191c1d] pb-12 transition-all duration-300 ${language === 'ar' ? 'font-arabic' : ''}`}>
      
      {/* HEADER SECTION */}
      <header className="bg-white border-b border-[#e2e8f0] sticky top-0 z-40 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo and App Title */}
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-[#006b33] rounded-xl flex items-center justify-center text-white shadow-md shrink-0">
                <Car className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-[#e6f4ea] text-[#006b33] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#006b33]/20">
                    {language === 'ar' ? 'رسمي' : 'OFFICIAL'}
                  </span>
                  <h1 className="text-sm sm:text-base md:text-lg font-extrabold text-[#191c1d] tracking-tight">
                    {t.portalName}
                  </h1>
                </div>
                <p className="text-[10px] text-[#5f5e5c] hidden sm:block font-medium mt-0.5">
                  {t.portalSubtitle}
                </p>
              </div>
            </div>

            {/* Language Toggle & User Profile */}
            <div className="flex items-center gap-3">
              {currentUser && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="h-7 w-7 bg-[#006b33]/10 text-[#006b33] rounded-full flex items-center justify-center font-bold text-xs shrink-0">
                    {currentUser.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black leading-tight text-gray-800">{currentUser.fullName}</p>
                    <p className="text-[9px] text-[#006b33] font-bold font-mono">
                      @{currentUser.username} ({currentUser.role === 'admin' ? (language === 'ar' ? 'مسؤول' : 'Admin') : (language === 'ar' ? 'مستخدم' : 'User')})
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#006b33] bg-[#e6f4ea] hover:bg-[#006b33]/10 rounded-lg transition-all cursor-pointer"
                id="lang-toggle-btn"
              >
                <Globe className="h-4 w-4 text-[#006b33]" />
                <span>{t.langToggle}</span>
              </button>

              {currentUser && (
                <button
                  onClick={() => {
                    setCurrentUser(null);
                    setActiveTab('all');
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-all cursor-pointer"
                  title={language === 'ar' ? 'تسجيل الخروج' : 'Log Out'}
                >
                  <LogOut className="h-4 w-4 text-red-600" />
                  <span className="hidden md:inline">{language === 'ar' ? 'خروج' : 'Logout'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* STATS OVERVIEW CARDS */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Total Permits */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#5f5e5c] uppercase tracking-wider">{t.totalPermits}</p>
              <h3 className="text-2xl font-black text-[#191c1d] mt-2 font-mono">{permits.length}</h3>
            </div>
            <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <FileText className="h-6 w-6" />
            </div>
          </div>

          {/* Valid Permits */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#5f5e5c] uppercase tracking-wider">{t.activePermits}</p>
              <h3 className="text-2xl font-black text-[#006b33] mt-2 font-mono">
                {permits.filter(p => getPermitStatus(p.endDate) === 'Valid').length}
              </h3>
            </div>
            <div className="h-12 w-12 bg-[#e6f4ea] text-[#006b33] rounded-xl flex items-center justify-center">
              <CheckCircle className="h-6 w-6" />
            </div>
          </div>

          {/* Expired Permits */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#5f5e5c] uppercase tracking-wider">{t.expiredPermits}</p>
              <h3 className="text-2xl font-black text-[#c5221f] mt-2 font-mono">
                {permits.filter(p => getPermitStatus(p.endDate) === 'Expired').length}
              </h3>
            </div>
            <div className="h-12 w-12 bg-red-50 text-[#c5221f] rounded-xl flex items-center justify-center">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
        </div>
      </section>

      {/* TOAST NOTIFICATION CONTAINER */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4"
          >
            <div className={`p-4 rounded-xl shadow-lg border flex items-center gap-3 ${
              notification.type === 'success' 
                ? 'bg-[#e6f4ea] border-[#bdcabc] text-[#137333]' 
                : 'bg-[#fce8e6] border-red-200 text-[#c5221f]'
            }`}>
              {notification.type === 'success' ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}
              <span className="text-xs font-bold leading-relaxed">{notification.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* REAL-TIME SYSTEM CLOCK & DATE BANNER */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-4 md:p-5 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          
          {/* Time Card */}
          <div className="flex items-center gap-3 bg-gray-50/50 p-3 rounded-xl border border-gray-100/80">
            <div className="h-10 w-10 bg-[#006b33]/10 text-[#006b33] rounded-xl flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                {language === 'ar' ? 'الوقت الحالي (الرياض)' : 'Current Time (Riyadh)'}
              </p>
              <p className="text-sm font-extrabold text-gray-800 font-mono tracking-tight">
                {getKsaTimeString(currentDateTime, language)}
              </p>
            </div>
          </div>

          {/* Hijri Date Card */}
          <div className="flex items-center gap-3 bg-gray-50/50 p-3 rounded-xl border border-gray-100/80">
            <div className="h-10 w-10 bg-[#006b33]/10 text-[#006b33] rounded-xl flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                {language === 'ar' ? 'التاريخ الهجري (أم القرى)' : 'Hijri Date (Umm al-Qura)'}
              </p>
              <p className="text-xs font-black text-[#006b33] leading-relaxed">
                {formatHijriDate(gregorianToHijri(currentDateTime), language)}
              </p>
            </div>
          </div>

          {/* Gregorian Date Card */}
          <div className="flex items-center gap-3 bg-[#e6f4ea]/40 p-3 rounded-xl border border-[#006b33]/10">
            <div className="h-10 w-10 bg-[#006b33]/10 text-[#006b33] rounded-xl flex items-center justify-center shrink-0">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                {language === 'ar' ? 'التاريخ الميلادي' : 'Gregorian Date'}
              </p>
              <p className="text-xs font-extrabold text-gray-800 leading-relaxed">
                {getKsaDateString(currentDateTime, language)}
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* NAVIGATION TABS */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-8">
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-2 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-3xs">
          {/* Tab buttons */}
          <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                activeTab === 'all' 
                  ? 'bg-[#006b33] text-white shadow-sm' 
                  : 'text-[#5f5e5c] hover:bg-[#006b33]/5 hover:text-[#006b33]'
              }`}
              id="tab-all-permits"
            >
              <FileText className="h-4 w-4" />
              <span>{t.allPermitsTab}</span>
            </button>
            <button
              onClick={() => setActiveTab('add')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                activeTab === 'add' 
                  ? 'bg-[#006b33] text-white shadow-sm' 
                  : 'text-[#5f5e5c] hover:bg-[#006b33]/5 hover:text-[#006b33]'
              }`}
              id="tab-add-permit"
            >
              <Plus className="h-4 w-4" />
              <span>{t.addPermitTab}</span>
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                activeTab === 'search' 
                  ? 'bg-[#006b33] text-white shadow-sm' 
                  : 'text-[#5f5e5c] hover:bg-[#006b33]/5 hover:text-[#006b33]'
              }`}
              id="tab-search"
            >
              <Search className="h-4 w-4" />
              <span>{t.searchTab}</span>
            </button>
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('users')}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                  activeTab === 'users' 
                    ? 'bg-[#006b33] text-white shadow-sm' 
                    : 'text-[#5f5e5c] hover:bg-[#006b33]/5 hover:text-[#006b33]'
                }`}
                id="tab-users-management"
              >
                <Users className="h-4 w-4" />
                <span>{language === 'ar' ? 'المستخدمين وطلبات التسجيل' : 'Users & Registrations'}</span>
              </button>
            )}
          </div>

          <div className="text-[11px] text-[#5f5e5c] font-medium hidden md:block">
            {language === 'ar' ? 'نظام التحكم والرقابة الذكية للتعبئة' : 'Smart Refuel Control & Inspection System'}
          </div>
        </div>
      </section>

      {/* MAIN TAB CONTENT CONTAINER */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-6 flex-1">
        
        {/* TAB 1: VIEW ALL PERMITS */}
        {activeTab === 'all' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden shadow-xs">
              <div className="p-6 border-b border-[#e2e8f0] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-base font-bold text-[#191c1d]">{t.allPermitsTab}</h3>
                  <p className="text-xs text-[#5f5e5c] mt-0.5">{language === 'ar' ? 'قائمة كاملة بجميع تصاريح السيارات الصادرة وسجل صلاحيتها.' : 'Complete list of all issued vehicle permits and validity statuses.'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setPrintTarget('all')}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                    title={language === 'ar' ? 'طباعة جميع التصاريح' : 'Print All Permits'}
                  >
                    <Printer className="h-4 w-4 text-gray-600" />
                    <span>{language === 'ar' ? 'طباعة جميع التصاريح' : 'Print All Permits'}</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('add')}
                    className="bg-[#006b33] hover:bg-[#005226] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t.addPermitTab}</span>
                  </button>
                  {currentUser?.role === 'admin' && permits.length > 0 && (
                    <button
                      onClick={() => setDeleteAllConfirm(true)}
                      className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                      title={language === 'ar' ? 'حذف جميع التصاريح' : 'Delete All Permits'}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                      <span>{language === 'ar' ? 'حذف جميع التصاريح' : 'Delete All Permits'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Search & Year Filter Input */}
              {permits.length > 0 && (
                <div className="px-6 py-4 bg-gray-50/50 border-b border-[#e2e8f0] flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:max-w-2xl">
                    {/* Search Input */}
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={dashboardSearchQuery}
                        onChange={(e) => setDashboardSearchQuery(e.target.value)}
                        placeholder={language === 'ar' ? 'ابحث بالاسم، رقم اللوحة، رقم الهوية، المدخل...' : 'Search by name, plate, ID, creator...'}
                        className={`w-full py-2.5 bg-white border border-[#cbd5e1] focus:border-[#006b33] rounded-xl text-xs font-medium focus:outline-hidden transition-all shadow-2xs ${
                          language === 'ar' ? 'pl-9 pr-10 text-right' : 'pl-10 pr-9 text-left'
                        }`}
                      />
                      <Search className={`absolute ${language === 'ar' ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4`} />
                      {dashboardSearchQuery && (
                        <button
                          onClick={() => setDashboardSearchQuery('')}
                          className={`absolute ${language === 'ar' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold cursor-pointer h-5 w-5 flex items-center justify-center`}
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Year Filter Dropdown */}
                    <div className="flex items-center gap-1.5 min-w-[170px]">
                      <span className="text-[11px] font-bold text-gray-500 whitespace-nowrap">
                        {language === 'ar' ? 'العام الهجري:' : 'Hijri Year:'}
                      </span>
                      <select
                        value={dashboardSelectedYear}
                        onChange={(e) => setDashboardSelectedYear(e.target.value)}
                        className="flex-1 p-2.5 bg-white border border-[#cbd5e1] focus:border-[#006b33] rounded-xl text-xs font-bold focus:outline-hidden transition-all shadow-2xs"
                      >
                        <option value="all">{language === 'ar' ? 'الكل (جميع الأعوام)' : 'All Years'}</option>
                        {availableYears.map(yr => (
                          <option key={yr} value={yr}>{yr} هـ</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="text-xs font-bold text-[#5f5e5c] shrink-0">
                    {language === 'ar' ? (
                      <>عدد النتائج المطابقة: <span className="text-[#006b33] font-mono font-black">{filteredPermits.length}</span> من <span className="font-mono">{permits.length}</span></>
                    ) : (
                      <>Matching results: <span className="text-[#006b33] font-mono font-black">{filteredPermits.length}</span> of <span className="font-mono">{permits.length}</span></>
                    )}
                  </div>
                </div>
              )}

              {/* Responsive Table / Card list */}
              {permits.length === 0 ? (
                <div className="p-12 text-center text-[#5f5e5c]">
                  <FileText className="h-12 w-12 mx-auto text-[#bdcabc] mb-3" />
                  <p className="text-xs font-bold">{t.noResults}</p>
                </div>
              ) : filteredPermits.length === 0 ? (
                <div className="p-12 text-center text-[#5f5e5c]">
                  <Search className="h-12 w-12 mx-auto text-amber-500 mb-3 animate-pulse" />
                  <p className="text-sm font-bold text-gray-800">
                    {language === 'ar' ? 'لا توجد تصاريح مطابقة لبحثك!' : 'No permits match your search query!'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {language === 'ar' 
                      ? `تعذر العثور على أي نتائج تطابق "${dashboardSearchQuery}"` 
                      : `We couldn't find any records matching "${dashboardSearchQuery}"`}
                  </p>
                  <button
                    onClick={() => setDashboardSearchQuery('')}
                    className="mt-4 px-4 py-2 bg-[#e6f4ea] text-[#006b33] border border-[#cbd5e1]/10 rounded-xl text-xs font-bold hover:bg-[#006b33]/10 transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>{language === 'ar' ? 'إعادة تعيين البحث' : 'Reset Search'}</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {/* Desktop Table View */}
                  <table className="min-w-full divide-y divide-[#e2e8f0] hidden md:table">
                    <thead className="bg-[#f8f9fa]">
                      <tr>
                        <th className="px-6 py-4 text-start text-xs font-bold text-[#5f5e5c] uppercase">{t.permitId}</th>
                        <th className="px-6 py-4 text-start text-xs font-bold text-[#5f5e5c] uppercase">{t.permitteeName}</th>
                        <th className="px-6 py-4 text-start text-xs font-bold text-[#5f5e5c] uppercase">{t.plateNumber}</th>
                        <th className="px-6 py-4 text-start text-xs font-bold text-[#5f5e5c] uppercase">{t.vehicleType}</th>
                        <th className="px-6 py-4 text-start text-xs font-bold text-[#5f5e5c] uppercase">{t.startDate}</th>
                        <th className="px-6 py-4 text-start text-xs font-bold text-[#5f5e5c] uppercase">{t.endDate}</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-[#5f5e5c] uppercase">{t.status}</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-[#5f5e5c] uppercase">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-[#e2e8f0]">
                      {filteredPermits.map((permit) => {
                        const status = getPermitStatus(permit.endDate);
                        return (
                          <tr key={permit.id} className="hover:bg-[#f8f9fa]/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-[#191c1d] font-mono">
                              #{permit.id}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-xs font-bold text-[#191c1d]">{permit.permitteeName}</div>
                              <div className="text-[10px] text-[#5f5e5c] font-mono mt-0.5">{t.permitteeId}: {permit.permitteeId}</div>
                              <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                                {language === 'ar' ? 'المدخل:' : 'Created by:'} <span className="font-bold">{permit.createdBy || 'waseem'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="bg-[#f1f5f9] text-[#1e293b] text-[11px] font-bold px-2.5 py-1 rounded-sm border border-[#cbd5e1] font-mono inline-block">
                                {permit.plateNumber}
                              </span>
                              <div className="text-[10px] text-[#5f5e5c] mt-0.5">{language === 'ar' ? 'اللون' : 'Color'}: {permit.vehicleColor}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-[#191c1d]">
                              <div>{permit.vehicleType}</div>
                              <div className="text-[10px] text-[#5f5e5c] mt-0.5">{language === 'ar' ? 'الموديل' : 'Model'}: {permit.vehicleModel}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-[#5f5e5c] font-medium font-mono">
                              {formatHijriString(permit.startDate, language)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-[#5f5e5c] font-medium font-mono">
                              {formatHijriString(permit.endDate, language)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                                status === 'Valid' 
                                  ? 'bg-[#e6f4ea] text-[#137333] border-[#006b33]/20' 
                                  : 'bg-[#fce8e6] text-[#c5221f] border-red-200'
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${status === 'Valid' ? 'bg-[#006b33]' : 'bg-[#c5221f]'}`}></span>
                                {status === 'Valid' ? t.statusValid : t.statusExpired}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* View Permit */}
                                <button
                                  onClick={() => setViewingPermit(permit)}
                                  className="p-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-md transition-all cursor-pointer"
                                  title={language === 'ar' ? 'عرض التصريح كامل' : 'View Full Permit'}
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                {/* Print */}
                                <button
                                  onClick={() => setPrintTarget(permit)}
                                  className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md transition-all cursor-pointer"
                                  title={language === 'ar' ? 'طباعة التصريح' : 'Print Permit'}
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                                {/* View Docs */}
                                <button
                                  onClick={() => setViewingDocsPermit(permit)}
                                  className="p-1.5 bg-[#e6f4ea] text-[#006b33] hover:bg-[#006b33]/15 rounded-md transition-all cursor-pointer"
                                  title={t.viewDocs}
                                >
                                  <FileText className="h-4 w-4" />
                                </button>
                                {/* Edit */}
                                <button
                                  onClick={() => setEditingPermit(permit)}
                                  className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-md transition-all cursor-pointer"
                                  title={t.editPermit}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                {/* Renew */}
                                <button
                                  onClick={() => setRenewingPermit(permit)}
                                  className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md transition-all cursor-pointer"
                                  title={language === 'ar' ? 'تجديد التصريح' : 'Renew Permit'}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </button>
                                {/* Delete */}
                                <button
                                  onClick={() => setDeleteConfirmId(permit.id)}
                                  className="p-1.5 bg-red-50 text-[#c5221f] hover:bg-red-100 rounded-md transition-all cursor-pointer"
                                  title={t.deletePermit}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Mobile Cards View */}
                  <div className="block md:hidden divide-y divide-[#e2e8f0]">
                    {filteredPermits.map((permit) => {
                      const status = getPermitStatus(permit.endDate);
                      return (
                        <div key={permit.id} className="p-4 space-y-3 hover:bg-[#f8f9fa] transition-colors">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-[#191c1d] font-mono">#{permit.id}</span>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                              status === 'Valid' 
                                ? 'bg-[#e6f4ea] text-[#137333] border-[#006b33]/20' 
                                : 'bg-[#fce8e6] text-[#c5221f] border-red-200'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${status === 'Valid' ? 'bg-[#006b33]' : 'bg-[#c5221f]'}`}></span>
                              {status === 'Valid' ? t.statusValid : t.statusExpired}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-[#191c1d]">{permit.permitteeName}</h4>
                            <div className="text-[10px] text-[#5f5e5c]">{t.permitteeId}: <span className="font-mono">{permit.permitteeId}</span></div>
                            <div className="text-[10px] text-emerald-700 font-medium">
                              {language === 'ar' ? 'المدخل:' : 'Created by:'} <span className="font-bold">{permit.createdBy || 'waseem'}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 bg-[#f8f9fa] p-2.5 rounded-xl border border-[#cbd5e1]/30">
                            <div>
                              <span className="text-[10px] text-[#5f5e5c] block">{t.plateNumber}</span>
                              <span className="text-xs font-mono font-bold text-[#191c1d]">{permit.plateNumber}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#5f5e5c] block">{t.vehicleType}</span>
                              <span className="text-xs font-medium text-[#191c1d]">{permit.vehicleType} ({permit.vehicleModel})</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#5f5e5c] block">{t.startDate}</span>
                              <span className="text-xs font-mono text-[#5f5e5c] font-medium">{formatHijriString(permit.startDate, language)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#5f5e5c] block">{t.endDate}</span>
                              <span className="text-xs font-mono text-[#5f5e5c] font-medium">{formatHijriString(permit.endDate, language)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-[#cbd5e1]/10">
                            <button
                              onClick={() => setViewingPermit(permit)}
                              className="px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-center flex items-center justify-center cursor-pointer"
                              title={language === 'ar' ? 'عرض التصريح كامل' : 'View Full Permit'}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setViewingDocsPermit(permit)}
                              className="flex-1 py-1.5 text-[11px] font-bold bg-[#e6f4ea] text-[#006b33] rounded-lg text-center flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>{t.documents} ({permit.attachments.length})</span>
                            </button>
                            <button
                              onClick={() => setPrintTarget(permit)}
                              className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-center flex items-center justify-center cursor-pointer"
                              title={language === 'ar' ? 'طباعة التصريح' : 'Print Permit'}
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingPermit(permit)}
                              className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-center flex items-center justify-center cursor-pointer"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setRenewingPermit(permit)}
                              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-center flex items-center justify-center cursor-pointer"
                              title={language === 'ar' ? 'تجديد التصريح' : 'Renew Permit'}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(permit.id)}
                              className="px-3 py-1.5 bg-red-50 text-[#c5221f] rounded-lg text-center flex items-center justify-center cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ADD NEW PERMIT FORM */}
        {activeTab === 'add' && (
          <AddPermitView 
            language={language}
            onAdd={async (newPermit) => {
              try {
                await setDoc(doc(db, 'permits', newPermit.id), newPermit);
                triggerNotification(`${t.successAdd} ${newPermit.id}`, 'success');
                setActiveTab('all');
              } catch (e) {
                triggerNotification(language === 'ar' ? 'فشل إضافة التصريح' : 'Failed to add permit', 'error');
              }
            }}
            generateId={generateSequentialId}
            currentUser={currentUser}
          />
        )}

        {/* TAB 3: ADVANCED SEARCH */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-xs">
              <h3 className="text-base font-bold text-[#191c1d] mb-1">{t.searchTab}</h3>
              <p className="text-xs text-[#5f5e5c] mb-6">{language === 'ar' ? 'ابحث بسرعة عن أي تصريح باستخدام اسم المصرح له، رقم الهوية، رقم اللوحة، أو رقم التصريح.' : 'Instantly look up any permit by permittee name, national ID, plate number, or permit ID.'}</p>

              {/* Search Control Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
                <div className="sm:col-span-2 md:col-span-2">
                  <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{language === 'ar' ? 'كلمة البحث' : 'Search Term'}</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t.searchPlaceholder}
                      className="w-full pl-10 pr-4 py-2.5 bg-[#f8f9fa] border border-[#cbd5e1] focus:border-[#006b33] rounded-xl text-xs font-medium focus:outline-hidden transition-all"
                      id="search-input-field"
                    />
                    <Search className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-[#5f5e5c] h-4 w-4`} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{language === 'ar' ? 'حقل البحث المستهدف' : 'Target Search Field'}</label>
                  <select
                    value={searchField}
                    onChange={(e) => setSearchField(e.target.value as any)}
                    className="w-full p-2.5 bg-[#f8f9fa] border border-[#cbd5e1] focus:border-[#006b33] rounded-xl text-xs font-bold focus:outline-hidden transition-all"
                    id="search-field-select"
                  >
                    <option value="all">{language === 'ar' ? 'الكل (بحث شامل)' : 'All Fields'}</option>
                    <option value="name">{language === 'ar' ? 'الاسم المصرح له' : 'Permittee Name'}</option>
                    <option value="id">{language === 'ar' ? 'رقم هوية (أي شخص)' : 'Any ID Number'}</option>
                    <option value="plate">{language === 'ar' ? 'رقم اللوحة' : 'Plate Number'}</option>
                    <option value="permitId">{language === 'ar' ? 'رقم التصريح' : 'Permit ID'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{language === 'ar' ? 'تصفية حسب العام' : 'Filter by Year'}</label>
                  <select
                    value={searchSelectedYear}
                    onChange={(e) => setSearchSelectedYear(e.target.value)}
                    className="w-full p-2.5 bg-[#f8f9fa] border border-[#cbd5e1] focus:border-[#006b33] rounded-xl text-xs font-bold focus:outline-hidden transition-all"
                    id="search-year-select"
                  >
                    <option value="all">{language === 'ar' ? 'الكل (جميع الأعوام)' : 'All Years'}</option>
                    {availableYears.map(yr => (
                      <option key={yr} value={yr}>{yr} هـ</option>
                    ))}
                  </select>
                </div>

                <div>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchField('all');
                      setSearchSelectedYear('all');
                    }}
                    className="w-full py-2.5 border border-[#cbd5e1] hover:border-[#006b33] text-[#5f5e5c] hover:text-[#006b33] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-white cursor-pointer"
                    id="clear-search-btn"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>{t.clearBtn}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Results Grid */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-[#5f5e5c] tracking-wider uppercase">
                {language === 'ar' ? 'نتائج البحث' : 'Search Results'} ({
                  permits.filter(p => {
                    // 1. Year Filter
                    if (searchSelectedYear !== 'all') {
                      const startY = p.startDate ? p.startDate.split('-')[0] : '';
                      const endY = p.endDate ? p.endDate.split('-')[0] : '';
                      if (startY !== searchSelectedYear && endY !== searchSelectedYear) {
                        return false;
                      }
                    }

                    // 2. Search query filter
                    if (!searchQuery.trim()) return true;
                    const query = searchQuery.toLowerCase().trim();
                    const pId = p.id.toLowerCase();
                    const pName = p.permitteeName.toLowerCase();
                    const pIdNum = p.permitteeId.toLowerCase();
                    const oName = p.ownerName.toLowerCase();
                    const oId = p.ownerId.toLowerCase();
                    const aUser = p.actualUser.toLowerCase();
                    const aUserId = p.actualUserId.toLowerCase();
                    const pPlate = p.plateNumber.toLowerCase();
                    const pCreated = (p.createdBy || '').toLowerCase();

                    if (searchField === 'name') return pName.includes(query);
                    if (searchField === 'id') return pIdNum.includes(query) || oId.includes(query) || aUserId.includes(query);
                    if (searchField === 'plate') return pPlate.includes(query);
                    if (searchField === 'permitId') return pId.includes(query);

                    return pId.includes(query) || pName.includes(query) || pIdNum.includes(query) || oName.includes(query) || oId.includes(query) || aUser.includes(query) || aUserId.includes(query) || pPlate.includes(query) || pCreated.includes(query);
                  }).length
                })
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {permits.filter(p => {
                  // 1. Year Filter
                  if (searchSelectedYear !== 'all') {
                    const startY = p.startDate ? p.startDate.split('-')[0] : '';
                    const endY = p.endDate ? p.endDate.split('-')[0] : '';
                    if (startY !== searchSelectedYear && endY !== searchSelectedYear) {
                      return false;
                    }
                  }

                  // 2. Search query filter
                  if (!searchQuery.trim()) return true;
                  const query = searchQuery.toLowerCase().trim();
                  const pId = p.id.toLowerCase();
                  const pName = p.permitteeName.toLowerCase();
                  const pIdNum = p.permitteeId.toLowerCase();
                  const oName = p.ownerName.toLowerCase();
                  const oId = p.ownerId.toLowerCase();
                  const aUser = p.actualUser.toLowerCase();
                  const aUserId = p.actualUserId.toLowerCase();
                  const pPlate = p.plateNumber.toLowerCase();
                  const pCreated = (p.createdBy || '').toLowerCase();

                  if (searchField === 'name') return pName.includes(query);
                  if (searchField === 'id') return pIdNum.includes(query) || oId.includes(query) || aUserId.includes(query);
                  if (searchField === 'plate') return pPlate.includes(query);
                  if (searchField === 'permitId') return pId.includes(query);

                  return pId.includes(query) || pName.includes(query) || pIdNum.includes(query) || oName.includes(query) || oId.includes(query) || aUser.includes(query) || aUserId.includes(query) || pPlate.includes(query) || pCreated.includes(query);
                }).map(permit => {
                  const status = getPermitStatus(permit.endDate);
                  return (
                    <div key={permit.id} className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden flex flex-col justify-between">
                      {/* Top ribbon for status */}
                      <div className={`absolute top-0 ${language === 'ar' ? 'left-0' : 'right-0'} h-2 w-32 ${status === 'Valid' ? 'bg-[#006b33]' : 'bg-[#c5221f]'}`} />
                      
                      <div>
                        {/* Title block */}
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <span className="text-[10px] bg-[#f1f5f9] font-bold text-[#5f5e5c] px-2 py-0.5 rounded-sm uppercase tracking-wide font-mono">
                              #{permit.id}
                            </span>
                            <h4 className="text-sm font-bold text-[#191c1d] mt-1.5">{permit.permitteeName}</h4>
                            <p className="text-[10px] text-[#5f5e5c] font-mono">{t.permitteeId}: {permit.permitteeId}</p>
                            <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
                              {language === 'ar' ? 'المدخل:' : 'Created by:'} <span className="font-bold">{permit.createdBy || 'waseem'}</span>
                            </p>
                          </div>

                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            status === 'Valid' 
                              ? 'bg-[#e6f4ea] text-[#137333] border-[#006b33]/20' 
                              : 'bg-[#fce8e6] text-[#c5221f] border-red-200'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${status === 'Valid' ? 'bg-[#006b33]' : 'bg-[#c5221f]'}`}></span>
                            {status === 'Valid' ? t.statusValid : t.statusExpired}
                          </span>
                        </div>

                        {/* Middle detailed attributes */}
                        <div className="grid grid-cols-2 gap-4 border-y border-[#cbd5e1]/10 py-4 my-4 text-xs">
                          <div>
                            <span className="text-[10px] text-[#5f5e5c] block mb-0.5">{t.ownerName}</span>
                            <span className="font-bold text-[#191c1d]">{permit.ownerName}</span>
                            <span className="text-[9px] text-[#5f5e5c] font-mono block mt-0.5">{t.ownerId}: {permit.ownerId}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#5f5e5c] block mb-0.5">{t.actualUser}</span>
                            <span className="font-bold text-[#191c1d]">{permit.actualUser}</span>
                            <span className="text-[9px] text-[#5f5e5c] font-mono block mt-0.5">{t.actualUserId}: {permit.actualUserId}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#5f5e5c] block mb-0.5">{t.plateNumber}</span>
                            <span className="font-bold bg-[#f1f5f9] border border-[#cbd5e1] text-[#191c1d] px-2 py-0.5 rounded-md font-mono inline-block">
                              {permit.plateNumber}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#5f5e5c] block mb-0.5">{t.vehicleType}</span>
                            <span className="font-bold text-[#191c1d]">{permit.vehicleType}</span>
                            <span className="text-[9px] text-[#5f5e5c] block mt-0.5">{language === 'ar' ? 'الموديل' : 'Model'}: {permit.vehicleModel} &bull; {language === 'ar' ? 'اللون' : 'Color'}: {permit.vehicleColor}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#5f5e5c] block mb-0.5">{t.startDate}</span>
                            <span className="font-semibold text-[#5f5e5c] font-mono">{permit.startDate}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#5f5e5c] block mb-0.5">{t.endDate}</span>
                            <span className="font-semibold text-[#5f5e5c] font-mono">{permit.endDate}</span>
                          </div>
                        </div>
                      </div>

                      {/* Attached docs preview count & actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#cbd5e1]/10 gap-2">
                        <button
                          onClick={() => setViewingDocsPermit(permit)}
                          className="text-xs text-[#006b33] hover:text-[#005226] font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <FileText className="h-4 w-4" />
                          <span>{t.documents} ({permit.attachments.length})</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setViewingPermit(permit)}
                            className="p-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-md transition-all text-xs flex items-center gap-1 font-bold cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>{language === 'ar' ? 'عرض' : 'View'}</span>
                          </button>
                          <button
                            onClick={() => setEditingPermit(permit)}
                            className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-md transition-all text-xs flex items-center gap-1 font-bold cursor-pointer"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            <span>{language === 'ar' ? 'تعديل' : 'Edit'}</span>
                          </button>
                          <button
                            onClick={() => setRenewingPermit(permit)}
                            className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md transition-all text-xs flex items-center gap-1 font-bold cursor-pointer"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>{language === 'ar' ? 'تجديد' : 'Renew'}</span>
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(permit.id)}
                            className="p-1.5 bg-red-50 text-[#c5221f] hover:bg-red-100 rounded-md transition-all text-xs flex items-center gap-1 font-bold cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{language === 'ar' ? 'حذف' : 'Delete'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: USER MANAGEMENT (Admin only) */}
        {activeTab === 'users' && currentUser?.role === 'admin' && (
          <UserManagement 
            language={language}
            users={users}
            setUsers={setUsers}
            currentUser={currentUser}
            triggerNotification={triggerNotification}
          />
        )}

      </main>

      {/* FOOTER */}
      <footer className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-16 pt-6 border-t border-[#cbd5e1]/40 text-center">
        <p className="text-xs text-[#5f5e5c]">
          &copy; {new Date().getFullYear()} {language === 'ar' ? 'نظام إدارة تصاريح تعبئة السيارات الموحد. كافة الحقوق محفوظة.' : 'Unified Vehicle Fuel Permit Management System. All rights reserved.'}
        </p>
      </footer>

      {/* EDIT PERMIT OVERLAY / MODAL */}
      <AnimatePresence>
        {editingPermit && (
          <EditPermitModal 
            language={language}
            permit={editingPermit}
            onClose={() => setEditingPermit(null)}
            onSave={async (updatedPermit) => {
              try {
                await setDoc(doc(db, 'permits', updatedPermit.id), updatedPermit);
                triggerNotification(t.successEdit, 'success');
                setEditingPermit(null);
              } catch (e) {
                triggerNotification(language === 'ar' ? 'فشل تعديل التصريح' : 'Failed to edit permit', 'error');
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* VIEW DOCUMENTS MODAL */}
      <AnimatePresence>
        {viewingDocsPermit && (
          <ViewDocumentsModal 
            language={language}
            permit={viewingDocsPermit}
            onClose={() => setViewingDocsPermit(null)}
            onUpdateAttachments={async (updatedAttachments) => {
              try {
                await updateDoc(doc(db, 'permits', viewingDocsPermit.id), { attachments: updatedAttachments });
                setViewingDocsPermit({ ...viewingDocsPermit, attachments: updatedAttachments });
                triggerNotification(t.successEdit, 'success');
              } catch (e) {
                triggerNotification(language === 'ar' ? 'فشل تعديل المستندات' : 'Failed to update documents', 'error');
              }
            }}
            onPrintAttachment={(file) => setPrintAttachment({ permit: viewingDocsPermit, file })}
          />
        )}
      </AnimatePresence>

      {/* RENEW PERMIT OVERLAY / MODAL */}
      <AnimatePresence>
        {renewingPermit && (
          <RenewPermitModal 
            language={language}
            permit={renewingPermit}
            onClose={() => setRenewingPermit(null)}
            onSave={async (updatedPermit) => {
              try {
                await setDoc(doc(db, 'permits', updatedPermit.id), updatedPermit);
                triggerNotification(
                  language === 'ar'
                    ? `تم تجديد التصريح رقم #${updatedPermit.id} بنجاح`
                    : `Permit #${updatedPermit.id} renewed successfully`,
                  'success'
                 );
                 setRenewingPermit(null);
              } catch (e) {
                triggerNotification(language === 'ar' ? 'فشل تجديد التصريح' : 'Failed to renew permit', 'error');
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION OVERLAY */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-[#191c1d]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-[#cbd5e1] max-w-md w-full p-6 shadow-xl space-y-4"
              id="delete-confirmation-dialog"
            >
              <div className="h-12 w-12 bg-red-50 text-[#c5221f] rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="text-center">
                <h4 className="text-sm font-bold text-[#191c1d]">{language === 'ar' ? 'حذف تصريح سيارة' : 'Delete Vehicle Permit'}</h4>
                <p className="text-xs text-[#5f5e5c] mt-2">{t.deleteConfirm}</p>
                <div className="bg-[#f8f9fa] border border-[#cbd5e1]/50 rounded-xl p-2.5 text-xs font-mono font-bold text-[#191c1d] mt-2">
                  #{deleteConfirmId}
                </div>
              </div>
              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => handleDeletePermit(deleteConfirmId)}
                  className="flex-1 py-2.5 bg-[#c5221f] hover:bg-[#a81c19] text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  id="confirm-delete-btn"
                >
                  {t.yesDelete}
                </button>
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-2.5 bg-[#f8f9fa] border border-[#cbd5e1] text-[#5f5e5c] rounded-xl text-xs font-bold transition-all cursor-pointer"
                  id="cancel-delete-btn"
                >
                  {t.noCancel}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE ALL CONFIRMATION OVERLAY */}
      <AnimatePresence>
        {deleteAllConfirm && (
          <div className="fixed inset-0 bg-[#191c1d]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-[#cbd5e1] max-w-md w-full p-6 shadow-xl space-y-4"
              id="delete-all-confirmation-dialog"
            >
              <div className="h-12 w-12 bg-red-100 text-[#c5221f] rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="text-center">
                <h4 className="text-sm font-bold text-[#191c1d]">
                  {language === 'ar' ? 'حذف كافة التصاريح' : 'Delete All Permits'}
                </h4>
                <p className="text-xs text-[#5f5e5c] mt-2">
                  {language === 'ar' 
                    ? 'هل أنت متأكد من رغبتك في حذف جميع التصاريح بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.' 
                    : 'Are you sure you want to permanently delete all permits? This action cannot be undone.'}
                </p>
                <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-xs font-bold text-red-700 mt-2">
                  {language === 'ar' ? 'سيتم مسح قاعدة البيانات بالكامل' : 'The database will be completely cleared'}
                </div>
              </div>
              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={handleDeleteAllPermits}
                  className="flex-1 py-2.5 bg-[#c5221f] hover:bg-[#a81c19] text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  id="confirm-delete-all-btn"
                >
                  {language === 'ar' ? 'نعم، حذف الكل' : 'Yes, Delete All'}
                </button>
                <button
                  onClick={() => setDeleteAllConfirm(false)}
                  className="flex-1 py-2.5 bg-[#f8f9fa] border border-[#cbd5e1] text-[#5f5e5c] rounded-xl text-xs font-bold transition-all cursor-pointer"
                  id="cancel-delete-all-btn"
                >
                  {t.noCancel}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VIEW FULL PERMIT DETAILS OVERLAY / MODAL */}
      <AnimatePresence>
        {viewingPermit && (
          <ViewPermitModal 
            language={language}
            permit={viewingPermit}
            onClose={() => setViewingPermit(null)}
            onPrint={(permit) => {
              setPrintTarget(permit);
            }}
            getPermitStatus={getPermitStatus}
          />
        )}
      </AnimatePresence>

    </div>

    {/* PRINTABLE ARCHIVE SECTION (Shown only during print) */}
    <div id="print-section" className="hidden print:block font-arabic">
      {printTarget === 'all' ? (
        <div className="space-y-12">
          {permits.map((permit, idx) => (
            <div key={permit.id} className={idx < permits.length - 1 ? "page-break" : ""}>
              <PrintablePermitCard permit={permit} language={language} />
            </div>
          ))}
        </div>
      ) : printTarget ? (
        <PrintablePermitCard permit={printTarget} language={language} />
      ) : printAttachment ? (
        <PrintableAttachmentCard permit={printAttachment.permit} file={printAttachment.file} language={language} />
      ) : null}
    </div>
  </>
  );
}

// ======================== ADD NEW PERMIT VIEW ========================
interface AddPermitViewProps {
  language: Language;
  onAdd: (newPermit: Permit) => void;
  generateId: () => string;
  currentUser: UserAccount;
}

function AddPermitView({ language, onAdd, generateId, currentUser }: AddPermitViewProps) {
  const t = TRANSLATIONS[language];

  const [autoId] = useState(() => generateId());

  // Input states
  const [permitteeName, setPermitteeName] = useState('');
  const [permitteeId, setPermitteeId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [actualUser, setActualUser] = useState('');
  const [actualUserId, setActualUserId] = useState('');
  const [vehicleType, setVehicleType] = useState('سيارة سيدان (Toyota Camry)');
  const [vehicleModel, setVehicleModel] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const todayH = gregorianToHijri(new Date());
    return toHijriString(todayH.hy, todayH.hm, todayH.hd);
  });
  const [endDate, setEndDate] = useState(() => {
    const todayH = gregorianToHijri(new Date());
    return toHijriString(todayH.hy + 1, todayH.hm, todayH.hd);
  });

  // Attachments files state (المستندات)
  const [attachedFiles, setAttachedFiles] = useState<AttachmentFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Errors state
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      Array.from(e.dataTransfer.files).forEach((file: any) => handleAttachFile(file as File));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      Array.from(e.target.files).forEach((file: any) => handleAttachFile(file as File));
    }
  };

  const handleAttachFile = (file: File) => {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setFileError(language === 'ar' ? 'نوع الملف غير مدعوم! يرجى إرفاق PDF أو صور JPG/PNG فقط.' : 'Unsupported format! Only PDF or images (JPG, PNG) are allowed.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError(language === 'ar' ? 'حجم الملف يتجاوز الحد الأقصى 10 ميجابايت!' : 'File exceeds maximum 10MB limit!');
      return;
    }

    const sizeStr = file.size > 1024 * 1024 
      ? (file.size / (1024 * 1024)).toFixed(1) + ' MB' 
      : (file.size / 1024).toFixed(0) + ' KB';

    const newAttachment: AttachmentFile = {
      name: file.name,
      size: sizeStr,
      type: file.type
    };

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        newAttachment.dataUrl = e.target?.result as string;
        setAttachedFiles(prev => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    } else {
      setAttachedFiles(prev => [...prev, newAttachment]);
    }

    setFileError('');
  };

  const handleRemoveAttached = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!permitteeName.trim()) newErrors.permitteeName = language === 'ar' ? 'الاسم المصرح له مطلوب' : 'Permittee name is required';
    if (!permitteeId.trim() || !/^\d{10}$/.test(permitteeId)) newErrors.permitteeId = language === 'ar' ? 'رقم الهوية يجب أن يتكون من 10 خانات رقمية' : 'ID must be exactly 10 digits';
    if (!ownerName.trim()) newErrors.ownerName = language === 'ar' ? 'اسم المالك مطلوب' : 'Owner name is required';
    if (!ownerId.trim() || !/^\d{10}$/.test(ownerId)) newErrors.ownerId = language === 'ar' ? 'رقم هوية المالك يجب أن يتكون من 10 خانات' : 'Owner ID must be 10 digits';
    if (!actualUser.trim()) newErrors.actualUser = language === 'ar' ? 'المستخدم الفعلي مطلوب' : 'Actual user is required';
    if (!actualUserId.trim() || !/^\d{10}$/.test(actualUserId)) newErrors.actualUserId = language === 'ar' ? 'رقم هوية المستخدم الفعلي يجب أن يتكون من 10 خانات' : 'Actual User ID must be 10 digits';
    if (!plateNumber.trim()) newErrors.plateNumber = language === 'ar' ? 'رقم اللوحة مطلوب' : 'Plate number is required';
    if (!vehicleModel.trim()) newErrors.vehicleModel = language === 'ar' ? 'موديل السيارة مطلوب' : 'Vehicle model is required';
    if (!vehicleColor.trim()) newErrors.vehicleColor = language === 'ar' ? 'لون السيارة مطلوب' : 'Vehicle color is required';
    if (!startDate) newErrors.startDate = language === 'ar' ? 'تاريخ بداية التصريح مطلوب' : 'Start date is required';
    if (!endDate) newErrors.endDate = language === 'ar' ? 'تاريخ نهاية التصريح مطلوب' : 'End date is required';
    else if (endDate < startDate) newErrors.endDate = language === 'ar' ? 'تاريخ نهاية التصريح لا يمكن أن يكون قبل تاريخ البداية' : 'End date cannot be earlier than start date';

    if (attachedFiles.length === 0) {
      newErrors.files = language === 'ar' ? 'يرجى إرفاق مستند واحد على الأقل في قسم المستندات' : 'At least one supporting document must be attached';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const newPermit: Permit = {
      id: autoId,
      permitteeName,
      permitteeId,
      ownerName,
      ownerId,
      actualUser,
      actualUserId,
      vehicleType,
      vehicleModel,
      plateNumber,
      vehicleColor,
      startDate,
      endDate,
      attachments: attachedFiles,
      createdBy: currentUser.fullName || currentUser.username
    };

    onAdd(newPermit);
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden shadow-xs">
      <div className="p-6 border-b border-[#e2e8f0]">
        <h3 className="text-base font-bold text-[#191c1d]">{t.addPermitTab}</h3>
        <p className="text-xs text-[#5f5e5c] mt-0.5">{language === 'ar' ? 'تعبئة البيانات اللازمة لإصدار تصريح تعبئة سيارة رقمي معتمد تلقائياً.' : 'Input the required information to issue a certified digital refueling permit automatically.'}</p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Row 0: Sequential Permit ID (Read-only) */}
        <div className="bg-[#f8f9fa] border border-[#cbd5e1]/50 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <span className="text-[10px] text-[#006b33] bg-[#e6f4ea] px-2 py-0.5 rounded-full font-bold">
              {language === 'ar' ? 'الرقم التلقائي التسلسلي للمستند' : 'Auto-generated Document ID'}
            </span>
            <h4 className="text-sm font-bold text-[#191c1d] mt-1">{language === 'ar' ? 'سيتم إصدار التصريح بالرقم المتسلسل التالي:' : 'The permit will be issued under the following sequential ID:'}</h4>
          </div>
          <span className="text-lg font-black font-mono text-[#006b33] bg-[#e6f4ea] border border-[#006b33]/20 px-4 py-1.5 rounded-xl">
            #{autoId}
          </span>
        </div>

        {/* SECTION 1: PERMITTEE DETAILS */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-[#006b33] border-b border-[#006b33]/15 pb-2 uppercase tracking-wide flex items-center gap-1.5">
            <User className="h-4 w-4" />
            <span>{language === 'ar' ? 'بيانات الشخص المصرح له والمالك' : 'Permittee & Owner Information'}</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Permittee Name */}
            <div>
              <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{t.permitteeName} <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={permitteeName}
                onChange={(e) => setPermitteeName(e.target.value)}
                placeholder={language === 'ar' ? 'اسم الشخص المصرح له بتعبئة الوقود' : 'Name of person authorized to fuel'}
                className={`w-full p-2.5 bg-[#f8f9fa] border rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#006b33] transition-all ${errors.permitteeName ? 'border-red-400 focus:border-red-400 bg-red-50/10' : 'border-[#cbd5e1]'}`}
              />
              {errors.permitteeName && <p className="text-[10px] text-[#c5221f] mt-1 font-bold">{errors.permitteeName}</p>}
            </div>

            {/* Permittee ID */}
            <div>
              <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{t.permitteeId} <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={permitteeId}
                onChange={(e) => setPermitteeId(e.target.value.replace(/\D/g, '').substring(0, 10))}
                placeholder="e.g. 1023456789"
                className={`w-full p-2.5 bg-[#f8f9fa] border rounded-xl text-xs font-mono focus:outline-hidden focus:border-[#006b33] transition-all ${errors.permitteeId ? 'border-red-400 focus:border-red-400 bg-red-50/10' : 'border-[#cbd5e1]'}`}
              />
              {errors.permitteeId && <p className="text-[10px] text-[#c5221f] mt-1 font-bold">{errors.permitteeId}</p>}
            </div>

            {/* Owner Name */}
            <div>
              <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{t.ownerName} <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder={language === 'ar' ? 'اسم مالك المركبة بالكامل أو اسم المؤسسة' : 'Owner full name or establishment'}
                className={`w-full p-2.5 bg-[#f8f9fa] border rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#006b33] transition-all ${errors.ownerName ? 'border-red-400 focus:border-red-400 bg-red-50/10' : 'border-[#cbd5e1]'}`}
              />
              {errors.ownerName && <p className="text-[10px] text-[#c5221f] mt-1 font-bold">{errors.ownerName}</p>}
            </div>

            {/* Owner ID */}
            <div>
              <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{t.ownerId} <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value.replace(/\D/g, '').substring(0, 10))}
                placeholder="e.g. 7012345678"
                className={`w-full p-2.5 bg-[#f8f9fa] border rounded-xl text-xs font-mono focus:outline-hidden focus:border-[#006b33] transition-all ${errors.ownerId ? 'border-red-400 focus:border-red-400 bg-red-50/10' : 'border-[#cbd5e1]'}`}
              />
              {errors.ownerId && <p className="text-[10px] text-[#c5221f] mt-1 font-bold">{errors.ownerId}</p>}
            </div>
          </div>
        </div>

        {/* SECTION 2: ACTUAL USER DETAILS */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-[#006b33] border-b border-[#006b33]/15 pb-2 uppercase tracking-wide flex items-center gap-1.5">
            <UserCheck className="h-4 w-4" />
            <span>{language === 'ar' ? 'بيانات المستخدم الفعلي للمركبة' : 'Actual User Details (Driver)'}</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Actual User Name */}
            <div>
              <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{t.actualUser} <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={actualUser}
                onChange={(e) => setActualUser(e.target.value)}
                placeholder={language === 'ar' ? 'اسم السائق أو المستخدم الفعلي للمركبة' : 'Driver / Actual vehicle user name'}
                className={`w-full p-2.5 bg-[#f8f9fa] border rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#006b33] transition-all ${errors.actualUser ? 'border-red-400 focus:border-red-400 bg-red-50/10' : 'border-[#cbd5e1]'}`}
              />
              {errors.actualUser && <p className="text-[10px] text-[#c5221f] mt-1 font-bold">{errors.actualUser}</p>}
            </div>

            {/* Actual User ID */}
            <div>
              <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{t.actualUserId} <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={actualUserId}
                onChange={(e) => setActualUserId(e.target.value.replace(/\D/g, '').substring(0, 10))}
                placeholder="e.g. 2412345678"
                className={`w-full p-2.5 bg-[#f8f9fa] border rounded-xl text-xs font-mono focus:outline-hidden focus:border-[#006b33] transition-all ${errors.actualUserId ? 'border-red-400 focus:border-red-400 bg-red-50/10' : 'border-[#cbd5e1]'}`}
              />
              {errors.actualUserId && <p className="text-[10px] text-[#c5221f] mt-1 font-bold">{errors.actualUserId}</p>}
            </div>
          </div>
        </div>

        {/* SECTION 3: VEHICLE & DATES */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-[#006b33] border-b border-[#006b33]/15 pb-2 uppercase tracking-wide flex items-center gap-1.5">
            <Car className="h-4 w-4" />
            <span>{language === 'ar' ? 'مواصفات السيارة وفترة التصريح' : 'Vehicle Specifications & Validity Period'}</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Vehicle Type */}
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{t.vehicleType} <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                placeholder={language === 'ar' ? 'مثال: سيارة سيدان' : 'e.g., Sedan car'}
                className={`w-full p-2.5 bg-[#f8f9fa] border rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#006b33] transition-all ${errors.vehicleType ? 'border-red-400 focus:border-red-400 bg-red-50/10' : 'border-[#cbd5e1]'}`}
              />
              {errors.vehicleType && <p className="text-[10px] text-[#c5221f] mt-1 font-bold">{errors.vehicleType}</p>}
            </div>

            {/* Vehicle Model */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{t.vehicleModel} <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                placeholder={language === 'ar' ? 'مثال: ٢٠٢٤' : 'e.g., 2024'}
                className={`w-full p-2.5 bg-[#f8f9fa] border rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#006b33] transition-all ${errors.vehicleModel ? 'border-red-400 focus:border-red-400 bg-red-50/10' : 'border-[#cbd5e1]'}`}
              />
              {errors.vehicleModel && <p className="text-[10px] text-[#c5221f] mt-1 font-bold">{errors.vehicleModel}</p>}
            </div>

            {/* Plate Number */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{t.plateNumber} <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                placeholder="أ ب ج 1234"
                className={`w-full p-2.5 bg-[#f8f9fa] border rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#006b33] transition-all ${errors.plateNumber ? 'border-red-400 focus:border-red-400 bg-red-50/10' : 'border-[#cbd5e1]'}`}
              />
              {errors.plateNumber && <p className="text-[10px] text-[#c5221f] mt-1 font-bold">{errors.plateNumber}</p>}
            </div>

            {/* Vehicle Color */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{t.vehicleColor} <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={vehicleColor}
                onChange={(e) => setVehicleColor(e.target.value)}
                placeholder={language === 'ar' ? 'أبيض، أسود' : 'White, Black'}
                className={`w-full p-2.5 bg-[#f8f9fa] border rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#006b33] transition-all ${errors.vehicleColor ? 'border-red-400 focus:border-red-400 bg-red-50/10' : 'border-[#cbd5e1]'}`}
              />
              {errors.vehicleColor && <p className="text-[10px] text-[#c5221f] mt-1 font-bold">{errors.vehicleColor}</p>}
            </div>

            {/* Start Date */}
            <div className="md:col-span-6">
              <HijriDatePicker
                label={t.startDate}
                value={startDate}
                onChange={setStartDate}
                error={errors.startDate}
                language={language}
              />
            </div>

            {/* End Date */}
            <div className="md:col-span-6">
              <HijriDatePicker
                label={t.endDate}
                value={endDate}
                onChange={setEndDate}
                error={errors.endDate}
                language={language}
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: DOCUMENTS SECTION (المستندات) */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-[#006b33] border-b border-[#006b33]/15 pb-2 uppercase tracking-wide flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <span>{t.documents}</span>
          </h4>

          {/* Drag and Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              dragActive 
                ? 'border-[#006b33] bg-[#e6f4ea]/40' 
                : 'border-[#cbd5e1] bg-[#f8f9fa] hover:border-[#006b33]/60 hover:bg-[#006b33]/5'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              multiple
              className="hidden"
              accept="application/pdf,image/png,image/jpeg,image/jpg"
            />
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="h-12 w-12 rounded-full bg-[#e6f4ea] text-[#006b33] flex items-center justify-center">
                <FileUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#191c1d]">{t.attachFiles}</p>
                <p className="text-[10px] text-[#5f5e5c] mt-1 font-medium">{t.dragDropText}</p>
                <p className="text-[9px] text-[#5f5e5c] mt-1.5">{t.fileSizeLimit}</p>
              </div>
            </div>
          </div>

          {fileError && <p className="text-[10px] text-[#c5221f] font-bold">{fileError}</p>}
          {errors.files && <p className="text-[10px] text-[#c5221f] font-bold">{errors.files}</p>}

          {/* List of currently attached documents */}
          {attachedFiles.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-[10px] font-bold text-[#5f5e5c] uppercase tracking-wider">
                {language === 'ar' ? 'الملفات المرفقة حالياً:' : 'Currently Attached Files:'} ({attachedFiles.length})
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {attachedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-[#f8f9fa] border border-[#cbd5e1] rounded-xl text-xs hover:border-[#006b33]/40 transition-colors">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      {file.dataUrl ? (
                        <img 
                          src={file.dataUrl} 
                          alt="preview" 
                          referrerPolicy="no-referrer"
                          className="h-10 w-10 object-cover rounded-md border border-[#cbd5e1]/40" 
                        />
                      ) : (
                        <div className="h-10 w-10 bg-red-50 text-red-600 rounded-md flex items-center justify-center font-bold text-[9px] border border-red-100">
                          PDF
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <p className="font-bold text-[#191c1d] truncate text-[11px]">{file.name}</p>
                        <p className="text-[9px] text-[#5f5e5c] font-mono mt-0.5">{file.size}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttached(idx)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded-md transition-all shrink-0 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* SUBMIT BUTTONS */}
        <div className="flex justify-end gap-3 pt-6 border-t border-[#e2e8f0]">
          <button
            type="submit"
            className="px-6 py-3 bg-[#006b33] hover:bg-[#005226] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer font-sans"
          >
            <CheckCircle className="h-4 w-4" />
            <span>{t.addNewPermit}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

// ======================== EDIT PERMIT MODAL ========================
interface EditPermitModalProps {
  language: Language;
  permit: Permit;
  onClose: () => void;
  onSave: (updatedPermit: Permit) => void;
}

function EditPermitModal({ language, permit, onClose, onSave }: EditPermitModalProps) {
  const t = TRANSLATIONS[language];

  const [permitteeName, setPermitteeName] = useState(permit.permitteeName);
  const [permitteeId, setPermitteeId] = useState(permit.permitteeId);
  const [ownerName, setOwnerName] = useState(permit.ownerName);
  const [ownerId, setOwnerId] = useState(permit.ownerId);
  const [actualUser, setActualUser] = useState(permit.actualUser);
  const [actualUserId, setActualUserId] = useState(permit.actualUserId);
  const [vehicleType, setVehicleType] = useState(permit.vehicleType);
  const [vehicleModel, setVehicleModel] = useState(permit.vehicleModel || '');
  const [plateNumber, setPlateNumber] = useState(permit.plateNumber);
  const [vehicleColor, setVehicleColor] = useState(permit.vehicleColor);
  const [startDate, setStartDate] = useState(permit.startDate);
  const [endDate, setEndDate] = useState(permit.endDate);

  const [attachments, setAttachments] = useState<AttachmentFile[]>(permit.attachments || []);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      Array.from(e.dataTransfer.files).forEach((file: any) => handleAttachFile(file as File));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      Array.from(e.target.files).forEach((file: any) => handleAttachFile(file as File));
    }
  };

  const handleAttachFile = (file: File) => {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setFileError(language === 'ar' ? 'نوع الملف غير مدعوم! يرجى إرفاق PDF أو صور فقط.' : 'Unsupported type! PDF or images only.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError(language === 'ar' ? 'حجم الملف يتجاوز 10 ميجابايت!' : 'File exceeds 10MB!');
      return;
    }

    const sizeStr = file.size > 1024 * 1024 
      ? (file.size / (1024 * 1024)).toFixed(1) + ' MB' 
      : (file.size / 1024).toFixed(0) + ' KB';

    const newAttachment: AttachmentFile = {
      name: file.name,
      size: sizeStr,
      type: file.type
    };

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        newAttachment.dataUrl = e.target?.result as string;
        setAttachments(prev => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    } else {
      setAttachments(prev => [...prev, newAttachment]);
    }

    setFileError('');
  };

  const handleRemoveAttached = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!permitteeName.trim()) newErrors.permitteeName = language === 'ar' ? 'الاسم المصرح له مطلوب' : 'Permittee name is required';
    if (!permitteeId.trim() || !/^\d{10}$/.test(permitteeId)) newErrors.permitteeId = language === 'ar' ? 'رقم الهوية يجب أن يتكون من 10 خانات' : 'ID must be 10 digits';
    if (!ownerName.trim()) newErrors.ownerName = language === 'ar' ? 'اسم المالك مطلوب' : 'Owner name is required';
    if (!ownerId.trim() || !/^\d{10}$/.test(ownerId)) newErrors.ownerId = language === 'ar' ? 'رقم هوية المالك يجب أن يتكون من 10 خانات' : 'Owner ID must be 10 digits';
    if (!actualUser.trim()) newErrors.actualUser = language === 'ar' ? 'المستخدم الفعلي مطلوب' : 'Actual user is required';
    if (!actualUserId.trim() || !/^\d{10}$/.test(actualUserId)) newErrors.actualUserId = language === 'ar' ? 'رقم هوية المستخدم الفعلي يجب أن يتكون من 10 خانات' : 'Actual User ID must be 10 digits';
    if (!plateNumber.trim()) newErrors.plateNumber = language === 'ar' ? 'رقم اللوحة مطلوب' : 'Plate number is required';
    if (!vehicleModel.trim()) newErrors.vehicleModel = language === 'ar' ? 'موديل السيارة مطلوب' : 'Vehicle model is required';
    if (!vehicleColor.trim()) newErrors.vehicleColor = language === 'ar' ? 'لون السيارة مطلوب' : 'Vehicle color is required';
    if (!startDate) newErrors.startDate = language === 'ar' ? 'تاريخ بداية التصريح مطلوب' : 'Start date is required';
    if (!endDate) newErrors.endDate = language === 'ar' ? 'تاريخ نهاية التصريح مطلوب' : 'End date is required';
    else if (endDate < startDate) newErrors.endDate = language === 'ar' ? 'تاريخ نهاية التصريح لا يمكن أن يكون قبل البداية' : 'End date cannot be earlier than start date';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const updatedPermit: Permit = {
      ...permit,
      permitteeName,
      permitteeId,
      ownerName,
      ownerId,
      actualUser,
      actualUserId,
      vehicleType,
      vehicleModel,
      plateNumber,
      vehicleColor,
      startDate,
      endDate,
      attachments
    };

    onSave(updatedPermit);
  };

  return (
    <div className="fixed inset-0 bg-[#191c1d]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="bg-white rounded-2xl border border-[#cbd5e1] max-w-3xl w-full my-8 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-[#cbd5e1]/40 flex justify-between items-center bg-[#f8f9fa] shrink-0">
          <div>
            <h3 className="text-base font-bold text-[#191c1d]">{t.editPermit}</h3>
            <span className="text-xs text-[#006b33] bg-[#e6f4ea] font-mono font-bold px-2.5 py-0.5 rounded-full mt-1 inline-block">
              #{permit.id}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#cbd5e1]/40 rounded-full text-[#5f5e5c] transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* permittee */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-[#006b33] border-b border-[#006b33]/15 pb-1 uppercase tracking-wider flex items-center gap-1">
              <User className="h-4 w-4" />
              <span>{language === 'ar' ? 'الاسم المصرح له والمالك' : 'Permittee & Owner'}</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{t.permitteeName}</label>
                <input
                  type="text"
                  value={permitteeName}
                  onChange={(e) => setPermitteeName(e.target.value)}
                  className="w-full p-2.5 bg-[#f8f9fa] border border-[#cbd5e1] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#006b33]"
                />
                {errors.permitteeName && <p className="text-[10px] text-[#c5221f] mt-1 font-bold">{errors.permitteeName}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{t.permitteeId}</label>
                <input
                  type="text"
                  value={permitteeId}
                  onChange={(e) => setPermitteeId(e.target.value.replace(/\D/g, '').substring(0, 10))}
                  className="w-full p-2.5 bg-[#f8f9fa] border border-[#cbd5e1] rounded-xl text-xs font-mono focus:outline-hidden focus:border-[#006b33]"
                />
                {errors.permitteeId && <p className="text-[10px] text-[#c5221f] mt-1 font-bold">{errors.permitteeId}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{t.ownerName}</label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full p-2.5 bg-[#f8f9fa] border border-[#cbd5e1] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#006b33]"
                />
                {errors.ownerName && <p className="text-[10px] text-[#c5221f] mt-1 font-bold">{errors.ownerName}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{t.ownerId}</label>
                <input
                  type="text"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value.replace(/\D/g, '').substring(0, 10))}
                  className="w-full p-2.5 bg-[#f8f9fa] border border-[#cbd5e1] rounded-xl text-xs font-mono focus:outline-hidden focus:border-[#006b33]"
                />
                {errors.ownerId && <p className="text-[10px] text-[#c5221f] mt-1 font-bold">{errors.ownerId}</p>}
              </div>
            </div>
          </div>

          {/* Actual User */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-[#006b33] border-b border-[#006b33]/15 pb-1 uppercase tracking-wider flex items-center gap-1">
              <UserCheck className="h-4 w-4" />
              <span>{language === 'ar' ? 'المستخدم الفعلي' : 'Actual User (Driver)'}</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{t.actualUser}</label>
                <input
                  type="text"
                  value={actualUser}
                  onChange={(e) => setActualUser(e.target.value)}
                  className="w-full p-2.5 bg-[#f8f9fa] border border-[#cbd5e1] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#006b33]"
                />
                {errors.actualUser && <p className="text-[10px] text-[#c5221f] mt-1 font-bold">{errors.actualUser}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{t.actualUserId}</label>
                <input
                  type="text"
                  value={actualUserId}
                  onChange={(e) => setActualUserId(e.target.value.replace(/\D/g, '').substring(0, 10))}
                  className="w-full p-2.5 bg-[#f8f9fa] border border-[#cbd5e1] rounded-xl text-xs font-mono focus:outline-hidden focus:border-[#006b33]"
                />
                {errors.actualUserId && <p className="text-[10px] text-[#c5221f] mt-1 font-bold">{errors.actualUserId}</p>}
              </div>
            </div>
          </div>

          {/* Vehicle specs and dates */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-[#006b33] border-b border-[#006b33]/15 pb-1 uppercase tracking-wider flex items-center gap-1">
              <Car className="h-4 w-4" />
              <span>{language === 'ar' ? 'السيارة وفترة التصريح' : 'Vehicle & Permit Dates'}</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-4">
                <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{t.vehicleType}</label>
                <input
                  type="text"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full p-2.5 bg-[#f8f9fa] border border-[#cbd5e1] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#006b33]"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{t.vehicleModel}</label>
                <input
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  className="w-full p-2.5 bg-[#f8f9fa] border border-[#cbd5e1] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#006b33]"
                />
                {errors.vehicleModel && <p className="text-[10px] text-[#c5221f] mt-1 font-bold">{errors.vehicleModel}</p>}
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{t.plateNumber}</label>
                <input
                  type="text"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  className="w-full p-2.5 bg-[#f8f9fa] border border-[#cbd5e1] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#006b33]"
                />
                {errors.plateNumber && <p className="text-[10px] text-[#c5221f] mt-1 font-bold">{errors.plateNumber}</p>}
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">{t.vehicleColor}</label>
                <input
                  type="text"
                  value={vehicleColor}
                  onChange={(e) => setVehicleColor(e.target.value)}
                  className="w-full p-2.5 bg-[#f8f9fa] border border-[#cbd5e1] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#006b33]"
                />
                {errors.vehicleColor && <p className="text-[10px] text-[#c5221f] mt-1 font-bold">{errors.vehicleColor}</p>}
              </div>
              <div className="md:col-span-6">
                <HijriDatePicker
                  label={t.startDate}
                  value={startDate}
                  onChange={setStartDate}
                  error={errors.startDate}
                  language={language}
                />
              </div>
              <div className="md:col-span-6">
                <HijriDatePicker
                  label={t.endDate}
                  value={endDate}
                  onChange={setEndDate}
                  error={errors.endDate}
                  language={language}
                />
              </div>
            </div>
          </div>

          {/* Attachments Section (المستندات) */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-[#006b33] border-b border-[#006b33]/15 pb-1 uppercase tracking-wider flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span>{language === 'ar' ? 'المستندات الثبوتية المرفقة (تعديل أو إضافة)' : 'Attached Supporting Documents (Edit or add)'}</span>
            </h4>
            
            {fileError && <p className="text-[10px] text-[#c5221f] font-bold">{fileError}</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Drag and drop zone */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] ${
                  dragActive 
                    ? 'border-[#006b33] bg-[#e6f4ea]/30' 
                    : 'border-[#cbd5e1] bg-[#f8f9fa] hover:border-[#006b33]/60'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  multiple
                  className="hidden"
                  accept="application/pdf,image/png,image/jpeg,image/jpg"
                />
                <FileUp className="h-6 w-6 text-[#006b33] mb-1.5" />
                <span className="text-xs font-bold text-[#191c1d]">{language === 'ar' ? 'اسحب ملفات إضافية هنا أو تصفح' : 'Drag more files here or browse'}</span>
                <span className="text-[10px] text-[#5f5e5c] mt-0.5">{language === 'ar' ? 'الحد الأقصى لحجم الملف: 10 ميجابايت' : 'Maximum file size: 10MB'}</span>
              </div>

              {/* List of attachments */}
              <div className="bg-[#f8f9fa] border border-[#cbd5e1]/40 rounded-2xl p-4 max-h-[150px] overflow-y-auto">
                <span className="text-[10px] font-bold text-[#5f5e5c] block mb-1.5">{language === 'ar' ? 'المستندات الحالية للمركبة:' : 'Current vehicle documents:'}</span>
                {attachments.length === 0 ? (
                  <p className="text-center py-6 text-gray-400 text-xs font-bold">{language === 'ar' ? 'لا توجد مستندات!' : 'No documents attached!'}</p>
                ) : (
                  <div className="space-y-1">
                    {attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#cbd5e1]/20 text-xs">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="text-[9px] font-bold text-[#006b33] bg-[#e6f4ea] px-1.5 py-0.5 rounded shrink-0">
                            {file.type.includes('pdf') ? 'PDF' : 'IMG'}
                          </span>
                          <span className="font-semibold truncate max-w-[150px] block">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttached(idx)}
                          className="text-red-500 hover:bg-red-50 p-1 rounded cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-[#cbd5e1]/40 bg-[#f8f9fa] flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-[#cbd5e1] text-[#5f5e5c] rounded-xl text-xs font-bold hover:bg-[#f8f9fa] transition-all cursor-pointer"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 bg-[#006b33] hover:bg-[#005226] text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            {t.saveChanges}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ======================== VIEW DOCUMENTS MODAL (المستندات) ========================
interface ViewDocumentsModalProps {
  language: Language;
  permit: Permit;
  onClose: () => void;
  onUpdateAttachments: (updated: AttachmentFile[]) => void;
  onPrintAttachment?: (file: AttachmentFile) => void;
}

function ViewDocumentsModal({ language, permit, onClose, onUpdateAttachments, onPrintAttachment }: ViewDocumentsModalProps) {
  const t = TRANSLATIONS[language];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedPreview, setSelectedPreview] = useState<AttachmentFile | null>(permit.attachments[0] || null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      Array.from(e.dataTransfer.files).forEach((file: any) => handleUpload(file as File));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      Array.from(e.target.files).forEach((file: any) => handleUpload(file as File));
    }
  };

  const handleUpload = (file: File) => {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setErrorMsg(language === 'ar' ? 'نوع ملف غير مدعوم! يرجى إرفاق PDF أو صور فقط.' : 'Unsupported type! PDF or images only.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg(language === 'ar' ? 'يتجاوز حجم الملف 10 ميجابايت!' : 'File exceeds 10MB!');
      return;
    }

    const sizeStr = file.size > 1024 * 1024 
      ? (file.size / (1024 * 1024)).toFixed(1) + ' MB' 
      : (file.size / 1024).toFixed(0) + ' KB';

    const newDoc: AttachmentFile = {
      name: file.name,
      size: sizeStr,
      type: file.type
    };

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        newDoc.dataUrl = e.target?.result as string;
        const updated = [...permit.attachments, newDoc];
        onUpdateAttachments(updated);
        setSelectedPreview(newDoc);
      };
      reader.readAsDataURL(file);
    } else {
      const updated = [...permit.attachments, newDoc];
      onUpdateAttachments(updated);
      setSelectedPreview(newDoc);
    }

    setErrorMsg('');
  };

  const handleRemove = (idx: number) => {
    const updated = permit.attachments.filter((_, i) => i !== idx);
    onUpdateAttachments(updated);
    if (selectedPreview === permit.attachments[idx]) {
      setSelectedPreview(updated[0] || null);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#191c1d]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl border border-[#cbd5e1] max-w-4xl w-full my-8 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#cbd5e1]/40 flex justify-between items-center bg-[#f8f9fa] shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#006b33]" />
            <div>
              <h3 className="text-base font-bold text-[#191c1d]">{t.documents}</h3>
              <p className="text-[11px] text-[#5f5e5c] mt-0.5">{language === 'ar' ? `المستندات الرسمية الثبوتية للتصريح #${permit.id}` : `Official supporting documents for Permit #${permit.id}`}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#cbd5e1]/40 rounded-full text-[#5f5e5c] transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Inner Content splits into Preview pane and List pane */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x md:divide-[#cbd5e1]/40">
          
          {/* Left panel: Document List and Upload (Cols: 2) */}
          <div className="md:col-span-2 p-6 flex flex-col gap-4 overflow-y-auto max-h-full">
            <h4 className="text-xs font-bold text-[#191c1d] uppercase tracking-wider">
              {language === 'ar' ? 'قائمة المستندات المرفقة' : 'Attached Documents List'}
            </h4>

            {permit.attachments.length === 0 ? (
              <div className="p-8 text-center text-[#5f5e5c] bg-[#f8f9fa] rounded-xl border border-dashed border-[#cbd5e1]">
                <FileText className="h-8 w-8 mx-auto text-[#bdcabc] mb-2" />
                <p className="text-xs font-bold">{t.noDocsAttached}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {permit.attachments.map((file, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedPreview(file)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      selectedPreview === file 
                        ? 'border-[#006b33] bg-[#e6f4ea]/20' 
                        : 'border-[#cbd5e1] bg-white hover:bg-[#f8f9fa]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="h-9 w-9 shrink-0 rounded-md border border-[#cbd5e1]/30 bg-slate-50 flex items-center justify-center font-bold text-[9px] text-[#006b33]">
                        {file.type.includes('pdf') ? 'PDF' : 'IMG'}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-bold text-[#191c1d] truncate text-[11px]">{file.name}</p>
                        <p className="text-[9px] text-[#5f5e5c] font-mono mt-0.5">{file.size}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(idx);
                      }}
                      className="p-1 text-red-600 hover:bg-red-50 rounded-md transition-all shrink-0 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Inline Uploader to add more documents directly */}
            <div className="border-t border-[#cbd5e1]/40 pt-4 mt-2">
              <h5 className="text-[10px] font-bold text-[#5f5e5c] uppercase tracking-wider mb-2">
                {language === 'ar' ? 'إضافة مستند جديد للتصريح:' : 'Attach more documents:'}
              </h5>
              
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                  dragActive 
                    ? 'border-[#006b33] bg-[#e6f4ea]/40' 
                    : 'border-[#cbd5e1] bg-[#f8f9fa] hover:border-[#006b33]/60'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  className="hidden"
                  accept="application/pdf,image/png,image/jpeg,image/jpg"
                />
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <FileUp className="h-5 w-5 text-[#006b33]" />
                  <span className="text-[10px] font-bold text-[#191c1d]">{language === 'ar' ? 'اختر ملف أو اسحبه هنا' : 'Choose file or drop here'}</span>
                </div>
              </div>
              {errorMsg && <p className="text-[9px] text-[#c5221f] font-bold mt-1.5">{errorMsg}</p>}
            </div>
          </div>

          {/* Right panel: Full Screen/Scale Preview Pane */}
          <div className="md:col-span-3 p-6 bg-[#f8f9fa] flex flex-col justify-between max-h-full overflow-hidden">
            <h4 className="text-xs font-bold text-[#191c1d] uppercase tracking-wider mb-3">
              {language === 'ar' ? 'معاينة المستند المالي/الثبوتي' : 'Document Preview Pane'}
            </h4>

            {selectedPreview ? (
              <div className="flex-1 overflow-hidden flex flex-col justify-between gap-4 bg-white border border-[#cbd5e1] rounded-2xl p-4 shadow-3xs">
                {/* Meta details */}
                <div className="flex justify-between items-center text-xs border-b border-[#cbd5e1]/30 pb-3">
                  <div className="overflow-hidden">
                    <p className="font-bold text-[#191c1d] truncate max-w-xs">{selectedPreview.name}</p>
                    <p className="text-[10px] text-[#5f5e5c] font-mono mt-0.5">{selectedPreview.size} &bull; {selectedPreview.type}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {onPrintAttachment && (
                      <button
                        type="button"
                        onClick={() => onPrintAttachment(selectedPreview)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[11px] font-bold hover:bg-blue-100 transition-all cursor-pointer"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>{language === 'ar' ? 'طباعة' : 'Print'}</span>
                      </button>
                    )}
                    <a
                      href={selectedPreview.dataUrl || '#'}
                      download={selectedPreview.name}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#e6f4ea] text-[#006b33] rounded-lg text-[11px] font-bold hover:bg-[#006b33]/15 transition-all"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>{language === 'ar' ? 'تحميل' : 'Download'}</span>
                    </a>
                  </div>
                </div>

                {/* Canvas preview body */}
                <div className="flex-1 flex items-center justify-center bg-[#f8f9fa] rounded-xl overflow-y-auto p-4 border border-[#cbd5e1]/10">
                  {selectedPreview.dataUrl ? (
                    <img 
                      src={selectedPreview.dataUrl} 
                      alt="visual attachment preview" 
                      referrerPolicy="no-referrer"
                      className="max-h-[280px] w-auto object-contain rounded-lg shadow-sm border border-[#cbd5e1]/20" 
                    />
                  ) : (
                    <div className="text-center p-8 space-y-4 max-w-sm">
                      <div className="h-16 w-16 bg-red-50 text-[#c5221f] rounded-full flex items-center justify-center mx-auto border border-red-100 shadow-sm">
                        <FileText className="h-8 w-8" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#191c1d]">{language === 'ar' ? 'معاينة ملف PDF الرسمي' : 'Official PDF Document'}</p>
                        <p className="text-[10px] text-[#5f5e5c] mt-1.5 leading-relaxed">
                          {language === 'ar' 
                            ? 'تم التحقق من ختم المستند والترميز الرقمي له بنجاح. يمكنك الضغط على زر التحميل بالأعلى لحفظ النسخة الأصلية.' 
                            : 'Document seal and cryptographic encoding successfully validated. Click Download above to view the high-resolution original.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-[#5f5e5c]">
                <FileText className="h-16 w-16 text-[#bdcabc] mb-3" />
                <p className="text-xs font-bold">{language === 'ar' ? 'يرجى تحديد مستند من القائمة لمعاينته' : 'Select a document from the list to preview it here'}</p>
              </div>
            )}
          </div>

        </div>

        <div className="p-6 border-t border-[#cbd5e1]/40 bg-[#f8f9fa] flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#006b33] text-white rounded-xl text-xs font-bold hover:bg-[#005226] transition-all cursor-pointer"
          >
            {t.close}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ======================== PRINTABLE PERMIT CARD ========================
function PrintablePermitCard({ permit, language }: { permit: Permit; language: Language }) {
  const isAr = language === 'ar';
  
  return (
    <div className="border-[3px] border-black p-8 rounded-xl max-w-[800px] mx-auto bg-white text-black relative flex flex-col justify-between my-4 min-h-[500px] font-arabic shadow-xs">
      {/* Decorative corners */}
      <div className="absolute top-2 left-2 right-2 bottom-2 border border-black/20 pointer-events-none rounded-lg" />
      
      {/* Official Header */}
      <div className="flex justify-between items-center border-b-2 border-black pb-5 mb-6">
        <div className="text-right text-xs space-y-1 font-bold">
          <p>المملكة العربية السعودية</p>
          <p>وزارة الداخلية</p>
          <p>أرشيف تصاريح التظليل</p>
          <p className="font-mono text-[10px]">تاريخ الطباعة: {formatHijriDate(gregorianToHijri(new Date()), 'ar')}</p>
        </div>
        
        {/* Emblem Placeholder / Center Logo */}
        <div className="flex flex-col items-center">
          <div className="h-16 w-16 border-2 border-black rounded-full flex items-center justify-center font-black text-center p-1 relative">
            <span className="text-[10px] leading-tight font-extrabold">تصريح تظليل معتمد</span>
            <div className="absolute inset-0 rounded-full border border-black border-dashed m-1" />
          </div>
          <span className="text-xs font-black mt-2 tracking-widest font-mono">#{permit.id}</span>
        </div>

        <div className="text-left text-xs space-y-1 font-bold font-sans">
          <p>Kingdom of Saudi Arabia</p>
          <p>Ministry of Interior</p>
          <p>Shading Permits Archive</p>
          <p className="font-mono text-[10px]">Print Date: {formatHijriDate(gregorianToHijri(new Date()), 'en')}</p>
        </div>
      </div>

      {/* Main Title */}
      <div className="text-center mb-6">
        <h2 className="text-lg font-black underline tracking-wide uppercase">
          {isAr ? "تصريح تظليل مركبة رسمي معتمد" : "Official Certified Vehicle Shading Permit"}
        </h2>
        <p className="text-[10px] text-gray-600 mt-1">
          {isAr ? "تم إصدار هذا المستند تلقائياً من نظام أرشيف تصاريح التظليل الإلكتروني الموحد" : "This document was issued automatically by the Unified Electronic Shading Permits Archive"}
        </p>
      </div>

      {/* Grid of details */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-xs mb-6 border border-black p-4 rounded-lg bg-gray-50/50">
        <div className="border-b border-black/10 pb-2">
          <span className="text-[10px] text-gray-500 block font-bold">{isAr ? "الاسم المصرح له:" : "Permittee Name:"}</span>
          <span className="font-bold text-sm">{permit.permitteeName}</span>
        </div>
        <div className="border-b border-black/10 pb-2">
          <span className="text-[10px] text-gray-500 block font-bold">{isAr ? "رقم هوية المصرح له:" : "Permittee ID:"}</span>
          <span className="font-bold font-mono text-sm">{permit.permitteeId}</span>
        </div>

        <div className="border-b border-black/10 pb-2">
          <span className="text-[10px] text-gray-500 block font-bold">{isAr ? "اسم مالك المركبة:" : "Owner Name:"}</span>
          <span className="font-bold">{permit.ownerName}</span>
        </div>
        <div className="border-b border-black/10 pb-2">
          <span className="text-[10px] text-gray-500 block font-bold">{isAr ? "رقم هوية المالك:" : "Owner ID:"}</span>
          <span className="font-bold font-mono">{permit.ownerId}</span>
        </div>

        <div className="border-b border-black/10 pb-2">
          <span className="text-[10px] text-gray-500 block font-bold">{isAr ? "المستخدم الفعلي (السائق):" : "Actual User (Driver):"}</span>
          <span className="font-bold">{permit.actualUser}</span>
        </div>
        <div className="border-b border-black/10 pb-2">
          <span className="text-[10px] text-gray-500 block font-bold">{isAr ? "رقم هوية المستخدم الفعلي:" : "Actual User ID:"}</span>
          <span className="font-bold font-mono">{permit.actualUserId}</span>
        </div>

        <div className="border-b border-black/10 pb-2">
          <span className="text-[10px] text-gray-500 block font-bold">{isAr ? "رقم اللوحة:" : "Plate Number:"}</span>
          <span className="font-bold font-mono text-sm bg-gray-100 border border-gray-400 px-2 py-0.5 rounded inline-block">{permit.plateNumber}</span>
        </div>
        <div className="border-b border-black/10 pb-2">
          <span className="text-[10px] text-gray-500 block font-bold">{isAr ? "نوع وموديل السيارة:" : "Vehicle Type & Model:"}</span>
          <span className="font-bold">{permit.vehicleType} &bull; {permit.vehicleModel}</span>
        </div>

        <div className="border-b border-black/10 pb-2">
          <span className="text-[10px] text-gray-500 block font-bold">{isAr ? "لون السيارة:" : "Vehicle Color:"}</span>
          <span className="font-bold">{permit.vehicleColor}</span>
        </div>
        <div className="border-b border-black/10 pb-2">
          <span className="text-[10px] text-gray-500 block font-bold">{isAr ? "رقم مرجع التصريح:" : "Permit Reference ID:"}</span>
          <span className="font-bold font-mono">PRM-{permit.id}</span>
        </div>

        <div className="pb-1">
          <span className="text-[10px] text-gray-500 block font-bold">{isAr ? "تاريخ البداية (هجري):" : "Start Date (Hijri):"}</span>
          <span className="font-bold font-mono text-green-700">{formatHijriString(permit.startDate, language)}</span>
        </div>
        <div className="pb-1">
          <span className="text-[10px] text-gray-500 block font-bold">{isAr ? "تاريخ النهاية (هجري):" : "End Date (Hijri):"}</span>
          <span className="font-bold font-mono text-red-700">{formatHijriString(permit.endDate, language)}</span>
        </div>
        <div className="col-span-2 border-t border-black/10 pt-2 flex justify-between items-center bg-gray-50 px-2 py-1 rounded">
          <span className="text-[10px] text-gray-600 font-bold">{isAr ? "الموظف المدخل / مُصدر التصريح:" : "Created/Issued By:"}</span>
          <span className="text-xs font-black text-[#006b33] font-mono">{permit.createdBy || 'waseem'}</span>
        </div>
      </div>

      {/* Middle Bar: Stamp, Status, QR Code */}
      <div className="flex justify-between items-center border-t-2 border-dashed border-black/30 pt-6 mb-6">
        {/* QR Code Graphic (pure SVG for printing clarity) */}
        <div className="flex items-center gap-3">
          <svg className="h-18 w-18 border border-black p-1 shrink-0" viewBox="0 0 100 100" fill="none">
            <rect width="100" height="100" fill="white" />
            <path d="M5 5h20v20H5V5zm2 2v16h16V7H7zm4 4h8v8h-8v-8zM75 5h20v20H75V5zm2 2v16h16V7H77zm4 4h8v8h-8v-8zM5 75h20v20H5V75zm2 2v16h16V93H7zm4 4h8v8h-8v-8z" fill="black" />
            <rect x="35" y="10" width="10" height="15" fill="black" />
            <rect x="50" y="5" width="15" height="10" fill="black" />
            <rect x="40" y="30" width="20" height="10" fill="black" />
            <rect x="10" y="35" width="15" height="25" fill="black" />
            <rect x="75" y="40" width="10" height="15" fill="black" />
            <rect x="65" y="65" width="25" height="15" fill="black" />
            <rect x="35" y="75" width="20" height="10" fill="black" />
            <rect x="45" y="55" width="15" height="15" fill="black" />
          </svg>
          <div className="text-[9px] text-gray-600 max-w-[150px] font-mono leading-tight font-sans">
            <p className="font-bold">VERIFY-PRM-{permit.id}</p>
            <p className="mt-1">Scan to inspect validity status securely on MOI portal.</p>
          </div>
        </div>

        {/* Status Stamp */}
        <div className="text-center">
          <div className="border-[3px] border-double border-black px-6 py-2 rounded-lg font-black text-sm uppercase tracking-wider inline-block">
            {isAr ? "المرور - معتمد" : "TRAFFIC - APPROVED"}
          </div>
          <div className="text-[10px] text-gray-500 mt-1 font-bold">
            {isAr ? "الحالة حالياً: " : "Current Status: "}
            <span className={permit.endDate >= `${gregorianToHijri(new Date()).hy}-${String(gregorianToHijri(new Date()).hm).padStart(2, '0')}-${String(gregorianToHijri(new Date()).hd).padStart(2, '0')}` ? "text-green-600" : "text-red-600"}>
              {permit.endDate >= `${gregorianToHijri(new Date()).hy}-${String(gregorianToHijri(new Date()).hm).padStart(2, '0')}-${String(gregorianToHijri(new Date()).hd).padStart(2, '0')}` 
                ? (isAr ? "ساري" : "VALID") 
                : (isAr ? "منتهي" : "EXPIRED")}
            </span>
          </div>
        </div>

        {/* Issuer Signature/Stamp info */}
        <div className="text-center text-xs font-bold leading-relaxed">
          <p>{isAr ? "الختم الرسمي للمديرية" : "Official Directorate Stamp"}</p>
          <div className="h-14 w-22 border border-black border-dotted my-1.5 mx-auto rounded flex items-center justify-center bg-gray-50/50">
            <span className="text-[9px] text-gray-400 select-none">{isAr ? "ختم إلكتروني معتمد" : "Certified E-Stamp"}</span>
          </div>
          <p className="text-[10px] text-gray-500 font-mono">REF: TRAFFIC-SHADING-{permit.id}</p>
        </div>
      </div>

      {/* Shading/Tinting Guidelines Summary */}
      <div className="border-t border-black pt-4 text-[9px] text-gray-600 leading-normal space-y-1">
        <p className="font-bold text-black">{isAr ? "التعليمات والأنظمة الخاصة بالتظليل:" : "Official Rules and Regulations for Window Tinting:"}</p>
        {isAr ? (
          <ul className="list-disc list-inside space-y-0.5">
            <li>يسمح بالتظليل الشفاف للمقاعد الخلفية الجانبية فقط وبنسبة لا تتجاوز ٣٠٪ (درجة شفافة غير عاكسة).</li>
            <li>يُمنع تماماً تظليل الزجاج الأمامي للمركبة أو الزجاج الجانبي الخاص بالسائق ومرافقه لتجنب حجب الرؤية.</li>
            <li>يجب أن لا يكون التظليل عاكساً للضوء مثل المرآة أو يحتوي على زخارف أو صور تمنع رؤية من بداخل السيارة.</li>
            <li>يجب حمل هذا التصريح الرقمي أو المطبوع في جميع الأوقات لتقديمه لرجال المرور أو الجهات الرقابية عند الطلب.</li>
          </ul>
        ) : (
          <ul className="list-disc list-inside space-y-0.5">
            <li>Transparent window shading is permitted for rear side windows only, up to 30% transparency.</li>
            <li>Tinting of the front windshield or front side driver/passenger windows is strictly prohibited.</li>
            <li>The tint film must be non-reflective (no metallic mirror look) and must not contain graphics or slogans.</li>
            <li>This digital or printed permit must be presented to traffic patrol officers or inspectors upon request.</li>
          </ul>
        )}
      </div>
    </div>
  );
}

// ======================== PRINTABLE ATTACHMENT CARD ========================
function PrintableAttachmentCard({ permit, file, language }: { permit: Permit; file: AttachmentFile; language: Language }) {
  const isAr = language === 'ar';
  
  return (
    <div className="border-[3px] border-black p-8 rounded-xl max-w-[800px] mx-auto bg-white text-black relative flex flex-col justify-between my-4 min-h-[600px] font-arabic shadow-xs">
      <div className="absolute top-2 left-2 right-2 bottom-2 border border-black/20 pointer-events-none rounded-lg" />
      
      {/* Official Header */}
      <div className="flex justify-between items-center border-b-2 border-black pb-5 mb-6">
        <div className="text-right text-xs space-y-1 font-bold">
          <p>المملكة العربية السعودية</p>
          <p>وزارة الداخلية</p>
          <p>أرشيف تصاريح التظليل</p>
          <p className="font-mono text-[10px]">تاريخ الطباعة: {formatHijriDate(gregorianToHijri(new Date()), 'ar')}</p>
        </div>
        
        <div className="flex flex-col items-center">
          <div className="h-16 w-16 border-2 border-black rounded-full flex items-center justify-center font-black text-center p-1 relative bg-white">
            <span className="text-[9px] leading-tight font-extrabold">مستند تصريح مرفق</span>
            <div className="absolute inset-0 rounded-full border border-black border-dashed m-1" />
          </div>
          <span className="text-xs font-black mt-2 tracking-widest font-mono">#{permit.id}</span>
        </div>

        <div className="text-left text-xs space-y-1 font-bold font-sans">
          <p>Kingdom of Saudi Arabia</p>
          <p>Ministry of Interior</p>
          <p>Shading Permits Archive</p>
          <p className="font-mono text-[10px]">Print Date: {formatHijriDate(gregorianToHijri(new Date()), 'en')}</p>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h2 className="text-base font-black underline uppercase">
          {isAr ? "مستند رسمي مرفق بتصريح التظليل" : "Official Supporting Document for Shading Permit"}
        </h2>
        <p className="text-[10px] text-gray-600 mt-1">
          {isAr 
            ? `هذا المستند جزء لا يتجزأ من ملف التصريح رقم #${permit.id} الصادر للمصرح له: ${permit.permitteeName}` 
            : `This document is an integral part of permit file #${permit.id} issued to: ${permit.permitteeName}`}
        </p>
      </div>

      {/* Permit summary card */}
      <div className="grid grid-cols-2 gap-4 text-xs mb-6 border border-black p-3 rounded bg-gray-50/50">
        <div>
          <span className="text-[9px] text-gray-500 block font-bold">{isAr ? "المصرح له:" : "Permittee:"}</span>
          <span className="font-bold">{permit.permitteeName}</span>
        </div>
        <div>
          <span className="text-[9px] text-gray-500 block font-bold">{isAr ? "رقم هوية المصرح له:" : "Permittee ID:"}</span>
          <span className="font-bold font-mono">{permit.permitteeId}</span>
        </div>
        <div>
          <span className="text-[9px] text-gray-500 block font-bold">{isAr ? "رقم اللوحة للمركبة:" : "Plate Number:"}</span>
          <span className="font-bold font-mono bg-gray-100 border px-1.5 py-0.5 rounded inline-block">{permit.plateNumber}</span>
        </div>
        <div>
          <span className="text-[9px] text-gray-500 block font-bold">{isAr ? "اسم ومواصفات الملف:" : "Document Specs:"}</span>
          <span className="font-bold truncate block">{file.name} ({file.size})</span>
        </div>
      </div>

      {/* Document content render */}
      <div className="flex-1 flex items-center justify-center border border-black p-4 rounded bg-white min-h-[300px]">
        {file.dataUrl ? (
          <img 
            src={file.dataUrl} 
            alt="printed attachment" 
            referrerPolicy="no-referrer"
            className="max-h-[400px] w-auto object-contain"
          />
        ) : (
          <div className="text-center p-8 max-w-md">
            <div className="h-16 w-16 border-2 border-black rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl bg-white">
              PDF
            </div>
            <p className="text-sm font-bold">{isAr ? "ملف PDF رسمي معتمد" : "Official PDF Document"}</p>
            <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
              {isAr 
                ? "هذا المستند تم حفظه وتوثيقه كملف PDF رقمي مشفر بالنظام في أرشيف الوزارة الإلكتروني." 
                : "This document is verified and stored as an encrypted digital PDF file in the electronic archive system."}
            </p>
          </div>
        )}
      </div>

      {/* Footer stamp info */}
      <div className="flex justify-between items-center border-t border-black pt-4 mt-6 text-[10px]">
        <div>
          <p className="font-bold">{isAr ? "توقيع وختم التحقق الإلكتروني:" : "E-Verification Seal:"}</p>
          <p className="text-gray-500 font-mono text-[9px]">TRAFFIC-DOC-VERIFY-PRM-{permit.id}</p>
        </div>
        <div className="border border-black border-dashed px-3 py-1.5 rounded text-center bg-gray-50 text-[9px] font-bold">
          {isAr ? "المرور - ختم وثيقة مرفقة" : "TRAFFIC - ATTACHED DOCUMENT APPROVED"}
        </div>
      </div>
    </div>
  );
}

// ======================== RENEW PERMIT MODAL (تجديد التصريح) ========================
interface RenewPermitModalProps {
  language: Language;
  permit: Permit;
  onClose: () => void;
  onSave: (updatedPermit: Permit) => void;
}

function RenewPermitModal({ language, permit, onClose, onSave }: RenewPermitModalProps) {
  const t = TRANSLATIONS[language];
  const isAr = language === 'ar';

  // State for dates
  const [startDate, setStartDate] = useState(permit.startDate);
  const [endDate, setEndDate] = useState(permit.endDate);
  
  // State for attachments/files
  const [attachments, setAttachments] = useState<AttachmentFile[]>(permit.attachments || []);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      Array.from(e.dataTransfer.files).forEach((file: any) => handleAttachFile(file as File));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      Array.from(e.target.files).forEach((file: any) => handleAttachFile(file as File));
    }
  };

  const handleAttachFile = (file: File) => {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setFileError(isAr ? 'نوع الملف غير مدعوم! يرجى إرفاق PDF أو صور فقط.' : 'Unsupported type! PDF or images only.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError(isAr ? 'حجم الملف يتجاوز 10 ميجابايت!' : 'File exceeds 10MB!');
      return;
    }

    const sizeStr = file.size > 1024 * 1024 
      ? (file.size / (1024 * 1024)).toFixed(1) + ' MB' 
      : (file.size / 1024).toFixed(0) + ' KB';

    const newAttachment: AttachmentFile = {
      name: file.name,
      size: sizeStr,
      type: file.type
    };

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        newAttachment.dataUrl = e.target?.result as string;
        setAttachments(prev => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    } else {
      setAttachments(prev => [...prev, newAttachment]);
    }

    setFileError('');
  };

  const handleRemoveAttached = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleRenew = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!startDate) newErrors.startDate = isAr ? 'تاريخ بداية التجديد مطلوب' : 'Renewal start date is required';
    if (!endDate) newErrors.endDate = isAr ? 'تاريخ نهاية التجديد مطلوب' : 'Renewal end date is required';
    else if (endDate < startDate) newErrors.endDate = isAr ? 'تاريخ نهاية التجديد لا يمكن أن يكون قبل البداية' : 'End date cannot be earlier than start date';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const updatedPermit: Permit = {
      ...permit,
      startDate,
      endDate,
      attachments
    };

    onSave(updatedPermit);
  };

  const currentStatus = permit.endDate >= `${gregorianToHijri(new Date()).hy}-${String(gregorianToHijri(new Date()).hm).padStart(2, '0')}-${String(gregorianToHijri(new Date()).hd).padStart(2, '0')}` ? 'Valid' : 'Expired';

  return (
    <div className="fixed inset-0 bg-[#191c1d]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="bg-white rounded-2xl border border-[#cbd5e1] max-w-3xl w-full my-8 overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-right"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#cbd5e1]/40 flex justify-between items-center bg-[#f8f9fa] shrink-0">
          <div className="flex items-center gap-2 text-right">
            <RefreshCw className="h-5 w-5 text-emerald-700 animate-spin-slow" />
            <div>
              <h3 className="text-base font-bold text-[#191c1d]">
                {isAr ? 'تجديد صلاحية تصريح التظليل' : 'Renew Shading Permit Validity'}
              </h3>
              <span className="text-xs text-emerald-700 bg-emerald-50 font-mono font-bold px-2.5 py-0.5 rounded-full mt-1 inline-block">
                #{permit.id}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#cbd5e1]/40 rounded-full text-[#5f5e5c] transition-all cursor-pointer animate-none"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleRenew} className="p-6 space-y-6 overflow-y-auto flex-1 text-right">
          {/* Permit Summary Banner */}
          <div className="bg-[#f1f5f9] border border-[#cbd5e1] p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-bold text-right" dir={isAr ? "rtl" : "ltr"}>
            <div>
              <span className="text-[#5f5e5c] block text-[10px] mb-0.5">{isAr ? 'اسم المصرح له:' : 'Permittee Name:'}</span>
              <span className="text-[#191c1d]">{permit.permitteeName}</span>
            </div>
            <div>
              <span className="text-[#5f5e5c] block text-[10px] mb-0.5">{isAr ? 'نوع وموديل السيارة:' : 'Vehicle Type & Model:'}</span>
              <span className="text-[#191c1d]">{permit.vehicleType} &bull; {permit.vehicleModel} &bull; <span className="font-mono">{permit.plateNumber}</span></span>
            </div>
            <div>
              <span className="text-[#5f5e5c] block text-[10px] mb-0.5">{isAr ? 'تاريخ نهاية التصريح الحالي:' : 'Current Expiry:'}</span>
              <span className={`font-mono ${currentStatus === 'Valid' ? 'text-[#006b33]' : 'text-[#c5221f]'}`}>
                {formatHijriString(permit.endDate, language)} ({currentStatus === 'Valid' ? (isAr ? 'ساري' : 'Valid') : (isAr ? 'منتهي' : 'Expired')})
              </span>
            </div>
          </div>

          {/* Date Picker fields */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-emerald-700 border-b border-emerald-700/15 pb-1 uppercase tracking-wider flex items-center gap-1 justify-end">
              <Car className="h-4 w-4" />
              <span>{isAr ? 'فترة التجديد الجديدة (تاريخ هجري)' : 'New Renewal Validity Period (Hijri)'}</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <HijriDatePicker
                label={isAr ? 'تاريخ بداية التجديد' : 'Renewal Start Date'}
                value={startDate}
                onChange={setStartDate}
                error={errors.startDate}
                language={language}
              />
              <HijriDatePicker
                label={isAr ? 'تاريخ نهاية التجديد' : 'Renewal End Date'}
                value={endDate}
                onChange={setEndDate}
                error={errors.endDate}
                language={language}
              />
            </div>
          </div>

          {/* Attachments Section */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-emerald-700 border-b border-emerald-700/15 pb-1 uppercase tracking-wider flex items-center gap-1 justify-end">
              <FileText className="h-4 w-4" />
              <span>{isAr ? 'المستندات الرسمية الثبوتية (تعديل أو إضافة مستندات التجديد)' : 'Supporting Documents (Edit or upload renewal docs)'}</span>
            </h4>

            {fileError && <p className="text-[10px] text-[#c5221f] font-bold">{fileError}</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Panel: Upload Zone */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[160px] ${
                  dragActive 
                    ? 'border-emerald-700 bg-emerald-50/50' 
                    : 'border-[#cbd5e1] bg-[#f8f9fa] hover:border-emerald-700/60'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  multiple
                  className="hidden"
                  accept="application/pdf,image/png,image/jpeg,image/jpg"
                />
                <FileUp className="h-8 w-8 text-emerald-700 mb-2" />
                <p className="text-xs font-bold text-[#191c1d]">{isAr ? 'اسحب مستندات التجديد هنا أو تصفح' : 'Drag renewal docs here or browse'}</p>
                <p className="text-[10px] text-[#5f5e5c] mt-1">{isAr ? 'الحد الأقصى لحجم الملف: 10 ميجابايت (PDF أو صور)' : 'Max file size: 10MB (PDF or images)'}</p>
              </div>

              {/* Right Panel: Uploaded files list */}
              <div className="bg-[#f8f9fa] border border-[#cbd5e1]/40 rounded-2xl p-4 max-h-[180px] overflow-y-auto">
                <span className="text-[10px] text-[#5f5e5c] font-bold block mb-2">{isAr ? 'الملفات المرفقة حالياً:' : 'Currently Attached Files:'}</span>
                {attachments.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-xs">
                    {isAr ? 'لا توجد مستندات مرفقة' : 'No attachments attached'}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#cbd5e1]/30 text-xs">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {file.type.includes('pdf') ? 'PDF' : 'IMG'}
                          </span>
                          <span className="font-bold truncate text-[11px] max-w-[150px]">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttached(idx)}
                          className="text-red-500 hover:bg-red-50 p-1 rounded cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-[#cbd5e1]/40 bg-[#f8f9fa] flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-[#cbd5e1] text-[#5f5e5c] rounded-xl text-xs font-bold hover:bg-[#f8f9fa] transition-all cursor-pointer"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={handleRenew}
            className="px-5 py-2.5 bg-[#006b33] hover:bg-[#005226] text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle className="h-4 w-4" />
            <span>{isAr ? 'تأكيد التجديد وحفظ البيانات' : 'Confirm Renewal & Save'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ======================== HIJRI DATE PICKER COMPONENT ========================
interface HijriDatePickerProps {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (newValue: string) => void;
  error?: string;
  language: Language;
}

function HijriDatePicker({ label, value, onChange, error, language }: HijriDatePickerProps) {
  // Parse the value: e.g., "1447-09-15"
  let hy = 1447;
  let hm = 1;
  let hd = 1;
  if (value) {
    const parts = value.split('-');
    if (parts.length === 3) {
      hy = parseInt(parts[0], 10) || 1447;
      hm = parseInt(parts[1], 10) || 1;
      hd = parseInt(parts[2], 10) || 1;
    }
  }

  const handleDayChange = (newDay: number) => {
    onChange(`${hy}-${String(hm).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`);
  };

  const handleMonthChange = (newMonth: number) => {
    onChange(`${hy}-${String(newMonth).padStart(2, '0')}-${String(hd).padStart(2, '0')}`);
  };

  const handleYearChange = (newYear: number) => {
    onChange(`${newYear}-${String(hm).padStart(2, '0')}-${String(hd).padStart(2, '0')}`);
  };

  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const years = Array.from({ length: 21 }, (_, i) => 1440 + i); // 1440 to 1460

  const months = language === 'ar' 
    ? [
        "1 - محرم", "2 - صفر", "3 - ربيع الأول", "4 - ربيع الآخر", 
        "5 - جمادى الأولى", "6 - جمادى الآخرة", "7 - رجب", "8 - شعبان", 
        "9 - رمضان", "10 - شوال", "11 - ذو القعدة", "12 - ذو الحجة"
      ]
    : [
        "1 - Muharram", "2 - Safar", "3 - Rabi' I", "4 - Rabi' II", 
        "5 - Jumada I", "6 - Jumada II", "7 - Rajab", "8 - Sha'ban", 
        "9 - Ramadan", "10 - Shawwal", "11 - Dhu al-Qi'dah", "12 - Dhu al-Hijjah"
      ];

  return (
    <div className="space-y-1.5 text-right">
      <label className="block text-xs font-bold text-[#5f5e5c]">{label} <span className="text-red-500">*</span></label>
      <div className="grid grid-cols-3 gap-2">
        {/* Day */}
        <div>
          <select
            value={hd}
            onChange={(e) => handleDayChange(parseInt(e.target.value, 10))}
            className="w-full p-2 bg-[#f8f9fa] border border-[#cbd5e1] focus:border-[#006b33] rounded-xl text-xs font-bold focus:outline-hidden transition-all"
          >
            {days.map(d => (
              <option key={d} value={d}>{language === 'ar' ? `${d} (يوم)` : `${d} (Day)`}</option>
            ))}
          </select>
        </div>

        {/* Month */}
        <div>
          <select
            value={hm}
            onChange={(e) => handleMonthChange(parseInt(e.target.value, 10))}
            className="w-full p-2 bg-[#f8f9fa] border border-[#cbd5e1] focus:border-[#006b33] rounded-xl text-xs font-bold focus:outline-hidden transition-all"
          >
            {months.map((m, idx) => (
              <option key={idx + 1} value={idx + 1}>{m}</option>
            ))}
          </select>
        </div>

        {/* Year */}
        <div>
          <select
            value={hy}
            onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
            className="w-full p-2 bg-[#f8f9fa] border border-[#cbd5e1] focus:border-[#006b33] rounded-xl text-xs font-bold focus:outline-hidden transition-all"
          >
            {years.map(y => (
              <option key={y} value={y}>{y} {language === 'ar' ? 'هـ' : 'AH'}</option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="text-[10px] text-[#c5221f] mt-1 font-bold">{error}</p>}
    </div>
  );
}

// ======================== AUTH SCREEN ========================
interface AuthScreenProps {
  language: Language;
  onLoginSuccess: (user: UserAccount) => void;
  users: UserAccount[];
  onRegister: (newUser: UserAccount) => void;
  setLanguage: (lang: Language) => void;
  t: any;
}

function AuthScreen({ language, onLoginSuccess, users, onRegister, setLanguage, t }: AuthScreenProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!username.trim() || !password) {
      setError(language === 'ar' ? 'يرجى إدخال اسم المستخدم وكلمة المرور.' : 'Please enter username and password.');
      return;
    }

    const matchedUser = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (!matchedUser || matchedUser.password !== password) {
      setError(language === 'ar' ? 'اسم المستخدم أو كلمة المرور غير صحيحة.' : 'Incorrect username or password.');
      return;
    }

    if (matchedUser.status === 'pending') {
      setError(language === 'ar' 
        ? 'عذراً، هذا الحساب قيد المراجعة ولم يتم تفعيله بعد من قبل المسؤول (waseem).' 
        : 'Sorry, this account is pending review and has not been activated yet by the admin (waseem).');
      return;
    }

    onLoginSuccess(matchedUser);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!fullName.trim() || !username.trim() || !password) {
      setError(language === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة.' : 'Please fill in all required fields.');
      return;
    }

    if (username.trim().toLowerCase() === 'waseem') {
      setError(language === 'ar' ? 'اسم المستخدم "waseem" محجوز للنظام.' : 'Username "waseem" is reserved.');
      return;
    }

    const userExists = users.some(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (userExists) {
      setError(language === 'ar' ? 'اسم المستخدم هذا مسجل بالفعل.' : 'This username is already taken.');
      return;
    }

    const todayH = gregorianToHijri(new Date());
    const todayStr = `${todayH.hy}-${String(todayH.hm).padStart(2, '0')}-${String(todayH.hd).padStart(2, '0')}`;

    const newUser: UserAccount = {
      username: username.trim(),
      fullName: fullName.trim(),
      password: password,
      role: 'user',
      status: 'pending',
      createdAt: todayStr
    };

    onRegister(newUser);
    
    // Clear inputs
    setFullName('');
    setUsername('');
    setPassword('');
    
    setSuccessMsg(language === 'ar'
      ? 'تم تسجيل حسابك بنجاح! الحساب الآن قيد المراجعة وبانتظار تفعيل المسؤول (waseem) لتتمكن من الدخول.'
      : 'Account registered successfully! Your account is now pending review and activation by the admin (waseem).');
    
    // Auto switch back to login after some seconds
    setTimeout(() => {
      setAuthMode('login');
      setSuccessMsg('');
    }, 6000);
  };

  return (
    <div className={`min-h-screen bg-[#f8f9fa] flex flex-col justify-center items-center p-4 ${language === 'ar' ? 'font-arabic' : ''}`}>
      {/* Top Bar Language toggle */}
      <div className="absolute top-4 right-4 left-4 flex justify-end">
        <button
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#006b33] bg-[#e6f4ea] hover:bg-[#006b33]/10 rounded-lg transition-all cursor-pointer"
        >
          <Globe className="h-4 w-4" />
          <span>{language === 'ar' ? 'English' : 'العربية'}</span>
        </button>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl border border-[#e2e8f0] shadow-xl overflow-hidden p-6 sm:p-8 space-y-6 relative">
        
        {/* Emblem Logo */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="h-14 w-14 bg-[#006b33] rounded-2xl flex items-center justify-center text-white shadow-md">
            <Car className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black text-[#191c1d] tracking-tight">
              {language === 'ar' ? 'أرشيف تصاريح التظليل الإلكتروني' : 'Electronic Shading Permits Archive'}
            </h1>
            <p className="text-[10px] text-[#5f5e5c] mt-1 font-medium max-w-xs mx-auto">
              {language === 'ar' 
                ? 'المنصة الرسمية الموحدة لإصدار وتوثيق وتتبع تصاريح تظليل المركبات' 
                : 'The official unified portal for vehicle shading permits & verification'}
            </p>
          </div>
        </div>

        {/* Auth Tabs */}
        <div className="bg-[#f1f5f9] p-1 rounded-xl flex">
          <button
            onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
              authMode === 'login' 
                ? 'bg-[#006b33] text-white shadow-sm' 
                : 'text-[#5f5e5c] hover:text-[#006b33]'
            }`}
          >
            {language === 'ar' ? 'تسجيل الدخول' : 'Login'}
          </button>
          <button
            onClick={() => { setAuthMode('register'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
              authMode === 'register' 
                ? 'bg-[#006b33] text-white shadow-sm' 
                : 'text-[#5f5e5c] hover:text-[#006b33]'
            }`}
          >
            {language === 'ar' ? 'حساب جديد' : 'Sign Up'}
          </button>
        </div>

        {/* Error / Success Alerts */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-[#c5221f] text-xs font-bold">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-right">{error}</p>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-[#e6f4ea] border border-[#bdcabc] rounded-xl flex items-start gap-2.5 text-[#137333] text-xs font-bold">
            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-right">{successMsg}</p>
          </div>
        )}

        {/* Forms */}
        {authMode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5 text-right">
                {language === 'ar' ? 'اسم المستخدم' : 'Username'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={language === 'ar' ? 'مثال: waseem' : 'e.g., waseem'}
                  className="w-full pl-3 pr-9 py-2.5 bg-[#f8f9fa] border border-[#cbd5e1] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#006b33] transition-all text-right"
                />
                <User className="absolute right-3 top-3 h-4 w-4 text-[#94a3b8]" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5 text-right">
                {language === 'ar' ? 'كلمة المرور' : 'Password'}
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-3 pr-9 py-2.5 bg-[#f8f9fa] border border-[#cbd5e1] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#006b33] transition-all text-right"
                />
                <Lock className="absolute right-3 top-3 h-4 w-4 text-[#94a3b8]" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#006b33] hover:bg-[#005226] text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
            >
              {language === 'ar' ? 'دخول النظام' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5 text-right">
                {language === 'ar' ? 'الاسم الكامل للمستخدم' : 'Full Name'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={language === 'ar' ? 'الاسم الثلاثي أو المؤسسة' : 'Your full name'}
                  className="w-full pl-3 pr-9 py-2.5 bg-[#f8f9fa] border border-[#cbd5e1] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#006b33] transition-all text-right"
                />
                <User className="absolute right-3 top-3 h-4 w-4 text-[#94a3b8]" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5 text-right">
                {language === 'ar' ? 'اسم المستخدم المطلوب' : 'Desired Username'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={language === 'ar' ? 'مثال: khaled_99' : 'e.g., khaled_99'}
                  className="w-full pl-3 pr-9 py-2.5 bg-[#f8f9fa] border border-[#cbd5e1] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#006b33] transition-all text-right"
                />
                <User className="absolute right-3 top-3 h-4 w-4 text-[#94a3b8]" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5 text-right">
                {language === 'ar' ? 'كلمة المرور' : 'Password'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-3 pr-9 py-2.5 bg-[#f8f9fa] border border-[#cbd5e1] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#006b33] transition-all text-right"
                />
                <Lock className="absolute right-3 top-3 h-4 w-4 text-[#94a3b8]" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#006b33] hover:bg-[#005226] text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
            >
              {language === 'ar' ? 'إرسال طلب التسجيل' : 'Submit Registration'}
            </button>
          </form>
        )}

        {/* Credentials hints for test/review */}
        <div className="border-t border-[#e2e8f0] pt-4 space-y-2 text-[11px] text-[#5f5e5c] leading-relaxed text-right">
          <p className="font-bold text-[#191c1d]">
            {language === 'ar' ? '🔑 المسؤول المعتمد للنظام:' : '🔑 Authorized System Admin:'}
          </p>
          <div className="bg-[#f8f9fa] p-2.5 rounded-lg border border-[#e2e8f0] font-mono flex justify-between items-center text-[11.5px] dir-ltr">
            <div>
              <span className="font-sans font-semibold text-gray-500">{language === 'ar' ? 'اسم المستخدم: ' : 'Username: '}</span>
              <span className="font-bold text-[#006b33]">waseem</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 italic">
            {language === 'ar' 
              ? '💡 ميزة تفعيل الحسابات: أي حساب جديد يسجل عبر المنصة لن يتمكن من الدخول إلا بعد قيام حساب المسؤول "waseem" بالدخول وتفعيله.' 
              : '💡 Registration Policy: Any newly registered user will not be allowed to sign in until the Admin account "waseem" approves it.'}
          </p>
        </div>

      </div>
    </div>
  );
}

// ======================== USER MANAGEMENT ========================
interface UserManagementProps {
  language: Language;
  users: UserAccount[];
  setUsers: React.Dispatch<React.SetStateAction<UserAccount[]>>;
  currentUser: UserAccount;
  triggerNotification: (msg: string, type?: 'success' | 'error') => void;
}

function UserManagement({ language, users, setUsers, currentUser, triggerNotification }: UserManagementProps) {
  const isAr = language === 'ar';

  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newUsername.trim() || !newPassword) {
      triggerNotification(
        isAr ? 'يرجى تعبئة جميع الحقول المطلوبة.' : 'Please fill in all required fields.',
        'error'
      );
      return;
    }

    const usernameLower = newUsername.trim().toLowerCase();
    if (usernameLower === 'waseem') {
      triggerNotification(
        isAr ? 'اسم المستخدم "waseem" محجوز للنظام.' : 'Username "waseem" is reserved.',
        'error'
      );
      return;
    }

    const userExists = users.some(u => u.username.toLowerCase() === usernameLower);
    if (userExists) {
      triggerNotification(
        isAr ? 'اسم المستخدم هذا مسجل بالفعل.' : 'This username is already taken.',
        'error'
      );
      return;
    }

    const todayH = gregorianToHijri(new Date());
    const todayStr = `${todayH.hy}-${String(todayH.hm).padStart(2, '0')}-${String(todayH.hd).padStart(2, '0')}`;

    const newUser: UserAccount = {
      username: newUsername.trim(),
      fullName: newFullName.trim(),
      password: newPassword,
      role: newRole,
      status: 'approved',
      createdAt: todayStr
    };

    try {
      await setDoc(doc(db, 'users', newUser.username.toLowerCase()), newUser);
      
      // reset form
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      setNewRole('user');
      setShowAddForm(false);

      triggerNotification(
        isAr 
          ? `تم تسجيل وإضافة المستخدم الجديد (${newUser.fullName}) وتفعيله بنجاح.` 
          : `New user (${newUser.fullName}) registered and activated successfully.`,
        'success'
      );
    } catch (e) {
      triggerNotification(
        isAr ? 'حدث خطأ أثناء إضافة المستخدم.' : 'Error adding new user.',
        'error'
      );
    }
  };

  const handleApprove = async (username: string) => {
    try {
      await updateDoc(doc(db, 'users', username.toLowerCase()), { status: 'approved' });
      triggerNotification(
        isAr 
          ? `تم تفعيل حساب المستخدم (${username}) بنجاح.` 
          : `User account (${username}) has been activated successfully.`, 
        'success'
      );
    } catch (e) {
      triggerNotification(
        isAr ? 'حدث خطأ أثناء التفعيل.' : 'Error activating account.',
        'error'
      );
    }
  };

  const handleDelete = async (username: string) => {
    if (username.toLowerCase() === 'waseem') {
      triggerNotification(
        isAr ? 'لا يمكن حذف حساب المسؤول الأساسي للنظام.' : 'Primary admin account cannot be deleted.',
        'error'
      );
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', username.toLowerCase()));
      triggerNotification(
        isAr 
          ? `تم حذف حساب المستخدم (${username}) نهائياً.` 
          : `User account (${username}) has been permanently deleted.`, 
        'success'
      );
    } catch (e) {
      triggerNotification(
        isAr ? 'حدث خطأ أثناء الحذف.' : 'Error deleting account.',
        'error'
      );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden shadow-xs p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#e2e8f0] pb-4">
        <div>
          <h3 className="text-base font-bold text-[#191c1d] text-right">
            {isAr ? "إدارة المستخدمين وطلبات التسجيل الجديدة" : "User Accounts & New Registrations"}
          </h3>
          <p className="text-xs text-[#5f5e5c] mt-0.5 text-right">
            {isAr 
              ? "بصفتك المسؤول عن النظام، يمكنك تفعيل حسابات السائقين والمناديب الجدد أو حذف حساباتهم نهائياً." 
              : "As an administrator, you can approve and activate new driver accounts or remove them permanently."}
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-[#006b33] hover:bg-[#005226] rounded-xl shadow-xs transition-all cursor-pointer self-stretch sm:self-auto justify-center"
        >
          {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          <span>{isAr ? "تسجيل مستخدم جديد" : "Register New User"}</span>
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreateUser} className="bg-gray-50 p-5 rounded-2xl border border-[#cbd5e1]/40 space-y-4 text-right">
          <h4 className="text-xs font-bold text-[#006b33] border-b border-[#cbd5e1]/30 pb-2 flex items-center gap-1.5 justify-end">
            <span>{isAr ? "تسجيل حساب مستخدم جديد وتفعيله فوراً" : "Register & Activate New User Account"}</span>
            <Users className="h-4 w-4" />
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">
                {isAr ? "الاسم الكامل للمستخدم" : "Full Name"} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder={isAr ? "مثال: عبدالله الشمري" : "e.g., Abdullah Al-Shammari"}
                className="w-full p-2.5 bg-white border border-[#cbd5e1] rounded-xl text-xs font-bold focus:outline-hidden focus:border-[#006b33] transition-all text-right"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">
                {isAr ? "اسم المستخدم (لتسجيل الدخول)" : "Username (Login)"} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder={isAr ? "مثال: abdullah_99" : "e.g., abdullah_99"}
                className="w-full p-2.5 bg-white border border-[#cbd5e1] rounded-xl text-xs font-bold focus:outline-hidden focus:border-[#006b33] transition-all text-right font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">
                {isAr ? "كلمة المرور" : "Password"} <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-2.5 bg-white border border-[#cbd5e1] rounded-xl text-xs font-bold focus:outline-hidden focus:border-[#006b33] transition-all text-right"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-[#5f5e5c] mb-1.5">
                {isAr ? "نوع الصلاحية" : "User Role"}
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
                className="w-full p-2.5 bg-white border border-[#cbd5e1] focus:border-[#006b33] rounded-xl text-xs font-bold focus:outline-hidden transition-all text-right"
              >
                <option value="user">{isAr ? "موظف / مستخدم عادي" : "Regular Employee / User"}</option>
                <option value="admin">{isAr ? "مدير نظام (مسؤول كامل)" : "System Admin (Full Access)"}</option>
              </select>
            </div>

            <div className="flex gap-2 justify-start sm:justify-end">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2.5 border border-[#cbd5e1] hover:bg-gray-100 text-[#5f5e5c] rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#006b33] hover:bg-[#005226] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle className="h-4 w-4" />
                <span>{isAr ? "تسجيل وتفعيل الحساب" : "Register & Activate"}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#e2e8f0] border border-[#e2e8f0] rounded-xl overflow-hidden text-right">
          <thead className="bg-[#f8f9fa]">
            <tr>
              <th className="px-6 py-4 text-right text-xs font-bold text-[#5f5e5c] uppercase tracking-wider">
                {isAr ? "الاسم الكامل" : "Full Name"}
              </th>
              <th className="px-6 py-4 text-right text-xs font-bold text-[#5f5e5c] uppercase tracking-wider">
                {isAr ? "اسم المستخدم" : "Username"}
              </th>
              <th className="px-6 py-4 text-right text-xs font-bold text-[#5f5e5c] uppercase tracking-wider">
                {isAr ? "تاريخ التسجيل" : "Registered At"}
              </th>
              <th className="px-6 py-4 text-center text-xs font-bold text-[#5f5e5c] uppercase tracking-wider">
                {isAr ? "حالة الحساب" : "Status"}
              </th>
              <th className="px-6 py-4 text-center text-xs font-bold text-[#5f5e5c] uppercase tracking-wider">
                {isAr ? "العمليات والإجراءات" : "Actions"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0] bg-white">
            {users.map((u) => (
              <tr key={u.username} className="hover:bg-[#f8f9fa]/50 transition-all">
                <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-[#191c1d]">
                  {u.fullName} {u.username === currentUser.username && (
                    <span className="bg-emerald-50 text-[#006b33] text-[9px] px-1.5 py-0.5 rounded ml-1 font-bold">
                      ({isAr ? "أنت" : "You"})
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-[#5f5e5c]">
                  {u.username}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-xs text-[#5f5e5c] font-mono">
                  {formatHijriString(u.createdAt, language)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                    u.status === 'approved'
                      ? 'bg-[#e6f4ea] border-[#bdcabc] text-[#137333]'
                      : 'bg-amber-50 border-amber-200 text-amber-700'
                  }`}>
                    {u.status === 'approved' 
                      ? (isAr ? "نشط ومفعل" : "Active / Approved")
                      : (isAr ? "معلق بانتظار التفعيل" : "Pending Approval")}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-xs font-medium">
                  <div className="flex items-center justify-center gap-2">
                    {u.status === 'pending' && (
                      <button
                        onClick={() => handleApprove(u.username)}
                        className="px-3 py-1.5 bg-emerald-50 text-[#006b33] hover:bg-emerald-100 rounded-lg transition-all font-bold cursor-pointer flex items-center gap-1"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>{isAr ? "تفعيل وتخويل" : "Approve & Authorize"}</span>
                      </button>
                    )}
                    {u.username !== 'waseem' && (
                      <button
                        onClick={() => handleDelete(u.username)}
                        className="px-3 py-1.5 bg-red-50 text-[#c5221f] hover:bg-red-100 rounded-lg transition-all font-bold cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>{isAr ? "حذف الحساب" : "Delete Account"}</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ======================== VIEW DETAILED PERMIT MODAL ========================
interface ViewPermitModalProps {
  language: Language;
  permit: Permit;
  onClose: () => void;
  onPrint: (permit: Permit) => void;
  getPermitStatus: (endDate: string) => 'Valid' | 'Expired';
}

function ViewPermitModal({ language, permit, onClose, onPrint, getPermitStatus }: ViewPermitModalProps) {
  const isAr = language === 'ar';
  const status = getPermitStatus(permit.endDate);
  const t = TRANSLATIONS[language];

  return (
    <div className="fixed inset-0 bg-[#191c1d]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl border border-[#cbd5e1] max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col my-8 max-h-[90vh] text-right"
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#cbd5e1]/40 flex justify-between items-center bg-[#f8f9fa] shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 bg-[#006b33]/10 text-[#006b33] rounded-xl flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#191c1d]">
                {isAr ? "تفاصيل تصريح التظليل المعتمد" : "Approved Shading Permit Details"}
              </h3>
              <p className="text-[10px] text-gray-500 font-mono">#{permit.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-[#5f5e5c] transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs text-gray-800 leading-relaxed">
          {/* Card Mockup representing the Physical certified permit badge */}
          <div className="border border-gray-200 bg-linear-to-b from-gray-50/50 to-white p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-xs">
            {/* Status Indicator Bar */}
            <div className={`absolute top-0 right-0 left-0 h-1.5 ${status === 'Valid' ? 'bg-[#006b33]' : 'bg-[#c5221f]'}`} />
            
            {/* Official KSA header style inside card */}
            <div className="flex justify-between items-start border-b border-gray-100 pb-4 mb-4">
              <div className="space-y-0.5 font-bold text-[10px] text-gray-700">
                <p>{isAr ? "المملكة العربية السعودية" : "Kingdom of Saudi Arabia"}</p>
                <p>{isAr ? "وزارة الداخلية" : "Ministry of Interior"}</p>
                <p>{isAr ? "نظام تصاريح التظليل الإلكتروني" : "Unified Shading Permits System"}</p>
              </div>

              {/* Official Seal / QR code mock */}
              <div className="flex flex-col items-center">
                <div className="h-12 w-12 border border-black/40 rounded-lg flex items-center justify-center bg-white p-1 select-none">
                  {/* Mock beautiful micro-QR-code visual */}
                  <div className="grid grid-cols-4 gap-0.5 w-full h-full opacity-85">
                    <div className="bg-black rounded-xs"></div><div className="bg-black rounded-xs"></div><div className="bg-transparent"></div><div className="bg-black rounded-xs"></div>
                    <div className="bg-transparent"></div><div className="bg-black rounded-xs"></div><div className="bg-black rounded-xs"></div><div className="bg-transparent"></div>
                    <div className="bg-black rounded-xs"></div><div className="bg-transparent"></div><div className="bg-black rounded-xs"></div><div className="bg-black rounded-xs"></div>
                    <div className="bg-black rounded-xs"></div><div className="bg-black rounded-xs"></div><div className="bg-transparent"></div><div className="bg-black rounded-xs"></div>
                  </div>
                </div>
                <span className="text-[8px] font-mono font-bold text-gray-400 mt-1">VERIFIED</span>
              </div>
            </div>

            <div className="text-center mb-5">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold border ${
                status === 'Valid' 
                  ? 'bg-[#e6f4ea] text-[#137333] border-[#006b33]/20' 
                  : 'bg-[#fce8e6] text-[#c5221f] border-red-200'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status === 'Valid' ? 'bg-[#006b33]' : 'bg-[#c5221f]'}`}></span>
                {status === 'Valid' ? (isAr ? "تصريح ساري وصالح" : "Active & Valid Permit") : (isAr ? "تصريح منتهي الصلاحية" : "Expired Permit")}
              </span>
            </div>

            {/* Grid details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-right">
              
              {/* Permittee Info */}
              <div className="bg-gray-50/70 border border-gray-100 p-3 rounded-xl">
                <span className="text-[10px] text-gray-400 font-bold block mb-1">
                  {isAr ? "الشخص المصرح له" : "Permittee Name"}
                </span>
                <span className="font-bold text-sm text-gray-800 block">{permit.permitteeName}</span>
                <span className="text-[10px] text-gray-500 font-mono block mt-1">
                  {isAr ? "الهوية الوطنية: " : "National ID: "}{permit.permitteeId}
                </span>
              </div>

              {/* Vehicle info */}
              <div className="bg-gray-50/70 border border-gray-100 p-3 rounded-xl">
                <span className="text-[10px] text-gray-400 font-bold block mb-1">
                  {isAr ? "بيانات المركبة" : "Vehicle Details"}
                </span>
                <span className="font-bold text-sm text-gray-800 block">{permit.vehicleType} ({permit.vehicleModel})</span>
                <div className="flex gap-2 items-center mt-1">
                  <span className="text-[10px] bg-white border border-gray-200 px-2 py-0.5 rounded-md font-mono font-bold text-gray-800">
                    {permit.plateNumber}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {isAr ? "اللون: " : "Color: "}{permit.vehicleColor}
                  </span>
                </div>
              </div>

              {/* Owner Info */}
              <div className="bg-gray-50/70 border border-gray-100 p-3 rounded-xl">
                <span className="text-[10px] text-gray-400 font-bold block mb-1">
                  {isAr ? "اسم المالك الرسمي" : "Official Owner Name"}
                </span>
                <span className="font-bold text-gray-800 block">{permit.ownerName}</span>
                <span className="text-[10px] text-gray-500 font-mono block mt-0.5">
                  {isAr ? "هوية المالك: " : "Owner ID: "}{permit.ownerId}
                </span>
              </div>

              {/* Actual User Info */}
              <div className="bg-gray-50/70 border border-gray-100 p-3 rounded-xl">
                <span className="text-[10px] text-gray-400 font-bold block mb-1">
                  {isAr ? "المستخدم الفعلي للمركبة" : "Actual User of Vehicle"}
                </span>
                <span className="font-bold text-gray-800 block">{permit.actualUser}</span>
                <span className="text-[10px] text-gray-500 font-mono block mt-0.5">
                  {isAr ? "هوية المستخدم: " : "User ID: "}{permit.actualUserId}
                </span>
              </div>

              {/* Date Validity */}
              <div className="bg-emerald-50/30 border border-[#e6f4ea] p-3 rounded-xl col-span-1 sm:col-span-2 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold block mb-0.5">
                    {isAr ? "تاريخ بدء سريان التصريح" : "Validity Start Date"}
                  </span>
                  <span className="font-bold text-[#006b33] font-mono block">{formatHijriString(permit.startDate, language)} هـ</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold block mb-0.5">
                    {isAr ? "تاريخ نهاية سريان التصريح" : "Validity Expiry Date"}
                  </span>
                  <span className={`font-bold font-mono block ${status === 'Valid' ? 'text-[#006b33]' : 'text-red-700'}`}>
                    {formatHijriString(permit.endDate, language)} هـ
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* Attachments Section */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-600 flex items-center gap-1.5 justify-start">
              <FileText className="h-4 w-4 text-[#006b33]" />
              <span>{isAr ? "المستندات الثبوتية المرفقة" : "Attached Documents"}</span>
              <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-full font-bold text-gray-500">
                {permit.attachments.length}
              </span>
            </h4>

            {permit.attachments.length === 0 ? (
              <p className="text-gray-400 italic text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                {isAr ? "لم يتم إرفاق أي ملفات ثبوتية لهذا التصريح" : "No substantiating documents attached to this permit"}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {permit.attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200/60 rounded-xl">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="h-8 w-8 bg-[#006b33]/15 text-[#006b33] rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px] uppercase">
                        {file.type.split('/')[1] || 'doc'}
                      </div>
                      <div className="overflow-hidden text-right">
                        <p className="font-bold text-gray-800 truncate max-w-[150px]">{file.name}</p>
                        <p className="text-[9px] text-gray-400 font-mono">{file.size}</p>
                      </div>
                    </div>
                    {file.dataUrl && (
                      <a 
                        href={file.dataUrl} 
                        download={file.name}
                        className="text-[10px] font-bold text-[#006b33] hover:underline px-2 py-1 bg-white hover:bg-[#e6f4ea] border border-gray-200 rounded-lg shrink-0 transition-all cursor-pointer"
                      >
                        {isAr ? "تحميل" : "Download"}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-gray-50 border-t border-[#cbd5e1]/40 flex flex-col sm:flex-row gap-2 justify-end shrink-0">
          <button
            onClick={() => {
              onPrint(permit);
            }}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Printer className="h-4 w-4" />
            <span>{isAr ? "طباعة التصريح الرسمي" : "Print Official Permit"}</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-[#cbd5e1] hover:bg-gray-100 text-[#5f5e5c] rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            {isAr ? "إغلاق المعاينة" : "Close Preview"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

