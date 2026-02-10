import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Gift, FileSpreadsheet } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import * as XLSX from 'xlsx';
import { useToast } from "@/hooks/use-toast";

export default function BonusReportsPage() {
  const { toast } = useToast();
  const { data: employees = [] } = useQuery<User[]>({ queryKey: ["/api/employees"] });

  const bonusData = employees
    .filter(emp => emp.isActive && emp.salary && emp.salary > 0)
    .map(emp => {
      const basicSalary = Math.round((emp.salary! / 12) * 0.5);
      const bonusEligibleSalary = Math.min(basicSalary, 7000);
      const bonusAmount = Math.round((bonusEligibleSalary * 8.33 / 100) * 12);
      return {
        employeeId: emp.employeeId,
        name: `${emp.firstName} ${emp.lastName}`,
        designation: emp.position,
        annualBonus: bonusAmount
      };
    });

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(bonusData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bonus Data");
    XLSX.writeFile(wb, "Bonus_Report.xlsx");
    toast({ title: "Bonus Report Exported", description: "Excel file generated." });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Bonus Reports</h1>
            <p className="text-slate-500 mt-1">Generate and view employee bonus details</p>
          </div>
          <Button className="gap-2" onClick={exportToExcel}><FileSpreadsheet className="h-4 w-4" />Export Excel</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bonus Calculations</CardTitle>
            <CardDescription>Annual statutory bonus summary</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-slate-600">Emp ID</th>
                    <th className="text-left py-3 px-4 text-slate-600">Employee Name</th>
                    <th className="text-left py-3 px-4 text-slate-600">Designation</th>
                    <th className="text-left py-3 px-4 text-slate-600">Annual Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {bonusData.map((row, index) => (
                    <tr key={index} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4">{row.employeeId}</td>
                      <td className="py-3 px-4 font-medium">{row.name}</td>
                      <td className="py-3 px-4">{row.designation}</td>
                      <td className="py-3 px-4 font-medium text-teal-600">₹{row.annualBonus.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}