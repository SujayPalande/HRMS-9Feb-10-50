import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  CalendarDays, 
  Calendar, 
  Users, 
  Clock, 
  Search, 
  Building2, 
  ChevronRight, 
  ChevronDown, 
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

  const filteredEmployees = employees.filter(emp => {
    const dept = departments.find(d => d.id === emp.departmentId);
    const matchesUnit = selectedUnit === 'all' || (dept && dept.unitId === parseInt(selectedUnit));
    const matchesDept = selectedDept === 'all' || emp.departmentId === parseInt(selectedDept);
    const matchesSearch = searchQuery === "" || 
      `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.employeeId || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesUnit && matchesDept && matchesSearch;
  });

  const filteredDepartments = departments.filter(d => 
    (selectedUnit === "all" || d.unitId === parseInt(selectedUnit)) &&
    (selectedDept === "all" || d.id === parseInt(selectedDept))
  );

  const getDetailedLeaveStats = (userId: number) => {
    const userLeaves = leaveRequests.filter(r => r.userId === userId);
    const approved = userLeaves.filter(r => r.status === 'approved');
    return {
      approved: approved.length,
      pending: userLeaves.filter(r => r.status === 'pending').length,
      rejected: userLeaves.filter(r => r.status === 'rejected').length,
      accrued: 24,
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
      addCompanyHeader(doc, { title: "UNIT-WISE LEAVE REPORT", subtitle: `Period: ${selectedMonth}` });
      const tableData = filteredEmployees.map(emp => {
        const stats = getDetailedLeaveStats(emp.id);
        return [emp.employeeId || '-', `${emp.firstName} ${emp.lastName}`, departments.find(d => d.id === emp.departmentId)?.name || '-', stats.approved.toString(), stats.pending.toString(), stats.remaining.toString()];
      });
      autoTable(doc, { head: [['Emp ID', 'Name', 'Department', 'Approved', 'Pending', 'Remaining']], body: tableData, startY: 70 });
      addFooter(doc);
      doc.save(`leave_report_${selectedMonth}.pdf`);
      toast({ title: "PDF Exported" });
    } catch (error) { toast({ title: "Export Failed", variant: "destructive" }); }
  };

  const handleDownloadIndividualPDF = (emp: User) => {
    try {
      const doc = new jsPDF() as any;
      addWatermark(doc);
      addCompanyHeader(doc, { title: "INDIVIDUAL LEAVE REPORT", subtitle: `${emp.firstName} ${emp.lastName}` });
      const stats = getDetailedLeaveStats(emp.id);
      autoTable(doc, {
        startY: 70,
        head: [['Metric', 'Value']],
        body: [['Approved', stats.approved], ['Pending', stats.pending], ['Remaining', stats.remaining]]
      });
      addHRSignature(doc, 150);
      doc.save(`leave_${emp.firstName}.pdf`);
    } catch (e) {}
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Unit-wise Leave Reports</h1>
            <p className="text-slate-500">Hierarchical leave analysis</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF}><FileDown className="h-4 w-4 mr-2" /> PDF Report</Button>
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
          {leaveStats.map((stat) => (
            <Card key={stat.title}><CardContent className="p-6 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.color}`}>{stat.icon}</div>
              <div><p className="text-2xl font-bold">{stat.value}</p><p className="text-sm text-slate-500">{stat.title}</p></div>
            </CardContent></Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-teal-600" /> Unit Hierarchy</CardTitle>
              <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-64" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredDepartments.map((dept) => {
              const deptEmployees = filteredEmployees.filter(e => e.departmentId === dept.id);
              if (deptEmployees.length === 0) return null;
              return (
                <div key={dept.id} className="border rounded-lg overflow-hidden">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b flex justify-between items-center">
                    <span className="font-semibold">{dept.name}</span>
                    <Badge variant="secondary">{deptEmployees.length} Employees</Badge>
                  </div>
                  <div className="divide-y">
                    {deptEmployees.map(emp => {
                      const stats = getDetailedLeaveStats(emp.id);
                      const isExpanded = expandedEmployees.has(emp.id);
                      return (
                        <div key={emp.id}>
                          <button onClick={() => toggleEmployee(emp.id)} className="w-full p-4 flex items-center justify-between hover:bg-slate-50">
                            <div className="flex items-center gap-3">
                              {isExpanded ? <ChevronDown className="h-4 w-4 text-teal-600" /> : <ChevronRight className="h-4 w-4" />}
                              <div><p className="font-medium">{emp.firstName} {emp.lastName}</p><p className="text-xs text-slate-500">{emp.position}</p></div>
                            </div>
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-teal-600">Used: {stats.approved}</Badge>
                              <Badge variant="outline">Rem: {stats.remaining}</Badge>
                            </div>
                          </button>
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="p-4 bg-slate-50/50 border-t overflow-hidden">
                                <div className="grid grid-cols-3 gap-4 mb-4">
                                  <div className="p-3 bg-white border rounded">Accrued: {stats.accrued}</div>
                                  <div className="p-3 bg-white border rounded text-teal-600 font-bold">Approved: {stats.approved}</div>
                                  <div className="p-3 bg-white border rounded">Pending: {stats.pending}</div>
                                </div>
                                <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => handleDownloadIndividualPDF(emp)}>PDF Report</Button></div>
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
