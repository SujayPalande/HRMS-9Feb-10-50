import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Download, Calendar, TrendingUp, Building2, UserPlus, UserMinus, Search, ChevronRight, ChevronDown, User as UserIcon, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import { addCompanyHeader, addWatermark, addHRSignature, addFooter, addDocumentDate, generateReferenceNumber, addReferenceNumber } from "@/lib/pdf-utils";
import { User, Department, Unit } from "@shared/schema";

export default function HeadcountReportPage() {
  const [selectedMonth, setSelectedMonth] = useState("January 2025");
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
    { title: "Total Headcount", value: employees.length.toString(), icon: <Users className="h-5 w-5" />, color: "bg-teal-50 text-teal-600" },
    { title: "New Hires", value: "18", icon: <UserPlus className="h-5 w-5" />, color: "bg-green-50 text-green-600" },
    { title: "Separations", value: "6", icon: <UserMinus className="h-5 w-5" />, color: "bg-red-50 text-red-600" },
    { title: "Growth Rate", value: "8.3%", icon: <TrendingUp className="h-5 w-5" />, color: "bg-blue-50 text-blue-600" },
  ];

  const handleExportPDF = () => {
    const doc = new jsPDF();
    addWatermark(doc);
    addCompanyHeader(doc, { title: "UNIT-WISE HEADCOUNT REPORT", subtitle: `Period: ${selectedMonth} | Unit: ${selectedUnit}` });
    addFooter(doc);
    const refNumber = generateReferenceNumber("HDC");
    addReferenceNumber(doc, refNumber, 68);
    addDocumentDate(doc, undefined, 68);
    doc.save(`headcount_report_${selectedMonth.replace(/\s+/g, '_')}.pdf`);
    toast({ title: "PDF Exported" });
  };

  const handleSendMail = () => {
    toast({ title: "Email Sent", description: "Headcount report has been sent to administrators." });
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
            <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">Unit-wise Headcount Reports</h1>
            <p className="text-slate-500 mt-1">Hierarchical headcount analysis: Unit &gt; Department &gt; Employee</p>
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
          {headcountStats.map((stat, index) => (
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
                                <Badge variant="outline" className="text-teal-600 bg-teal-50">Active</Badge>
                                <Badge variant="outline">{emp.employmentType}</Badge>
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
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-3">
                                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Employment Details</h4>
                                      <div className="space-y-1">
                                        <p className="text-sm flex justify-between">
                                          <span className="text-slate-500">Join Date:</span>
                                          <span className="font-medium">{emp.joinDate ? new Date(emp.joinDate).toLocaleDateString() : 'N/A'}</span>
                                        </p>
                                        <p className="text-sm flex justify-between">
                                          <span className="text-slate-500">Tenure:</span>
                                          <span className="font-medium">{getTenure(emp.joinDate)}</span>
                                        </p>
                                        <p className="text-sm flex justify-between">
                                          <span className="text-slate-500">Type:</span>
                                          <span className="font-medium capitalize">{emp.employmentType}</span>
                                        </p>
                                      </div>
                                    </div>
                                    <div className="space-y-3">
                                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Position info</h4>
                                      <div className="space-y-1">
                                        <p className="text-sm flex justify-between">
                                          <span className="text-slate-500">Role:</span>
                                          <span className="font-medium capitalize">{emp.role}</span>
                                        </p>
                                        <p className="text-sm flex justify-between">
                                          <span className="text-slate-500">Work Location:</span>
                                          <span className="font-medium">{emp.workLocation || 'Office'}</span>
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-end justify-end">
                                      <Button variant="outline" size="sm" onClick={() => window.location.href=`/employee/${emp.id}`}>
                                        View Full Employee Profile
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
