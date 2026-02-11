import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  IndianRupee, 
  Download, 
  Calendar, 
  TrendingUp, 
  Users, 
  Wallet, 
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

export default function PayrollReportPage() {
  const [selectedMonth, setSelectedMonth] = useState("January 2026");
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [selectedDept, setSelectedDept] = useState("all");
  const [expandedEmployees, setExpandedEmployees] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: units = [] } = useQuery<Unit[]>({ queryKey: ["/api/masters/units"] });
  const { data: employees = [] } = useQuery<User[]>({ queryKey: ["/api/employees"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: paymentRecords = [] } = useQuery<any[]>({ queryKey: ["/api/payroll/payments"] });

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

  const getDetailedPayroll = (userId: number) => {
    // Sync logic: Use payment records for the selected month
    const records = paymentRecords.filter(r => r.employeeId === userId && r.month === selectedMonth);
    const emp = employees.find(e => e.id === userId);
    
    // Calculate expected amount based on employee salary if no record exists
    const baseAmount = emp?.salary || 0;
    
    if (records.length > 0) {
      const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
      const lastPayment = records.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0];
      return { 
        totalAmount, 
        count: records.length,
        lastPaymentDate: lastPayment?.paymentDate,
        lastPaymentMode: lastPayment?.paymentMode,
        lastRefNo: lastPayment?.referenceNo,
        isSynced: true
      };
    }

    return {
      totalAmount: baseAmount,
      count: 0,
      lastPaymentDate: null,
      lastPaymentMode: null,
      lastRefNo: null,
      isSynced: false
    };
  };

  const totalMonthlyPayroll = employees
    .filter(emp => {
      const dept = departments.find(d => d.id === emp.departmentId);
      const matchesUnit = selectedUnit === 'all' || (dept && dept.unitId === parseInt(selectedUnit));
      const matchesDept = selectedDept === 'all' || emp.departmentId === parseInt(selectedDept);
      return matchesUnit && matchesDept;
    })
    .reduce((sum, emp) => {
      const payroll = getDetailedPayroll(emp.id);
      return sum + payroll.totalAmount;
    }, 0);

  const employeesPaidCount = employees.filter(emp => {
    const payroll = getDetailedPayroll(emp.id);
    return payroll.totalAmount > 0;
  }).length;

  const payrollStats = [
    { title: "Total Payroll", value: `₹${totalMonthlyPayroll.toLocaleString()}`, icon: <IndianRupee className="h-6 w-6" />, color: "bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" },
    { title: "Units", value: units.length.toString(), icon: <Building2 className="h-6 w-6" />, color: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
    { title: "Departments", value: departments.length.toString(), icon: <IndianRupee className="h-6 w-6" />, color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" },
    { title: "Employees Paid", value: employeesPaidCount.toString(), icon: <Users className="h-6 w-6" />, color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
  ];

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' }) as any;
      addWatermark(doc);
      addCompanyHeader(doc, { 
        title: "UNIT-WISE PAYROLL REPORT", 
        subtitle: `Period: ${selectedMonth} | Unit: ${selectedUnit === 'all' ? 'All Units' : units.find(u => u.id === parseInt(selectedUnit))?.name}` 
      });
      
      const tableData = employees
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
          const payroll = getDetailedPayroll(emp.id);
          return [
            emp.employeeId || '-',
            `${emp.firstName} ${emp.lastName}`,
            departments.find(d => d.id === emp.departmentId)?.name || '-',
            `₹${payroll.totalAmount.toLocaleString()}`
          ];
        });

      if (doc.autoTable) {
        doc.autoTable({
          head: [['Emp ID', 'Name', 'Department', 'Amount']],
          body: tableData,
          startY: 70,
          headStyles: { fillColor: [15, 23, 42] as [number, number, number] },
          alternateRowStyles: { fillColor: [245, 247, 250] as [number, number, number] },
          margin: { top: 70 }
        });
      } else {
        autoTable(doc, {
          head: [['Emp ID', 'Name', 'Department', 'Amount']],
          body: tableData,
          startY: 70,
          headStyles: { fillColor: [15, 23, 42] as [number, number, number] },
          alternateRowStyles: { fillColor: [245, 247, 250] as [number, number, number] },
          margin: { top: 70 }
        });
      }

      addFooter(doc);
      const refNumber = generateReferenceNumber("PAY");
      addReferenceNumber(doc, refNumber, 68);
      addDocumentDate(doc, undefined, 68);
      doc.save(`payroll_report_${selectedMonth.replace(/\s+/g, '_')}.pdf`);
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
        title: "INDIVIDUAL PAYROLL STATEMENT", 
        subtitle: `${emp.firstName} ${emp.lastName} | ${selectedMonth}` 
      });

      const payroll = getDetailedPayroll(emp.id);
      const dept = departments.find(d => d.id === emp.departmentId);

      const options = {
        startY: 70,
        head: [['Payroll Detail', 'Information']],
        body: [
          ['Employee Name', `${emp.firstName} ${emp.lastName}`],
          ['Employee ID', emp.employeeId || '-'],
          ['Department', dept?.name || '-'],
          ['Position', emp.position || '-'],
          ['Disbursed Amount', `₹${payroll.totalAmount.toLocaleString()}`],
          ['Payment Status', payroll.count > 0 ? 'Disbursed' : 'In Progress'],
          ['Reference No', payroll.lastRefNo || 'N/A'],
          ['Payment Date', payroll.lastPaymentDate ? new Date(payroll.lastPaymentDate).toLocaleDateString() : 'N/A'],
          ['Payment Mode', payroll.lastPaymentMode || 'N/A'],
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
      const refNumber = generateReferenceNumber("IND-PAY");
      addReferenceNumber(doc, refNumber, 68);
      addDocumentDate(doc, undefined, 68);
      doc.save(`payroll_${emp.firstName}_${emp.lastName}_${selectedMonth.replace(/\s+/g, '_')}.pdf`);
      toast({ title: "Individual Payroll Statement Exported" });
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
        const payroll = getDetailedPayroll(emp.id);
        return {
          'Employee ID': emp.employeeId || '-',
          'Name': `${emp.firstName} ${emp.lastName}`,
          'Department': departments.find(d => d.id === emp.departmentId)?.name || '-',
          'Amount': payroll.totalAmount
        };
      });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll");
    XLSX.writeFile(workbook, `payroll_report_${selectedMonth.replace(/\s+/g, '_')}.xlsx`);
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
        const payroll = getDetailedPayroll(emp.id);
        return `${emp.employeeId || '-'}\t${emp.firstName} ${emp.lastName}\t${departments.find(d => d.id === emp.departmentId)?.name || '-'}\t₹${payroll.totalAmount.toLocaleString()}\n`;
      });

    let textContent = `PAYROLL REPORT - ${selectedMonth}\n`;
    textContent += `Unit: ${selectedUnit === 'all' ? 'All' : selectedUnit}\n`;
    textContent += "=".repeat(80) + "\n";
    textContent += `Emp ID\tName\tDepartment\tAmount Paid\n`;
    textContent += "-".repeat(80) + "\n";
    textContent += dataToExport.join("");

    const blob = new Blob([textContent], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll_report_${selectedMonth.replace(/\s+/g, '_')}.txt`;
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
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="text-page-title">Unit-wise Payroll Reports</h1>
            <p className="text-slate-500 mt-1">Hierarchical payroll analysis: Unit &gt; Department &gt; Employee</p>
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
          {payrollStats.map((stat, index) => (
            <Card key={stat.title} data-testid={`card-stat-${index}`} className="hover-elevate transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${stat.color} shadow-sm`}>{stat.icon}</div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{stat.title}</p>
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
              const deptEmployees = filteredEmployees.filter(e => e.departmentId === dept.id);
              const deptPayrollTotal = deptEmployees.reduce((sum, emp) => sum + (getDetailedPayroll(emp.id).totalAmount || 0), 0);
              
              if (deptEmployees.length === 0) return null;

              return (
                <div key={dept.id} className="border rounded-lg overflow-hidden transition-all duration-300 hover:border-teal-200">
                  <div className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 border-b">
                    <div className="flex items-center gap-3">
                      <ChevronDown className="h-4 w-4 text-teal-600" />
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{dept.name}</span>
                      <Badge variant="secondary" className="ml-2 font-medium bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                        {deptEmployees.length} Employees
                      </Badge>
                      <Badge variant="outline" className="ml-2 border-teal-200 text-teal-600">
                        Total Dept Payroll: ₹{deptPayrollTotal.toLocaleString()}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-0 bg-white dark:bg-slate-950 divide-y">
                    {deptEmployees
                      .map(emp => {
                        const payroll = getDetailedPayroll(emp.id);
                        const isExpanded = expandedEmployees.has(emp.id);
                        
                        return (
                          <div key={emp.id} className="flex flex-col">
                            <button
                              onClick={() => toggleEmployee(emp.id)}
                              className="p-4 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-900/80 transition-all w-full text-left"
                            >
                              <div className="flex items-center gap-4">
                                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 transition-transform duration-200">
                                  {isExpanded ? <ChevronDown className="h-4 w-4 text-teal-600" /> : <ChevronRight className="h-4 w-4" />}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-900 dark:text-slate-100">{emp.firstName} {emp.lastName}</p>
                                  <p className="text-xs font-medium text-slate-500 uppercase tracking-tighter">{emp.employeeId} • {emp.position}</p>
                                </div>
                              </div>
                              <div className="flex gap-3">
                                <Badge variant="outline" className="text-teal-600 bg-teal-50 border-teal-100 dark:bg-teal-950/30 font-black px-2 py-0.5">₹{payroll.totalAmount.toLocaleString()}</Badge>
                              </div>
                            </button>
                            
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="bg-slate-50/40 dark:bg-slate-900/40 p-5 border-t border-slate-100 dark:border-slate-800"
                                >
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                                    <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border shadow-sm transition-transform hover:scale-[1.02]">
                                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Base Salary</p>
                                      <p className="text-xl font-black">₹{(emp.salary || 0).toLocaleString()}</p>
                                    </div>
                                    <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border shadow-sm transition-transform hover:scale-[1.02]">
                                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Status</p>
                                      <p className="text-xl font-black text-teal-600">{payroll.count > 0 ? 'Disbursed' : 'In Progress'}</p>
                                    </div>
                                    <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border shadow-sm transition-transform hover:scale-[1.02]">
                                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Ref No</p>
                                      <p className="text-xl font-black">{payroll.lastRefNo || 'N/A'}</p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex justify-end gap-3">
                                    <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs font-bold gap-2 hover-elevate" onClick={() => handleDownloadIndividualPDF(emp)}>
                                      <FileDown className="h-3.5 w-3.5" /> PDF Statement
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs font-bold hover-elevate" onClick={() => window.location.href=`/payroll/payslips?id=${emp.id}`}>
                                      Detailed Payslip
                                    </Button>
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
