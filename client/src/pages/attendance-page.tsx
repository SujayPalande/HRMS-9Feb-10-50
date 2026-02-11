import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday } from "date-fns";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { CheckButton } from "@/components/attendance/check-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Clock, CheckCircle2, XCircle, Users, TrendingUp, Timer, AlertCircle, UserCheck, BarChart3, Activity, Target, Clock4, ClockIcon, Eye, FileDown, FileSpreadsheet, FileText
} from "lucide-react";
import { FaEdit, FaEye } from "react-icons/fa";
import { Attendance, User, LeaveRequest } from "@shared/schema";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { addCompanyHeader, addWatermark, addHRSignature, addFooter, addDocumentDate, generateReferenceNumber, addReferenceNumber } from "@/lib/pdf-utils";

export default function AttendancePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const initialEmployeeId = searchParams.get('id');

  const [isLeaveDetailsOpen, setIsLeaveDetailsOpen] = useState(false);
  const [selectedLeaveDetails, setSelectedLeaveDetails] = useState<LeaveRequest | null>(null);
  
  const { data: myAttendance = [] } = useQuery<Attendance[]>({
    queryKey: ["/api/attendance", { userId: user?.id }],
    enabled: !!user,
  });
  
  const { data: dateAttendance = [], isLoading: isLoadingDateAttendance } = useQuery<Attendance[]>({
    queryKey: ["/api/attendance", { date: format(selectedDate, 'yyyy-MM-dd') }],
    enabled: !!user && (user.role === 'admin' || user.role === 'hr' || user.role === 'manager'),
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
  
  const { data: employees = [] } = useQuery<User[]>({
    queryKey: ["/api/employees"],
    enabled: !!user && (user.role === 'admin' || user.role === 'hr' || user.role === 'manager'),
  });

  const { data: allLeaveRequests = [] } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave-requests"],
    enabled: !!user && (user.role === 'admin' || user.role === 'hr' || user.role === 'manager'),
  });

  const isEmployeeOnLeave = (employeeId: number, date: Date): boolean => {
    return allLeaveRequests.some(request => {
      if (request.userId !== employeeId || request.status !== 'approved') return false;
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);
      const check = new Date(date);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      check.setHours(12, 0, 0, 0);
      return check >= start && check <= end;
    });
  };

  const getEmployeeLeaveDetails = (employeeId: number, date: Date): LeaveRequest | null => {
    return allLeaveRequests.find(request => {
      if (request.userId !== employeeId || request.status !== 'approved') return false;
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);
      const check = new Date(date);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      check.setHours(12, 0, 0, 0);
      return check >= start && check <= end;
    }) || null;
  };

  const calculateStatusFromWorkingHours = (checkInTime: string | null, checkOutTime: string | null): string => {
    if (!checkInTime) return 'absent';
    if (!checkOutTime) return 'present';
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);
    const workingHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
    if (workingHours < 4) return 'absent';
    if (workingHours < 9) return 'halfday';
    return 'present';
  };

  const allEmployeeAttendanceData = employees.map(employee => {
    const attendanceRecord = dateAttendance.find(record => record.userId === employee.id);
    const onLeave = isEmployeeOnLeave(employee.id, selectedDate);
    let status: string;
    if (onLeave) status = 'on leave';
    else if (attendanceRecord && attendanceRecord.checkInTime) {
      status = attendanceRecord.status && attendanceRecord.checkOutTime ? attendanceRecord.status : calculateStatusFromWorkingHours(attendanceRecord.checkInTime, attendanceRecord.checkOutTime);
    } else status = 'absent';
    
    return {
      id: attendanceRecord?.id || 0,
      userId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      checkInTime: attendanceRecord?.checkInTime || null,
      checkOutTime: attendanceRecord?.checkOutTime || null,
      date: attendanceRecord?.date || format(selectedDate, 'yyyy-MM-dd'),
      status,
      notes: attendanceRecord?.notes || null,
    };
  });

  const filteredAttendanceData = initialEmployeeId 
    ? allEmployeeAttendanceData.filter(record => record.userId === parseInt(initialEmployeeId))
    : allEmployeeAttendanceData;

  const todayRecord = myAttendance.find(record => (record.date && isToday(new Date(record.date))) || (record.checkInTime && isToday(new Date(record.checkInTime))));

  const handleViewLeaveDetails = (employeeId: number) => {
    const leaveDetails = getEmployeeLeaveDetails(employeeId, selectedDate);
    if (leaveDetails) {
      setSelectedLeaveDetails(leaveDetails);
      setIsLeaveDetailsOpen(true);
    }
  };

  const adminColumns: ColumnDef<any>[] = [
    { accessorKey: "employeeName", header: "Employee" },
    { accessorKey: "checkInTime", header: "Check In", cell: ({ row }) => row.original.checkInTime ? format(new Date(row.original.checkInTime), 'hh:mm a') : 'N/A' },
    { accessorKey: "checkOutTime", header: "Check Out", cell: ({ row }) => row.original.checkOutTime ? format(new Date(row.original.checkOutTime), 'hh:mm a') : 'N/A' },
    { 
      accessorKey: "status", 
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        let variant: 'default' | 'destructive' | 'secondary' = 'destructive';
        if (status === 'present') variant = 'default';
        else if (status === 'halfday' || status === 'on leave') variant = 'secondary';
        return <Badge variant={variant} className="capitalize">{status}</Badge>;
      }
    },
    {
      id: "leave",
      header: "Leave",
      cell: ({ row }) => row.original.status === 'on leave' && (
        <Button variant="ghost" size="sm" onClick={() => handleViewLeaveDetails(row.original.userId)}><FaEye className="h-4 w-4 text-blue-600" /></Button>
      )
    }
  ];

  const handleExportIndividual = (type: 'pdf' | 'excel' | 'text') => {
    if (!initialEmployeeId) return;
    const emp = employees.find(e => e.id === parseInt(initialEmployeeId));
    if (!emp) return;
    const stats = filteredAttendanceData;

    if (type === 'pdf') {
      const doc = new jsPDF() as any;
      addWatermark(doc);
      addCompanyHeader(doc, { title: "INDIVIDUAL ATTENDANCE HISTORY", subtitle: `${emp.firstName} ${emp.lastName}` });
      const tableData = stats.map(s => [format(new Date(s.date), 'MMM dd, yyyy'), s.checkInTime ? format(new Date(s.checkInTime), 'hh:mm a') : 'N/A', s.checkOutTime ? format(new Date(s.checkOutTime), 'hh:mm a') : 'N/A', s.status]);
      autoTable(doc, { head: [['Date', 'Check In', 'Check Out', 'Status']], body: tableData, startY: 70 });
      addFooter(doc);
      doc.save(`attendance_history_${emp.firstName}.pdf`);
    } else if (type === 'excel') {
      const ws = XLSX.utils.json_to_sheet(stats);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "History");
      XLSX.writeFile(wb, `attendance_history_${emp.firstName}.xlsx`);
    } else {
      const content = stats.map(s => `${s.date}\t${s.status}`).join('\n');
      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_history_${emp.firstName}.txt`;
      a.click();
    }
    toast({ title: `Exported ${type.toUpperCase()} Successfully` });
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-slate-50">
        <div className="bg-slate-900 text-white p-12">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold">Attendance Management</h1>
              <p className="text-slate-300 mt-2">View and manage team presence</p>
            </div>
            {initialEmployeeId && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleExportIndividual('pdf')}><FileDown className="h-4 w-4 mr-2" /> PDF</Button>
                <Button variant="outline" size="sm" onClick={() => handleExportIndividual('excel')}><FileSpreadsheet className="h-4 w-4 mr-2" /> Excel</Button>
                <Button variant="outline" size="sm" onClick={() => handleExportIndividual('text')}><FileText className="h-4 w-4 mr-2" /> Text</Button>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-8">
          <Tabs defaultValue={initialEmployeeId ? "all-attendance" : "my-attendance"}>
            <TabsList className="mb-8">
              <TabsTrigger value="my-attendance">My Attendance</TabsTrigger>
              {(user?.role === 'admin' || user?.role === 'hr') && <TabsTrigger value="all-attendance">Team Overview</TabsTrigger>}
            </TabsList>

            <TabsContent value="all-attendance">
              <Card>
                <CardHeader>
                  <CardTitle>{initialEmployeeId ? "Employee History" : "Team Records"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <DataTable columns={adminColumns} data={filteredAttendanceData} searchKey="employeeName" />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
