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
import "jspdf-autotable";
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

  const getDetailedPayroll = (userId: number) => {
    // Sync logic: If actual payment records exist, use them. 
    // Otherwise, show the employee's base salary from their profile if it matches the filter
    const records = paymentRecords.filter(r => r.employeeId === userId && r.month === selectedMonth);
    
    if (records.length > 0) {
      const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
      const lastPayment = records.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0];
      return { 
        totalAmount, 
        count: records.length,
        lastPaymentDate: lastPayment?.paymentDate,
        lastPaymentMode: lastPayment?.paymentMode,
        lastRefNo: lastPayment?.referenceNo
      };
    }

    // Fallback to profile salary for reporting purposes if no payment record exists yet
    const emp = employees.find(e => e.id === userId);
    return {
      totalAmount: emp?.salary || 0,
      count: 0,
      lastPaymentDate: null,
      lastPaymentMode: null,
      lastRefNo: null
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
    { title: "Total Payroll (Month)", value: `₹${totalMonthlyPayroll.toLocaleString()}`, icon: <IndianRupee className="h-5 w-5" />, color: "bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400" },
    { title: "Units", value: units.length.toString(), icon: <Building2 className="h-5 w-5" />, color: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400" },
    { title: "Departments", value: departments.length.toString(), icon: <Users className="h-5 w-5" />, color: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400" },
    { title: "Employees Processed", value: employeesPaidCount.toString(), icon: <Users className="h-5 w-5" />, color: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400" },
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
          headStyles: { fillStyle: 'F', fillColor: [15, 23, 42] },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          margin: { top: 70 }
        });
      } else {
        throw new Error("autoTable plugin not loaded");
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

      doc.autoTable({
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
        headStyles: { fillColor: [15, 23, 42] },
        theme: 'striped'
      });

      addFooter(doc);
      addHRSignature(doc, doc.lastAutoTable.finalY + 20);
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
        return matchesUnit;
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
    let textContent = `PAYROLL REPORT - ${selectedMonth}\n`;
    textContent += `Unit: ${selectedUnit === 'all' ? 'All' : selectedUnit}\n`;
    textContent += "=".repeat(80) + "\n";
    textContent += `Emp ID\tName\tDepartment\tAmount Paid\n`;
    textContent += "-".repeat(80) + "\n";

    employees.forEach(emp => {
      const payroll = getDetailedPayroll(emp.id);
      textContent += `${emp.employeeId || '-'}\t${emp.firstName} ${emp.lastName}\t${departments.find(d => d.id === emp.departmentId)?.name || '-'}\t₹${payroll.totalAmount.toLocaleString()}\n`;
    });

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {payrollStats.map((stat, index) => (
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
              const deptPayrollTotal = deptEmployees.reduce((sum, emp) => sum + (getDetailedPayroll(emp.id).totalAmount || 0), 0);
              
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
                        Total Dept Payroll: ₹{deptPayrollTotal.toLocaleString()}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-950 divide-y">
                    {deptEmployees
                      .filter(e => e.firstName.toLowerCase().includes(searchQuery.toLowerCase()) || e.lastName.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(emp => {
                        const payroll = getDetailedPayroll(emp.id);
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
                                <Badge variant="outline" className="text-teal-600 bg-teal-50 dark:bg-teal-950 font-bold">₹{payroll.totalAmount.toLocaleString()}</Badge>
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
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-white dark:bg-slate-950 p-3 rounded border">
                                      <p className="text-xs text-slate-500 uppercase font-semibold">Base Salary (Sync)</p>
                                      <p className="text-lg font-bold">₹{(emp.salary || 0).toLocaleString()}</p>
                                    </div>
                                    <div className="bg-white dark:bg-slate-950 p-3 rounded border">
                                      <p className="text-xs text-slate-500 uppercase font-semibold">Payment Status</p>
                                      <p className="text-lg font-bold">{payroll.count > 0 ? 'Disbursed' : 'In Progress'}</p>
                                    </div>
                                    <div className="bg-white dark:bg-slate-950 p-3 rounded border">
                                      <p className="text-xs text-slate-500 uppercase font-semibold">Reference No</p>
                                      <p className="text-lg font-bold">{payroll.lastRefNo || 'N/A'}</p>
                                    </div>
                                  </div>
                                  
                                  <div className="mt-4 flex justify-end gap-2">
                                    <Button variant="outline" size="sm" className="gap-2" onClick={() => handleDownloadIndividualPDF(emp)}>
                                      <FileDown className="h-4 w-4" /> Download PDF
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => window.location.href=`/payroll/payslips?id=${emp.id}`}>
                                      View Detailed Payslip
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
