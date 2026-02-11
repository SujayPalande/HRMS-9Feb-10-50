import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { CheckButton } from "@/components/attendance/check-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { 
  Clock, CheckCircle2, XCircle, Users, Calendar as CalendarIcon, 
  ChevronLeft, ChevronRight, Activity, Clock4, UserCheck, 
  FileDown, FileSpreadsheet, FileText, LayoutDashboard, History
} from "lucide-react";
import { FaEye } from "react-icons/fa";
import { Attendance, User, LeaveRequest } from "@shared/schema";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { addCompanyHeader, addWatermark, addFooter } from "@/lib/pdf-utils";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AttendancePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const initialEmployeeId = searchParams.get('id');

  const { data: myAttendance = [] } = useQuery<Attendance[]>({
    queryKey: ["/api/attendance", { userId: user?.id }],
    enabled: !!user,
  });
  
  const { data: dateAttendance = [] } = useQuery<Attendance[]>({
    queryKey: ["/api/attendance", { date: format(selectedDate, 'yyyy-MM-dd') }],
    enabled: !!user && ['admin', 'hr', 'manager'].includes(user.role),
  });
  
  const { data: employees = [] } = useQuery<User[]>({
    queryKey: ["/api/employees"],
    enabled: !!user && ['admin', 'hr', 'manager'].includes(user.role),
  });

  const { data: allLeaveRequests = [] } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave-requests"],
    enabled: !!user && ['admin', 'hr', 'manager'].includes(user.role),
  });

  const isEmployeeOnLeave = (employeeId: number, date: Date): boolean => {
    return allLeaveRequests.some(request => {
      if (request.userId !== employeeId || request.status !== 'approved') return false;
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    });
  };

  const getDayStatus = (date: Date, attendance: Attendance[]) => {
    const record = attendance.find(r => r.date && isSameDay(new Date(r.date), date));
    if (record) return record.status;
    if (isEmployeeOnLeave(user?.id || 0, date)) return 'on leave';
    if (date > new Date()) return 'upcoming';
    return 'absent';
  };

  const allEmployeeAttendanceData = employees.map(employee => {
    const attendanceRecord = dateAttendance.find(record => record.userId === employee.id);
    const onLeave = isEmployeeOnLeave(employee.id, selectedDate);
    let status: string;
    if (onLeave) status = 'on leave';
    else if (attendanceRecord?.checkInTime) status = attendanceRecord.status || 'present';
    else status = 'absent';
    
    return {
      id: attendanceRecord?.id || 0,
      userId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      checkInTime: attendanceRecord?.checkInTime || null,
      checkOutTime: attendanceRecord?.checkOutTime || null,
      status,
    };
  });

  const todayRecord = myAttendance.find(r => r.date && isToday(new Date(r.date)));

  const stats = [
    { label: "Today's Status", value: todayRecord?.status || "Absent", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" },
    { label: "Check In Time", value: todayRecord?.checkInTime ? format(new Date(todayRecord.checkInTime), 'hh:mm a') : "--:--", icon: Clock, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Check Out Time", value: todayRecord?.checkOutTime ? format(new Date(todayRecord.checkOutTime), 'hh:mm a') : "--:--", icon: Clock4, color: "text-orange-500", bg: "bg-orange-50" },
    { label: "Work Hours", value: "--h", icon: Activity, color: "text-purple-500", bg: "bg-purple-50" },
  ];

  const teamStats = [
    { label: "Present Today", value: allEmployeeAttendanceData.filter(d => d.status === 'present').length, icon: UserCheck, color: "text-emerald-500", bg: "bg-emerald-50" },
    { label: "Absent Today", value: allEmployeeAttendanceData.filter(d => d.status === 'absent').length, icon: XCircle, color: "text-rose-500", bg: "bg-rose-50" },
    { label: "Half Day", value: allEmployeeAttendanceData.filter(d => d.status === 'halfday').length, icon: Clock4, color: "text-orange-500", bg: "bg-orange-50" },
    { label: "On Leave", value: allEmployeeAttendanceData.filter(d => d.status === 'on leave').length, icon: CalendarIcon, color: "text-amber-500", bg: "bg-amber-50" },
    { label: "Total Team", value: employees.length, icon: Users, color: "text-blue-500", bg: "bg-blue-50" },
  ];

  const adminColumns: ColumnDef<any>[] = [
    { accessorKey: "employeeName", header: "Employee" },
    { accessorKey: "checkInTime", header: "Check In", cell: ({ row }) => row.original.checkInTime ? format(new Date(row.original.checkInTime), 'hh:mm a') : 'N/A' },
    { accessorKey: "checkOutTime", header: "Check Out", cell: ({ row }) => row.original.checkOutTime ? format(new Date(row.original.checkOutTime), 'hh:mm a') : 'N/A' },
    { 
      accessorKey: "status", 
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        const variants: Record<string, string> = {
          present: "bg-emerald-100 text-emerald-700",
          absent: "bg-rose-100 text-rose-700",
          halfday: "bg-orange-100 text-orange-700",
          'on leave': "bg-amber-100 text-amber-700"
        };
        return <Badge className={cn("capitalize border-0", variants[status] || "bg-slate-100")}>{status}</Badge>;
      }
    }
  ];

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen bg-slate-50/50">
        <header className="bg-[#0f172a] text-white py-12 px-8">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Clock className="h-6 w-6 text-emerald-400" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Attendance Management</h1>
              </div>
              <p className="text-slate-400">Monitor team presence and productivity with real-time insights</p>
            </div>
            <div className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <div className="text-right">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Today's Status</p>
                <p className="text-lg font-semibold">{todayRecord ? "Checked In" : "Not Checked In"}</p>
              </div>
              <CheckButton />
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl mx-auto w-full p-8 space-y-8">
          <Tabs defaultValue="my-attendance" className="w-full">
            <div className="bg-white p-1 rounded-xl border shadow-sm inline-flex mb-8">
              <TabsList className="bg-transparent border-0 h-10">
                <TabsTrigger value="my-attendance" className="data-[state=active]:bg-slate-100 data-[state=active]:shadow-none px-6">
                  <UserCheck className="h-4 w-4 mr-2" />
                  My Attendance
                </TabsTrigger>
                {['admin', 'hr', 'manager'].includes(user?.role || '') && (
                  <TabsTrigger value="team-overview" className="data-[state=active]:bg-slate-100 data-[state=active]:shadow-none px-6">
                    <Users className="h-4 w-4 mr-2" />
                    Team Overview
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <TabsContent value="my-attendance" className="space-y-8 mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                  <Card key={i} className="border-none shadow-sm hover-elevate overflow-visible">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className={cn("p-3 rounded-xl", stat.bg)}>
                        <stat.icon className={cn("h-6 w-6", stat.color)} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                        <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 border-none shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5 text-blue-500" />
                        Attendance Calendar
                      </CardTitle>
                      <p className="text-sm text-slate-500 mt-1">View your attendance history and patterns</p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-semibold text-lg">{format(currentMonth, 'MMMM yyyy')}</h3>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-lg overflow-hidden border">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="bg-slate-50 p-2 text-center text-xs font-bold text-slate-500 uppercase">{d}</div>
                      ))}
                      {eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }).map((date, i) => {
                        const status = getDayStatus(date, myAttendance);
                        const isSelected = isSameDay(date, selectedDate);
                        return (
                          <div 
                            key={i} 
                            className={cn(
                              "bg-white h-20 p-2 relative cursor-pointer hover:bg-slate-50 transition-colors",
                              isSelected && "ring-2 ring-blue-500 ring-inset z-10"
                            )}
                            onClick={() => setSelectedDate(date)}
                          >
                            <span className={cn("text-sm font-medium", !isSameDay(date, currentMonth) && "text-slate-300")}>
                              {format(date, 'd')}
                            </span>
                            {status !== 'upcoming' && (
                              <div className={cn(
                                "absolute bottom-2 left-2 right-2 h-1.5 rounded-full",
                                status === 'present' ? "bg-emerald-500" :
                                status === 'halfday' ? "bg-orange-500" :
                                status === 'on leave' ? "bg-amber-500" : "bg-rose-500"
                              )} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="h-5 w-5 text-emerald-500" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      {myAttendance.slice(0, 5).map((record, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-2 h-2 rounded-full", record.status === 'present' ? "bg-emerald-500" : "bg-rose-500")} />
                          <div>
                            <p className="text-sm font-semibold">{record.date ? format(new Date(record.date), 'MMM dd, yyyy') : 'N/A'}</p>
                            <p className="text-xs text-slate-500">{record.checkInTime ? format(new Date(record.checkInTime), 'hh:mm a') : 'No record'}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="capitalize text-[10px] h-5">{record.status}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="lg:col-span-3 border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <History className="h-5 w-5 text-indigo-500" />
                      Complete Attendance History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DataTable 
                      columns={[
                        { accessorKey: "date", header: "Date", cell: ({ row }) => row.original.date ? format(new Date(row.original.date), 'MMM dd, yyyy') : 'N/A' },
                        { accessorKey: "checkInTime", header: "Check In", cell: ({ row }) => row.original.checkInTime ? format(new Date(row.original.checkInTime), 'hh:mm a') : 'N/A' },
                        { accessorKey: "checkOutTime", header: "Check Out", cell: ({ row }) => row.original.checkOutTime ? format(new Date(row.original.checkOutTime), 'hh:mm a') : 'N/A' },
                        { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge className="capitalize">{row.original.status}</Badge> }
                      ]} 
                      data={myAttendance} 
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="team-overview" className="space-y-8 mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {teamStats.map((stat, i) => (
                  <Card key={i} className="border-none shadow-sm hover-elevate overflow-visible">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className={cn("p-3 rounded-xl", stat.bg)}>
                        <stat.icon className={cn("h-6 w-6", stat.color)} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                        <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Select Date</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Select defaultValue={format(selectedDate, 'MMMM')}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select defaultValue="2026">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="2026">2026</SelectItem></SelectContent>
                      </Select>
                    </div>
                    {/* Minimal calendar for date selection could go here */}
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2 border-none shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{format(selectedDate, 'EEEE, MMMM dd, yyyy')}</CardTitle>
                      <p className="text-sm text-slate-500">Attendance overview for selected date</p>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded-lg">
                      <Activity className="h-5 w-5 text-emerald-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Attendance Rate</p>
                        <p className="text-4xl font-black text-emerald-500">
                          {Math.round((allEmployeeAttendanceData.filter(d => d.status === 'present').length / employees.length) * 100) || 0}%
                        </p>
                      </div>
                      <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Checked In</p>
                        <p className="text-4xl font-black text-blue-500">
                          {allEmployeeAttendanceData.filter(d => d.status === 'present').length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-3 border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-500" />
                      Team Attendance Records
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DataTable columns={adminColumns} data={allEmployeeAttendanceData} searchKey="employeeName" />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </AppLayout>
  );
}
