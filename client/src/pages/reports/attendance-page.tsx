import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Download, Calendar, Clock, Users, TrendingUp, AlertTriangle, Search, FileSpreadsheet, Building2, ChevronRight, ChevronDown, User as UserIcon, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { addCompanyHeader, addWatermark, addHRSignature, addFooter, addDocumentDate, generateReferenceNumber, addReferenceNumber } from "@/lib/pdf-utils";
import { User, Department, Unit } from "@shared/schema";

export default function AttendanceReportPage() {
  const [selectedMonth, setSelectedMonth] = useState("January 2025");
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [selectedDept, setSelectedDept] = useState("all");
  const [expandedEmployees, setExpandedEmployees] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: units = [] } = useQuery<Unit[]>({ queryKey: ["/api/masters/units"] });
  const { data: employees = [] } = useQuery<User[]>({ queryKey: ["/api/employees"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: attendanceRecords = [] } = useQuery<any[]>({ queryKey: ["/api/attendance"] });

  const toggleEmployee = (empId: number) => {
    const newSet = new Set(expandedEmployees);
    if (newSet.has(empId)) newSet.delete(empId);
    else newSet.add(empId);
    setExpandedEmployees(newSet);
  };

  const getMonthData = (monthYear: string) => {
    const [monthName, year] = monthYear.split(" ");
    const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();
    const startDate = new Date(parseInt(year), monthIndex, 1);
    const endDate = new Date(parseInt(year), monthIndex + 1, 0);
    return { startDate, endDate, monthIndex, year: parseInt(year) };
  };

  const filteredDepartments = departments.filter(d => 
    (selectedUnit === "all" || d.unitId === parseInt(selectedUnit)) &&
    (selectedDept === "all" || d.id === parseInt(selectedDept))
  );

  const { startDate, endDate } = getMonthData(selectedMonth);

  const getDetailedAttendance = (userId: number) => {
    const userRecords = attendanceRecords.filter(r => {
      const d = new Date(r.date);
      return r.userId === userId && d >= startDate && d <= endDate;
    });
    
    const present = userRecords.filter(r => r.status === 'present').length;
    const absent = userRecords.filter(r => r.status === 'absent').length;
    const halfday = userRecords.filter(r => r.status === 'halfday').length;
    const late = userRecords.filter(r => r.status === 'late').length;
    
    return { present, absent, halfday, late, total: userRecords.length };
  };

  const reportStats = [
    { title: "Total Employees", value: employees.length.toString(), icon: <Users className="h-5 w-5" />, color: "bg-teal-50 text-teal-600" },
    { title: "Units", value: units.length.toString(), icon: <Building2 className="h-5 w-5" />, color: "bg-blue-50 text-blue-600" },
    { title: "Departments", value: departments.length.toString(), icon: <ClipboardList className="h-5 w-5" />, color: "bg-yellow-50 text-yellow-600" },
    { title: "Present Today", value: attendanceRecords.filter(r => new Date(r.date).toDateString() === new Date().toDateString() && r.status === 'present').length.toString(), icon: <TrendingUp className="h-5 w-5" />, color: "bg-green-50 text-green-600" },
  ];

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    addWatermark(doc);
    addCompanyHeader(doc, { title: "UNIT-WISE ATTENDANCE REPORT", subtitle: `Period: ${selectedMonth} | Unit: ${selectedUnit === 'all' ? 'All Units' : units.find(u => u.id === parseInt(selectedUnit))?.name}` });
    
    const tableData = employees
      .filter(emp => {
        const dept = departments.find(d => d.id === emp.departmentId);
        return selectedUnit === 'all' || (dept && dept.unitId === parseInt(selectedUnit));
      })
      .map(emp => {
        const stats = getEmployeeAttendance(emp.id);
        return [
          emp.employeeId || '-',
          `${emp.firstName} ${emp.lastName}`,
          departments.find(d => d.id === emp.departmentId)?.name || '-',
          stats.present.toString(),
          stats.absent.toString(),
          stats.halfday.toString(),
          (stats.present + stats.absent + stats.halfday).toString()
        ];
      });

    (doc as any).autoTable({
      head: [['Emp ID', 'Name', 'Department', 'Present', 'Absent', 'Half Day', 'Total Days']],
      body: tableData,
      startY: 70,
    });

    addFooter(doc);
    const refNumber = generateReferenceNumber("ATT");
    addReferenceNumber(doc, refNumber, 68);
    addDocumentDate(doc, undefined, 68);
    doc.save(`attendance_report_${selectedMonth.replace(/\s+/g, '_')}.pdf`);
    toast({ title: "PDF Exported" });
  };

  const handleSendMail = () => {
    toast({ title: "Email Sent", description: "Attendance report has been sent to administrators." });
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
            <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">Unit-wise Attendance Reports</h1>
            <p className="text-slate-500 mt-1">Hierarchical analysis: Unit &gt; Department &gt; Employee</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-40" data-testid="select-month">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="January 2026">January 2026</SelectItem>
                <SelectItem value="December 2025">December 2025</SelectItem>
                <SelectItem value="November 2025">November 2025</SelectItem>
                <SelectItem value="October 2025">October 2025</SelectItem>
                <SelectItem value="September 2025">September 2025</SelectItem>
                <SelectItem value="August 2025">August 2025</SelectItem>
                <SelectItem value="July 2025">July 2025</SelectItem>
                <SelectItem value="June 2025">June 2025</SelectItem>
                <SelectItem value="May 2025">May 2025</SelectItem>
                <SelectItem value="April 2025">April 2025</SelectItem>
                <SelectItem value="March 2025">March 2025</SelectItem>
                <SelectItem value="February 2025">February 2025</SelectItem>
                <SelectItem value="January 2025">January 2025</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedUnit} onValueChange={(val) => { setSelectedUnit(val); setSelectedDept("all"); }}>
              <SelectTrigger className="w-40" data-testid="select-unit">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select Unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Units</SelectItem>
                {units.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger className="w-40" data-testid="select-dept">
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select Dept" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.filter(d => selectedUnit === "all" || d.unitId === parseInt(selectedUnit)).map(d => (
                  <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2" onClick={handleExportPDF}>
              <Download className="h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleSendMail}>
              <Mail className="h-4 w-4" /> Mail
            </Button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {reportStats.map((stat, index) => (
            <Card key={stat.title} data-testid={`card-stat-${index}`}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${stat.color}`}>{stat.icon}</div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
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
              
              return (
                <div key={dept.id} className="border rounded-lg overflow-hidden">
                  <div className="w-full flex items-center justify-between p-4 bg-slate-50 border-b">
                    <div className="flex items-center gap-3">
                      <ChevronDown className="h-4 w-4" />
                      <span className="font-semibold text-slate-700">{dept.name}</span>
                      <Badge variant="secondary" className="ml-2">
                        {deptEmployees.length} Employees
                      </Badge>
                    </div>
                  </div>
                  <div className="p-2 bg-white divide-y">
                    {deptEmployees
                      .filter(e => e.firstName.toLowerCase().includes(searchQuery.toLowerCase()) || e.lastName.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(emp => {
                        const stats = getDetailedAttendance(emp.id);
                        const isExpanded = expandedEmployees.has(emp.id);
                        
                        return (
                          <div key={emp.id} className="flex flex-col">
                            <button
                              onClick={() => toggleEmployee(emp.id)}
                              className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors w-full text-left"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-slate-100">
                                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </div>
                                <div>
                                  <p className="font-medium">{emp.firstName} {emp.lastName}</p>
                                  <p className="text-xs text-slate-500">{emp.employeeId} | {emp.position}</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="text-green-600 bg-green-50">Present: {stats.present}</Badge>
                                <Badge variant="outline" className="text-red-600 bg-red-50">Absent: {stats.absent}</Badge>
                              </div>
                            </button>
                            
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="bg-slate-50/50 p-4 border-t"
                                >
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-white p-3 rounded border">
                                      <p className="text-xs text-slate-500 uppercase font-semibold">Present Days</p>
                                      <p className="text-lg font-bold text-green-600">{stats.present}</p>
                                    </div>
                                    <div className="bg-white p-3 rounded border">
                                      <p className="text-xs text-slate-500 uppercase font-semibold">Absent Days</p>
                                      <p className="text-lg font-bold text-red-600">{stats.absent}</p>
                                    </div>
                                    <div className="bg-white p-3 rounded border">
                                      <p className="text-xs text-slate-500 uppercase font-semibold">Half Days</p>
                                      <p className="text-lg font-bold text-yellow-600">{stats.halfday}</p>
                                    </div>
                                    <div className="bg-white p-3 rounded border">
                                      <p className="text-xs text-slate-500 uppercase font-semibold">Late Arrivals</p>
                                      <p className="text-lg font-bold text-orange-600">{stats.late}</p>
                                    </div>
                                  </div>
                                  <div className="mt-4 flex justify-end">
                                    <Button variant="outline" size="sm" onClick={() => window.location.href=`/employee/${emp.id}`}>
                                      View Detailed Attendance Log
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
