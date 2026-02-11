import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  CalendarDays, 
  Download, 
  Calendar, 
  TrendingUp, 
  Users, 
  Clock, 
  Search, 
  Building2, 
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

export default function LeaveReportPage() {
  const [selectedMonth, setSelectedMonth] = useState("January 2026");
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [selectedDept, setSelectedDept] = useState("all");
  const [expandedEmployees, setExpandedEmployees] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: units = [] } = useQuery<Unit[]>({ queryKey: ["/api/masters/units"] });
  const { data: employees = [] } = useQuery<User[]>({ queryKey: ["/api/employees"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: leaveRequests = [] } = useQuery<any[]>({ queryKey: ["/api/leave-requests"] });

  const toggleEmployee = (empId: number) => {
    const newSet = new Set(expandedEmployees);
    if (newSet.has(empId)) newSet.delete(empId);
    else newSet.add(empId);
    setExpandedEmployees(newSet);
  };

  const getMonthData = (monthYear: string) => {
    const parts = monthYear.split(" ");
    if (parts.length < 2) return { startDate: new Date(), endDate: new Date() };
    const [monthName, year] = parts;
    const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();
    const startDate = new Date(parseInt(year), monthIndex, 1);
    const endDate = new Date(parseInt(year), monthIndex + 1, 0);
    return { startDate, endDate };
  };

  const filteredDepartments = departments.filter(d => 
    (selectedUnit === "all" || d.unitId === parseInt(selectedUnit)) &&
    (selectedDept === "all" || d.id === parseInt(selectedDept))
  );

  const { startDate, endDate } = getMonthData(selectedMonth);

  const getDetailedLeaveStats = (userId: number) => {
    const userLeaves = leaveRequests.filter(r => r.userId === userId);
    const approved = userLeaves.filter(r => r.status === 'approved');
    const pending = userLeaves.filter(r => r.status === 'pending');
    const rejected = userLeaves.filter(r => r.status === 'rejected');
    
    return {
      total: userLeaves.length,
      approved: approved.length,
      pending: pending.length,
      rejected: rejected.length,
      accrued: 24, // Mock accrued
      remaining: 24 - approved.length,
      byType: {
        annual: approved.filter(r => r.type === 'annual').length,
        sick: approved.filter(r => r.type === 'sick').length,
        personal: approved.filter(r => r.type === 'personal').length,
      }
    };
  };

  const leaveStats = [
    { title: "Approved Leaves", value: leaveRequests.filter(r => r.status === 'approved').length.toString(), icon: <CalendarDays className="h-6 w-6" />, color: "bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" },
    { title: "Pending Requests", value: leaveRequests.filter(r => r.status === 'pending').length.toString(), icon: <Clock className="h-6 w-6" />, color: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
    { title: "Units", value: units.length.toString(), icon: <Building2 className="h-6 w-6" />, color: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
    { title: "Departments", value: departments.length.toString(), icon: <Users className="h-6 w-6" />, color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" },
  ];

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' }) as any;
      addWatermark(doc);
      addCompanyHeader(doc, { 
        title: "UNIT-WISE LEAVE REPORT", 
        subtitle: `Period: ${selectedMonth} | Unit: ${selectedUnit === 'all' ? 'All Units' : units.find(u => u.id === parseInt(selectedUnit))?.name}` 
      });
      
      const tableData = employees
        .filter(emp => {
          const dept = departments.find(d => d.id === emp.departmentId);
          const matchesUnit = selectedUnit === 'all' || (dept && dept.unitId === parseInt(selectedUnit));
          const matchesSearch = searchQuery === "" || 
            `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (emp.employeeId || "").toLowerCase().includes(searchQuery.toLowerCase());
          return matchesUnit && matchesSearch;
        })
        .map(emp => {
          const stats = getDetailedLeaveStats(emp.id);
          return [
            emp.employeeId || '-',
            `${emp.firstName} ${emp.lastName}`,
            departments.find(d => d.id === emp.departmentId)?.name || '-',
            stats.approved.toString(),
            stats.pending.toString(),
            stats.remaining.toString()
          ];
        });

      if (doc.autoTable) {
        doc.autoTable({
          head: [['Emp ID', 'Name', 'Department', 'Approved', 'Pending', 'Remaining']],
          body: tableData,
          startY: 70,
          headStyles: { fillColor: [15, 23, 42] as [number, number, number] },
          alternateRowStyles: { fillColor: [245, 247, 250] as [number, number, number] },
          margin: { top: 70 }
        });
      } else {
        autoTable(doc, {
          head: [['Emp ID', 'Name', 'Department', 'Approved', 'Pending', 'Remaining']],
          body: tableData,
          startY: 70,
          headStyles: { fillColor: [15, 23, 42] as [number, number, number] },
          alternateRowStyles: { fillColor: [245, 247, 250] as [number, number, number] },
          margin: { top: 70 }
        });
      }

      addFooter(doc);
      const refNumber = generateReferenceNumber("LVE");
      addReferenceNumber(doc, refNumber, 68);
      addDocumentDate(doc, undefined, 68);
      doc.save(`leave_report_${selectedMonth.replace(/\s+/g, '_')}.pdf`);
      toast({ title: "PDF Exported Successfully" });
    } catch (error) {
      console.error("PDF Export Error:", error);
      toast({ 
        title: "Export Failed", 
        description: "There was an error generating the PDF. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDownloadIndividualPDF = (emp: User) => {
    try {
      const doc = new jsPDF() as any;
      addWatermark(doc);
      addCompanyHeader(doc, { 
        title: "INDIVIDUAL LEAVE REPORT", 
        subtitle: `${emp.firstName} ${emp.lastName} | ${selectedMonth}` 
      });

      const stats = getDetailedLeaveStats(emp.id);
      const dept = departments.find(d => d.id === emp.departmentId);

      const options = {
        startY: 70,
        head: [['Leave Metric', 'Value']],
        body: [
          ['Employee Name', `${emp.firstName} ${emp.lastName}`],
          ['Employee ID', emp.employeeId || '-'],
          ['Department', dept?.name || '-'],
          ['Accrued Balance', stats.accrued.toString()],
          ['Approved Leaves', stats.approved.toString()],
          ['Pending Requests', stats.pending.toString()],
          ['Rejected Requests', stats.rejected.toString()],
          ['Remaining Balance', stats.remaining.toString()],
          ['Annual (Approved)', stats.byType.annual.toString()],
          ['Sick (Approved)', stats.byType.sick.toString()],
          ['Personal (Approved)', stats.byType.personal.toString()],
        ],
        headStyles: { fillColor: [15, 23, 42] as [number, number, number] },
        theme: 'striped' as const
      };

      if (doc.autoTable) {
        doc.autoTable(options);
      } else {
        autoTable(doc, options);
      }

      addFooter(doc);
      addHRSignature(doc, (doc as any).lastAutoTable?.finalY || 150 + 20);
      const refNumber = generateReferenceNumber("IND-LVE");
      addReferenceNumber(doc, refNumber, 68);
      addDocumentDate(doc, undefined, 68);
      doc.save(`leave_${emp.firstName}_${emp.lastName}_${selectedMonth.replace(/\s+/g, '_')}.pdf`);
      toast({ title: "Individual Leave Report Exported" });
    } catch (error) {
      console.error("Individual PDF Export Error:", error);
      toast({ title: "Export Failed", variant: "destructive" });
    }
  };

  const handleExportExcel = () => {
    const dataToExport = employees
      .filter(emp => {
        const dept = departments.find(d => d.id === emp.departmentId);
        const matchesUnit = selectedUnit === 'all' || (dept && dept.unitId === parseInt(selectedUnit));
        const matchesDept = selectedDept === 'all' || emp.departmentId === parseInt(selectedDept);
        const matchesSearch = searchQuery === "" || 
          `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (emp.employeeId || "").toLowerCase().includes(searchQuery.toLowerCase());
        return matchesUnit && matchesDept && matchesSearch;
      })
      .map(emp => {
        const stats = getDetailedLeaveStats(emp.id);
        return {
          'Employee ID': emp.employeeId || '-',
          'Name': `${emp.firstName} ${emp.lastName}`,
          'Department': departments.find(d => d.id === emp.departmentId)?.name || '-',
          'Approved Leaves': stats.approved,
          'Pending Leaves': stats.pending,
          'Remaining Balance': stats.remaining
        };
      });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leaves");
    XLSX.writeFile(workbook, `leave_report_${selectedMonth.replace(/\s+/g, '_')}.xlsx`);
    toast({ title: "Excel Exported Successfully" });
  };

  const handleExportText = () => {
    const dataToExport = employees
      .filter(emp => {
        const dept = departments.find(d => d.id === emp.departmentId);
        const matchesUnit = selectedUnit === 'all' || (dept && dept.unitId === parseInt(selectedUnit));
        const matchesDept = selectedDept === 'all' || emp.departmentId === parseInt(selectedDept);
        const matchesSearch = searchQuery === "" || 
          `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (emp.employeeId || "").toLowerCase().includes(searchQuery.toLowerCase());
        return matchesUnit && matchesDept && matchesSearch;
      })
      .map(emp => {
        const stats = getDetailedLeaveStats(emp.id);
        return `${emp.employeeId || '-'}\t${emp.firstName} ${emp.lastName}\t${departments.find(d => d.id === emp.departmentId)?.name || '-'}\t${stats.approved}\t${stats.pending}\t${stats.remaining}\n`;
      });

    let textContent = `LEAVE REPORT - ${selectedMonth}\n`;
    textContent += `Unit: ${selectedUnit === 'all' ? 'All' : selectedUnit}\n`;
    textContent += "=".repeat(80) + "\n";
    textContent += `Emp ID\tName\tDepartment\tApproved\tPending\tRemaining\n`;
    textContent += "-".repeat(80) + "\n";
    textContent += dataToExport.join("");

    const blob = new Blob([textContent], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leave_report_${selectedMonth.replace(/\s+/g, '_')}.txt`;
    a.click();
    toast({ title: "Text File Exported" });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="text-page-title">Unit-wise Leave Reports</h1>
            <p className="text-slate-500 mt-1">Hierarchical leave analysis: Unit &gt; Department &gt; Employee</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-40 h-9" data-testid="select-month">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="January 2026">Jan 2026</SelectItem>
                <SelectItem value="December 2025">Dec 2025</SelectItem>
                <SelectItem value="Year 2025">Year 2025</SelectItem>
                <SelectItem value="November 2025">Nov 2025</SelectItem>
                <SelectItem value="October 2025">Oct 2025</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-800">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 hover-elevate px-2" onClick={handleExportPDF}>
                <FileDown className="h-3 w-3" /> PDF
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 hover-elevate px-2" onClick={handleExportExcel}>
                <FileSpreadsheet className="h-3 w-3" /> Excel
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 hover-elevate px-2" onClick={handleExportText}>
                <FileText className="h-3 w-3" /> Text
              </Button>
            </div>
          </div>
        </motion.div>

        <div className="flex gap-4 mb-6">
          <div className="w-64">
            <label className="text-xs font-semibold uppercase text-slate-500 mb-1 block">Unit</label>
            <Select value={selectedUnit} onValueChange={setSelectedUnit}>
              <SelectTrigger>
                <SelectValue placeholder="All Units" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Units</SelectItem>
                {units.map(u => (
                  <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-64">
            <label className="text-xs font-semibold uppercase text-slate-500 mb-1 block">Department</label>
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger>
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {units.find(u => u.id.toString() === selectedUnit) ? 
                  departments.filter(d => d.unitId === parseInt(selectedUnit)).map(d => (
                    <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                  )) : 
                  departments.map(d => (
                    <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {leaveStats.map((stat, index) => (
            <Card key={stat.title} data-testid={`card-stat-${index}`}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${stat.color}`}>{stat.icon}</div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                    <p className="text-sm text-slate-500">{stat.title}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-teal-600" />
                Unit Hierarchy View
              </CardTitle>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredDepartments.map((dept) => {
              const deptEmployees = employees.filter(e => e.departmentId === dept.id);
              const deptLeaves = leaveRequests.filter(r => deptEmployees.some(e => e.id === r.userId) && r.status === 'approved');
              
              return (
                <div key={dept.id} className="border rounded-lg overflow-hidden">
                  <div className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 border-b">
                    <div className="flex items-center gap-3">
                      <ChevronDown className="h-4 w-4" />
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{dept.name}</span>
                      <Badge variant="secondary" className="ml-2">
                        {deptEmployees.length} Employees
                      </Badge>
                      <Badge variant="outline" className="ml-2">
                        {deptLeaves.length} Total Approved Leaves
                      </Badge>
                    </div>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-950 divide-y">
                    {deptEmployees
                      .filter(e => e.firstName.toLowerCase().includes(searchQuery.toLowerCase()) || e.lastName.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(emp => {
                        const stats = getDetailedLeaveStats(emp.id);
                        const isExpanded = expandedEmployees.has(emp.id);
                        
                        return (
                          <div key={emp.id} className="flex flex-col">
                            <button
                              onClick={() => toggleEmployee(emp.id)}
                              className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors w-full text-left"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800">
                                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </div>
                                <div>
                                  <p className="font-medium">{emp.firstName} {emp.lastName}</p>
                                  <p className="text-xs text-slate-500">{emp.employeeId} | {emp.position}</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="text-green-600 bg-green-50 dark:bg-green-950">Used: {stats.approved}</Badge>
                                <Badge variant="outline" className="text-blue-600 bg-blue-50 dark:bg-blue-950">Remaining: {stats.remaining}</Badge>
                              </div>
                            </button>
                            
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="bg-slate-50/50 dark:bg-slate-900/50 p-4 border-t"
                                >
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                    <div className="bg-white dark:bg-slate-950 p-3 rounded border">
                                      <p className="text-xs text-slate-500 uppercase font-semibold">Accrued</p>
                                      <p className="text-lg font-bold">{stats.accrued}</p>
                                    </div>
                                    <div className="bg-white dark:bg-slate-950 p-3 rounded border text-green-600">
                                      <p className="text-xs text-slate-500 uppercase font-semibold">Approved</p>
                                      <p className="text-lg font-bold">{stats.approved}</p>
                                    </div>
                                    <div className="bg-white dark:bg-slate-950 p-3 rounded border text-yellow-600">
                                      <p className="text-xs text-slate-500 uppercase font-semibold">Pending</p>
                                      <p className="text-lg font-bold">{stats.pending}</p>
                                    </div>
                                    <div className="bg-white dark:bg-slate-950 p-3 rounded border text-red-600">
                                      <p className="text-xs text-slate-500 uppercase font-semibold">Rejected</p>
                                      <p className="text-lg font-bold">{stats.rejected}</p>
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                      <h4 className="text-sm font-semibold mb-2">Leave Types (Approved)</h4>
                                      <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                          <span>Annual Leave</span>
                                          <span className="font-medium">{stats.byType.annual}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                          <span>Sick Leave</span>
                                          <span className="font-medium">{stats.byType.sick}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                          <span>Personal Leave</span>
                                          <span className="font-medium">{stats.byType.personal}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-end justify-end gap-2">
                                      <Button variant="outline" size="sm" className="gap-2" onClick={() => handleDownloadIndividualPDF(emp)}>
                                        <FileDown className="h-4 w-4" /> Download PDF
                                      </Button>
                                      <Button variant="outline" size="sm" onClick={() => window.location.href=`/leave?id=${emp.id}`}>
                                        Full Profile History
                                      </Button>
                                    </div>
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
