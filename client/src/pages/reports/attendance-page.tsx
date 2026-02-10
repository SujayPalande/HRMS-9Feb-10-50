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
import { User, Department } from "@shared/schema";

export default function AttendanceReportPage() {
  const [selectedMonth, setSelectedMonth] = useState("January 2025");
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [expandedDepts, setExpandedDepts] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: employees = [] } = useQuery<User[]>({ queryKey: ["/api/employees"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });

  const toggleDept = (deptId: number) => {
    const newSet = new Set(expandedDepts);
    if (newSet.has(deptId)) newSet.delete(deptId);
    else newSet.add(deptId);
    setExpandedDepts(newSet);
  };

  const units = ["Cybaemtech", "Other Unit"]; // Mock units

  const reportStats = [
    { title: "Total Employees", value: employees.length.toString(), icon: <Users className="h-5 w-5" />, color: "bg-teal-50 text-teal-600" },
    { title: "Units", value: units.length.toString(), icon: <Building2 className="h-5 w-5" />, color: "bg-blue-50 text-blue-600" },
    { title: "Departments", value: departments.length.toString(), icon: <ClipboardList className="h-5 w-5" />, color: "bg-yellow-50 text-yellow-600" },
    { title: "Average Attendance", value: "94.5%", icon: <TrendingUp className="h-5 w-5" />, color: "bg-green-50 text-green-600" },
  ];

  const handleExportPDF = () => {
    const doc = new jsPDF();
    addWatermark(doc);
    addCompanyHeader(doc, { title: "UNIT-WISE ATTENDANCE REPORT", subtitle: `Period: ${selectedMonth} | Unit: ${selectedUnit}` });
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
            <Select value={selectedUnit} onValueChange={setSelectedUnit}>
              <SelectTrigger className="w-40" data-testid="select-unit">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select Unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Units</SelectItem>
                {units.map(u => <SelectItem key={u} value={u.toLowerCase()}>{u}</SelectItem>)}
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
            {departments.map((dept) => (
              <div key={dept.id} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleDept(dept.id)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expandedDepts.has(dept.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="font-semibold text-slate-700">{dept.name}</span>
                    <Badge variant="secondary" className="ml-2">
                      {employees.filter(e => e.departmentId === dept.id).length} Employees
                    </Badge>
                  </div>
                </button>
                <AnimatePresence>
                  {expandedDepts.has(dept.id) && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-2 bg-white divide-y">
                        {employees
                          .filter(e => e.departmentId === dept.id && (e.firstName.toLowerCase().includes(searchQuery.toLowerCase()) || e.lastName.toLowerCase().includes(searchQuery.toLowerCase())))
                          .map(emp => (
                            <div key={emp.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-slate-100"><UserIcon className="h-4 w-4 text-slate-500" /></div>
                                <div>
                                  <p className="font-medium">{emp.firstName} {emp.lastName}</p>
                                  <p className="text-xs text-slate-500">{emp.employeeId} | {emp.position}</p>
                                </div>
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => window.location.href=`/employee/${emp.id}`}>View Details</Button>
                            </div>
                          ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
