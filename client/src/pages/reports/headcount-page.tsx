import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  Download, 
  Calendar, 
  TrendingUp, 
  Building2, 
  UserPlus, 
  UserMinus, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  User as UserIcon, 
  Mail,
  FileSpreadsheet,
  FileText,
  FileDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { addCompanyHeader, addWatermark, addHRSignature, addFooter, addDocumentDate, generateReferenceNumber, addReferenceNumber } from "@/lib/pdf-utils";
import { User, Department, Unit } from "@shared/schema";

export default function HeadcountReportPage() {
  const [selectedMonth, setSelectedMonth] = useState("January 2026");
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [selectedDept, setSelectedDept] = useState("all");
  const [expandedEmployees, setExpandedEmployees] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: units = [] } = useQuery<Unit[]>({ queryKey: ["/api/masters/units"] });
  const { data: employees = [] } = useQuery<User[]>({ queryKey: ["/api/employees"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });

  const toggleEmployee = (empId: number) => {
    const newSet = new Set(expandedEmployees);
    if (newSet.has(empId)) newSet.delete(empId);
    else newSet.add(empId);
    setExpandedEmployees(newSet);
  };

  const filteredDepartments = departments.filter(d => 
    (selectedUnit === "all" || d.unitId === parseInt(selectedUnit)) &&
    (selectedDept === "all" || d.id === parseInt(selectedDept))
  );

  const filteredEmployees = employees.filter(emp => {
    const dept = departments.find(d => d.id === emp.departmentId);
    const matchesUnit = selectedUnit === 'all' || (dept && dept.unitId === parseInt(selectedUnit));
    const matchesDept = selectedDept === 'all' || emp.departmentId === parseInt(selectedDept);
    const matchesSearch = searchQuery === "" || 
      `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.employeeId || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesUnit && matchesDept && matchesSearch;
  });

  const getTenure = (joinDate: string | Date | null) => {
    if (!joinDate) return "N/A";
    const join = new Date(joinDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - join.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 30) return `${diffDays} days`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} months`;
    const diffYears = Math.floor(diffMonths / 12);
    const remainingMonths = diffMonths % 12;
    return `${diffYears}y ${remainingMonths}m`;
  };

  const headcountStats = [
    { title: "Total Headcount", value: employees.length.toString(), icon: <Users className="h-6 w-6" />, color: "bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" },
    { title: "New Hires", value: "18", icon: <UserPlus className="h-6 w-6" />, color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
    { title: "Separations", value: "6", icon: <UserMinus className="h-6 w-6" />, color: "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" },
    { title: "Growth Rate", value: "8.3%", icon: <TrendingUp className="h-6 w-6" />, color: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  ];

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      addWatermark(doc);
      addCompanyHeader(doc, { title: "UNIT-WISE HEADCOUNT REPORT", subtitle: `Period: ${selectedMonth}` });
      const tableData = filteredEmployees.map(emp => [emp.employeeId || '-', `${emp.firstName} ${emp.lastName}`, departments.find(d => d.id === emp.departmentId)?.name || '-', emp.position || '-', emp.joinDate ? new Date(emp.joinDate).toLocaleDateString() : 'N/A', emp.employmentType || '-']);
      autoTable(doc, { head: [['Emp ID', 'Name', 'Department', 'Position', 'Join Date', 'Type']], body: tableData, startY: 70 });
      addFooter(doc);
      doc.save(`headcount_report_${selectedMonth}.pdf`);
      toast({ title: "PDF Exported Successfully" });
    } catch (e) { toast({ title: "Export Failed", variant: "destructive" }); }
  };

  const handleExportExcel = () => {
    const data = filteredEmployees.map(emp => ({ 'Emp ID': emp.employeeId, 'Name': `${emp.firstName} ${emp.lastName}`, 'Department': departments.find(d => d.id === emp.departmentId)?.name, 'Position': emp.position }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Headcount");
    XLSX.writeFile(workbook, `headcount_report_${selectedMonth}.xlsx`);
  };

  const handleExportText = () => {
    const data = filteredEmployees.map(emp => `${emp.employeeId}\t${emp.firstName} ${emp.lastName}\t${emp.position}\n`);
    const blob = new Blob([data.join("")], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `headcount_report_${selectedMonth}.txt`;
    a.click();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Unit-wise Headcount Reports</h1>
            <p className="text-slate-500">Hierarchical headcount analysis</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-40 h-9"><Calendar className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="January 2026">Jan 2026</SelectItem>
                <SelectItem value="December 2025">Dec 2025</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-800">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 hover-elevate px-2" onClick={handleExportPDF}><FileDown className="h-3 w-3" /> PDF</Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 hover-elevate px-2" onClick={handleExportExcel}><FileSpreadsheet className="h-3 w-3" /> Excel</Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 hover-elevate px-2" onClick={handleExportText}><FileText className="h-3 w-3" /> Text</Button>
            </div>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="w-64">
            <Select value={selectedUnit} onValueChange={setSelectedUnit}>
              <SelectTrigger><SelectValue placeholder="All Units" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Units</SelectItem>
                {units.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-64">
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger><SelectValue placeholder="All Departments" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.filter(d => selectedUnit === 'all' || d.unitId === parseInt(selectedUnit)).map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {headcountStats.map((stat) => (
            <Card key={stat.title} className="hover-elevate"><CardContent className="p-6 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.color}`}>{stat.icon}</div>
              <div><p className="text-2xl font-bold">{stat.value}</p><p className="text-sm text-slate-500 uppercase tracking-wider">{stat.title}</p></div>
            </CardContent></Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-teal-600" /> Unit Hierarchy</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredDepartments.map((dept) => {
              const deptEmployees = filteredEmployees.filter(e => e.departmentId === dept.id);
              if (deptEmployees.length === 0) return null;
              return (
                <div key={dept.id} className="border rounded-lg overflow-hidden transition-all hover:border-teal-200">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b flex justify-between items-center">
                    <span className="font-semibold">{dept.name}</span>
                    <Badge variant="secondary">{deptEmployees.length} Employees</Badge>
                  </div>
                  <div className="divide-y">
                    {deptEmployees.map(emp => {
                      const isExpanded = expandedEmployees.has(emp.id);
                      return (
                        <div key={emp.id}>
                          <button onClick={() => toggleEmployee(emp.id)} className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-all">
                            <div className="flex items-center gap-3">
                              {isExpanded ? <ChevronDown className="h-4 w-4 text-teal-600" /> : <ChevronRight className="h-4 w-4" />}
                              <div className="text-left"><p className="font-semibold">{emp.firstName} {emp.lastName}</p><p className="text-xs text-slate-500 uppercase">{emp.employeeId} • {emp.position}</p></div>
                            </div>
                            <div className="flex gap-3">
                              <Badge variant="outline" className="text-teal-600 font-bold">Active</Badge>
                              <Badge variant="outline" className="font-bold">{emp.employmentType}</Badge>
                            </div>
                          </button>
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="p-5 bg-slate-50/40 border-t overflow-hidden">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center text-sm p-2 rounded-lg bg-white border">
                                      <span className="text-slate-500 font-medium">Join Date</span>
                                      <span className="font-bold">{emp.joinDate ? new Date(emp.joinDate).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm p-2 rounded-lg bg-white border">
                                      <span className="text-slate-500 font-medium">Tenure</span>
                                      <span className="font-bold">{getTenure(emp.joinDate)}</span>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center text-sm p-2 rounded-lg bg-white border">
                                      <span className="text-slate-500 font-medium">Role</span>
                                      <span className="font-bold capitalize">{emp.role}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm p-2 rounded-lg bg-white border">
                                      <span className="text-slate-500 font-medium">Location</span>
                                      <span className="font-bold">{emp.workLocation || 'Office'}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex justify-end gap-3 flex-wrap">
                                  <Button variant="outline" size="sm" className="h-8 rounded-lg font-bold hover-elevate" onClick={() => window.location.href=`/employee/${emp.id}`}>Full Profile</Button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
