import React, { useState, useEffect } from "react";
import { 
  PlusCircle, 
  Trash2, 
  LogOut, 
  LayoutDashboard, 
  FileSpreadsheet, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Coffee,
  Milk,
  Cake,
  Package,
  Wrench,
  Settings,
  X,
  Pencil
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type Role = "staff" | "admin";

interface User {
  username: string;
  role: Role;
}

interface InvoiceData {
  id?: string;
  rowNumber?: number;
  date: string;
  invoiceNumber: string;
  vendorName: string;
  category: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  total: number;
  remarks: string;
}

const CATEGORIES = [
  { name: "咖啡豆", icon: Coffee },
  { name: "鮮奶/飲品原料", icon: Milk },
  { name: "甜點/食材", icon: Cake },
  { name: "包材", icon: Package },
  { name: "雜項/文具/清潔用品", icon: Wrench },
];

const getCurrentMonthSheetName = () => {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const month = now.getMonth() + 1;
  const startMonth = month % 2 === 0 ? month - 1 : month;
  const endMonth = startMonth + 1;
  return `${startMonth.toString().padStart(2, "0")}${endMonth.toString().padStart(2, "0")}月`;
};

// --- Components ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [sheets, setSheets] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState("");
  const [dataList, setDataList] = useState<InvoiceData[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [unitPrice, setUnitPrice] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number | "">("");

  // Settings Modal State
  const [showSettings, setShowSettings] = useState(false);
  const [configForm, setConfigForm] = useState({ email: "", privateKey: "", spreadsheetId: "", hasPrivateKey: false });
  const [editForm, setEditForm] = useState<InvoiceData | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const subtotal = (Number(unitPrice) || 0) * (Number(quantity) || 0);

  useEffect(() => {
    if (user) {
      fetchSheets();
      fetchConfigStatus();
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === "admin" && currentSheet) {
      fetchDataList();
    }
  }, [user, currentSheet]);

  const fetchConfigStatus = async () => {
    try {
      const res = await fetch("/api/config/status");
      const data = await res.json();
      setIsConfigured(data.isConfigured);
    } catch (err) {
      console.error("Failed to fetch config status", err);
    }
  };

  const fetchSheets = async () => {
    try {
      const res = await fetch("/api/sheets");
      const data = await res.json();
      if (Array.isArray(data)) {
        setSheets(data);
        const currentMonthName = getCurrentMonthSheetName();
        if (data.includes(currentMonthName)) {
          setCurrentSheet(currentMonthName);
        } else if (data.length > 0) {
          setCurrentSheet(data[0]);
        } else {
          setCurrentSheet(currentMonthName);
        }
      }
    } catch (err) {
      console.error("Failed to fetch sheets", err);
    }
  };

  const fetchDataList = async () => {
    if (!currentSheet) return;
    try {
      const res = await fetch(`/api/data/list?sheetName=${encodeURIComponent(currentSheet)}&t=${Date.now()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setDataList(data);
      }
    } catch (err) {
      console.error("Failed to fetch data list", err);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        setUser({ username: data.username, role: data.role });
      } else {
        setMessage({ type: "error", text: data.message });
      }
    } catch (err) {
      setMessage({ type: "error", text: "登入失敗，請檢查伺服器連接" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentSheet("");
    setDataList([]);
    setMessage(null);
  };

  const handleAddData = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    const data: InvoiceData = {
      date: formData.get("date") as string,
      invoiceNumber: formData.get("invoiceNumber") as string,
      vendorName: formData.get("vendorName") as string,
      category: formData.get("category") as string,
      itemName: formData.get("itemName") as string,
      unitPrice: Number(unitPrice),
      quantity: Number(quantity),
      total: subtotal,
      remarks: formData.get("remarks") as string,
    };

    try {
      const res = await fetch("/api/data/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetName: currentSheet, data }),
      });
      const result = await res.json();
      if (result.success) {
        setMessage({ type: "success", text: "登錄成功！" });
        form.reset();
        setUnitPrice("");
        setQuantity("");
        if (user?.role === "admin") fetchDataList();
      } else {
        setMessage({ type: "error", text: result.error || "登錄失敗" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "登錄失敗，請檢查伺服器連接" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (rowId: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/data/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetName: currentSheet, rowId }),
      });
      const result = await res.json();
      if (result.success) {
        setMessage({ type: "success", text: "刪除成功" });
        fetchDataList();
      } else {
        setMessage({ type: "error", text: result.error || "刪除失敗" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "刪除失敗" });
    } finally {
      setLoading(false);
      setDeleteConfirmId(null);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm || !editForm.id) return;
    setLoading(true);

    const updatedData = {
      ...editForm,
      total: (Number(editForm.unitPrice) || 0) * (Number(editForm.quantity) || 0)
    };

    try {
      const res = await fetch("/api/data/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetName: currentSheet, rowId: editForm.id, data: updatedData }),
      });
      const result = await res.json();
      if (result.success) {
        setMessage({ type: "success", text: "更新成功！" });
        setEditForm(null);
        fetchDataList();
      } else {
        setMessage({ type: "error", text: result.error || "更新失敗" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "更新失敗" });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSettings = async () => {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      setConfigForm({
        email: data.email || "",
        privateKey: "",
        spreadsheetId: data.spreadsheetId || "",
        hasPrivateKey: data.hasPrivateKey
      });
      setShowSettings(true);
    } catch (err) {
      setMessage({ type: "error", text: "無法載入設定" });
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: configForm.email,
          privateKey: configForm.privateKey,
          spreadsheetId: configForm.spreadsheetId
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "設定已儲存" });
        setShowSettings(false);
        fetchConfigStatus();
        fetchSheets();
        if (user?.role === "admin") fetchDataList();
      }
    } catch (err) {
      setMessage({ type: "error", text: "儲存設定失敗" });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-stone-200/50 p-8 border border-stone-100"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-50 rounded-2xl mb-4">
              <Coffee className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-semibold text-stone-900">璐光咖啡採購系統</h1>
            <p className="text-stone-500 mt-2">請登入以繼續使用系統</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">帳號</label>
              <input 
                name="username"
                type="text" 
                required
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                placeholder="請輸入帳號"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">密碼</label>
              <input 
                name="password"
                type="password" 
                required
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                placeholder="請輸入密碼"
              />
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-stone-900 text-white py-3 rounded-xl font-medium hover:bg-stone-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "登入系統"}
            </button>
          </form>

          <AnimatePresence>
            {message && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className={cn(
                  "mt-4 p-3 rounded-xl flex items-center gap-2 text-sm",
                  message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                )}
              >
                {message.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {message.text}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans pb-12">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Coffee className="w-6 h-6 text-emerald-600" />
            <span className="font-semibold text-stone-900">璐光咖啡採購系統</span>
            <span className="px-2 py-0.5 bg-stone-100 text-stone-600 text-xs rounded-full font-medium uppercase tracking-wider">
              {user.role === "admin" ? "管理端" : "門市人員"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-stone-500 hidden sm:inline">歡迎, {user.username}</span>
            {user.role === "admin" && (
              <button 
                onClick={handleOpenSettings}
                className="p-2 text-stone-400 hover:text-stone-900 transition-colors"
                title="系統設定"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={handleLogout}
              className="p-2 text-stone-400 hover:text-red-600 transition-colors"
              title="登出"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {isConfigured === false && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium">尚未綁定 Google Sheets</h4>
              <p className="text-sm mt-1 opacity-90">
                系統偵測到尚未設定 Google Sheets API 金鑰。請點擊右上角「系統設定」進行綁定，否則資料將無法寫入。
              </p>
              {user?.role === "admin" && (
                <button 
                  onClick={handleOpenSettings} 
                  className="mt-3 text-sm font-medium bg-amber-200/50 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
                >
                  前往設定
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mb-6 bg-white rounded-2xl shadow-sm border border-stone-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-stone-700 whitespace-nowrap">目前工作表：</label>
            <select
              value={currentSheet}
              onChange={(e) => setCurrentSheet(e.target.value)}
              className="px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm bg-stone-50 min-w-[150px]"
            >
              {sheets.length === 0 && <option value={currentSheet}>{currentSheet}</option>}
              {sheets.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Form */}
          <div className="lg:col-span-1 space-y-6">
            <section className="bg-white rounded-3xl shadow-sm border border-stone-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-emerald-600" />
                  發票登錄
                </h2>
                <div className="text-xs font-mono text-stone-400 bg-stone-50 px-2 py-1 rounded">
                  {currentSheet || "載入中..."}
                </div>
              </div>

              <form onSubmit={handleAddData} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">日期</label>
                    <input name="date" type="date" required className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">發票號碼</label>
                    <input name="invoiceNumber" type="text" required className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm" placeholder="AB-12345678" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">廠商名稱</label>
                  <input name="vendorName" type="text" required className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">項目分類</label>
                  <select name="category" required className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm appearance-none bg-white">
                    <option value="">請選擇分類</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat.name} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">品項名稱</label>
                  <input name="itemName" type="text" required className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm" />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">單價</label>
                    <input name="unitPrice" type="number" required value={unitPrice} onChange={e => setUnitPrice(Number(e.target.value) || "")} className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">數量</label>
                    <input name="quantity" type="number" required value={quantity} onChange={e => setQuantity(Number(e.target.value) || "")} className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">小計</label>
                    <div className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-stone-50 text-stone-500 text-sm font-mono flex items-center h-[38px]">
                      ${subtotal.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">備註</label>
                  <textarea name="remarks" rows={2} className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm resize-none" />
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "確認登錄"}
                </button>
              </form>
            </section>
          </div>

          {/* Right Column: Data List (Admin Only) */}
          <div className="lg:col-span-2">
            {user.role === "admin" ? (
              <section className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
                <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
                    <LayoutDashboard className="w-5 h-5 text-emerald-600" />
                    本期登錄明細
                  </h2>
                  <button 
                    onClick={fetchDataList}
                    className="text-xs text-emerald-600 hover:underline"
                  >
                    重新整理
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-stone-50">
                        <th className="px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">日期</th>
                        <th className="px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">發票號碼</th>
                        <th className="px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">品項</th>
                        <th className="px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">小計</th>
                        <th className="px-6 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {dataList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-stone-400 italic">
                            尚無登錄資料
                          </td>
                        </tr>
                      ) : (
                        dataList.map((item, index) => (
                          <tr key={item.id || index} className="hover:bg-stone-50/50 transition-colors group">
                            <td className="px-6 py-4 text-sm text-stone-600">{item.date}</td>
                            <td className="px-6 py-4 text-sm font-mono text-stone-900">{item.invoiceNumber}</td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-stone-900 font-medium">{item.itemName}</div>
                              <div className="text-xs text-stone-400">{item.vendorName} · {item.category}</div>
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-stone-900">
                              ${Number(item.total).toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => setEditForm({ ...item, id: item.id || item.rowNumber?.toString() })}
                                  className="p-2 text-stone-300 hover:text-emerald-600 transition-colors"
                                  title="編輯"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => {
                                    const idToDelete = item.id || item.rowNumber?.toString();
                                    if (idToDelete) setDeleteConfirmId(idToDelete);
                                  }}
                                  className="p-2 text-stone-300 hover:text-red-600 transition-colors"
                                  title="刪除"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-dashed border-stone-200 text-center">
                <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-stone-300" />
                </div>
                <h3 className="text-lg font-medium text-stone-900">登錄完成後</h3>
                <p className="text-stone-500 max-w-xs mt-2">
                  資料將自動同步至 Google Sheets。若需修改或刪除，請聯繫管理端。
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-stone-500" />
                  Google Sheets 系統設定
                </h2>
                <button onClick={() => setShowSettings(false)} className="text-stone-400 hover:text-stone-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSaveConfig} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Service Account Email</label>
                  <input 
                    type="email" 
                    required
                    value={configForm.email}
                    onChange={e => setConfigForm({...configForm, email: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm"
                    placeholder="your-app@project.iam.gserviceaccount.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Private Key (JSON 或字串)</label>
                  <textarea 
                    rows={4}
                    value={configForm.privateKey}
                    onChange={e => setConfigForm({...configForm, privateKey: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm font-mono text-xs"
                    placeholder={configForm.hasPrivateKey ? "已設定金鑰。若不修改請留白。" : "請貼上 private_key 或整包 JSON 內容"}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Spreadsheet ID</label>
                  <input 
                    type="text" 
                    required
                    value={configForm.spreadsheetId}
                    onChange={e => setConfigForm({...configForm, spreadsheetId: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm font-mono"
                    placeholder="1BxiMVs0Xrx5IQXpNtgYIT5eSU5v_..."
                  />
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-xl transition-colors"
                  >
                    取消
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    儲存設定
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden my-auto"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-emerald-600" />
                  編輯明細
                </h2>
                <button onClick={() => setEditForm(null)} className="text-stone-400 hover:text-stone-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleUpdate} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">日期</label>
                    <input type="date" required value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">發票號碼</label>
                    <input type="text" required value={editForm.invoiceNumber} onChange={e => setEditForm({...editForm, invoiceNumber: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">廠商名稱</label>
                    <input type="text" required value={editForm.vendorName} onChange={e => setEditForm({...editForm, vendorName: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">項目分類</label>
                    <select required value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm appearance-none bg-white">
                      <option value="">請選擇分類</option>
                      {CATEGORIES.map(cat => (
                        <option key={cat.name} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">品項名稱</label>
                  <input type="text" required value={editForm.itemName} onChange={e => setEditForm({...editForm, itemName: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">單價</label>
                    <input type="number" required value={editForm.unitPrice} onChange={e => setEditForm({...editForm, unitPrice: Number(e.target.value) || 0})} className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">數量</label>
                    <input type="number" required value={editForm.quantity} onChange={e => setEditForm({...editForm, quantity: Number(e.target.value) || 0})} className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">小計</label>
                    <div className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-stone-50 text-stone-500 text-sm font-mono flex items-center h-[38px]">
                      ${((Number(editForm.unitPrice) || 0) * (Number(editForm.quantity) || 0)).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">備註</label>
                  <textarea rows={2} value={editForm.remarks} onChange={e => setEditForm({...editForm, remarks: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm resize-none" />
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={() => setEditForm(null)} className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-xl transition-colors">
                    取消
                  </button>
                  <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2">
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    儲存修改
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-lg font-semibold text-stone-900">
                  確認刪除
                </h2>
              </div>
              <div className="p-6">
                <p className="text-stone-600 text-sm">
                  您確定要刪除這筆明細嗎？此操作無法復原。
                </p>
                <div className="pt-6 flex justify-end gap-3">
                  <button 
                    onClick={() => setDeleteConfirmId(null)} 
                    className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-xl transition-colors"
                  >
                    取消
                  </button>
                  <button 
                    onClick={() => handleDelete(deleteConfirmId)} 
                    disabled={loading} 
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    確定刪除
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-lg flex items-center gap-3 z-50",
              message.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
            )}
          >
            {message.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-medium">{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-2 opacity-70 hover:opacity-100">
              <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
