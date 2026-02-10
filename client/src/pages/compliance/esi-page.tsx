import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Upload, Building2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addCompanyHeader, addWatermark, addHRSignature, addFooter, addDocumentDate, generateReferenceNumber, addReferenceNumber } from "@/lib/pdf-utils";
import { User } from "@shared/schema";

export default function EsiPage() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  
  const { data: employees = [] } = useQuery<User[]>({ queryKey: ["/api/employees"] });
  
  const esiData = useMemo(() => {
    return employees
      .filter(emp => emp.isActive && emp.salary && emp.salary > 0 && (emp.salary / 12) <= 21000)
      .map(emp => {
        const grossSalary = Math.round(emp.salary! / 12);
        const employeeContrib = Math.round(grossSalary * 0.0075);
        const employerContrib = Math.round(grossSalary * 0.0325);
        return {
          employee: `${emp.firstName} ${emp.lastName}`,
          grossSalary,
          employeeContrib,
          employerContrib,
          total: employeeContrib + employerContrib
        };
      });
  }, [employees]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadedFile(file);
  };

  const handleChallanUpload = async () => {
    if (!uploadedFile) return;
    setUploading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast({ title: "Challan Uploaded Successfully", description: `${uploadedFile.name} processed.` });
    setUploading(false);
    setUploadedFile(null);
    setUploadDialogOpen(false);
  };

  const generateReport = () => {
    const doc = new jsPDF();
    addWatermark(doc);
    addCompanyHeader(doc, { title: "ESI COMPLIANCE REPORT", subtitle: "Monthly Contributions Summary" });
    addFooter(doc);
    const refNumber = generateReferenceNumber("ESI");
    addReferenceNumber(doc, refNumber, 68);
    addDocumentDate(doc, undefined, 68);
    
    autoTable(doc, {
      startY: 80,
      head: [['Employee', 'Gross Salary', 'Employee (0.75%)', 'Employer (3.25%)', 'Total']],
      body: esiData.map(row => [
        row.employee,
        `Rs. ${row.grossSalary.toLocaleString()}`,
        `Rs. ${row.employeeContrib.toLocaleString()}`,
        `Rs. ${row.employerContrib.toLocaleString()}`,
        `Rs. ${row.total.toLocaleString()}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [0, 98, 179] },
    });
    
    addHRSignature(doc, (doc as any).lastAutoTable.finalY + 20);
    doc.save('esi-report.pdf');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Employees' State Insurance (ESI)</h1>
            <p className="text-slate-500 mt-1">Manage ESI contributions and reports</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2"><Upload className="h-4 w-4" />Upload Challan</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Upload ESI Challan</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="challan-file">Select Challan File</Label>
                    <Input id="challan-file" type="file" onChange={handleFileUpload} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleChallanUpload} disabled={uploading || !uploadedFile}>
                      {uploading ? "Uploading..." : "Upload"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button className="gap-2" onClick={generateReport}><Download className="h-4 w-4" />Generate Report</Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ESI Contributions</CardTitle>
            <CardDescription>Monthly statutory ESI details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-slate-600">Employee</th>
                    <th className="text-left py-3 px-4 text-slate-600">Gross Salary</th>
                    <th className="text-left py-3 px-4 text-slate-600">Employee (0.75%)</th>
                    <th className="text-left py-3 px-4 text-slate-600">Employer (3.25%)</th>
                    <th className="text-left py-3 px-4 text-slate-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {esiData.map((row, index) => (
                    <tr key={index} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium">{row.employee}</td>
                      <td className="py-3 px-4">₹{row.grossSalary.toLocaleString()}</td>
                      <td className="py-3 px-4">₹{row.employeeContrib.toLocaleString()}</td>
                      <td className="py-3 px-4">₹{row.employerContrib.toLocaleString()}</td>
                      <td className="py-3 px-4 font-medium text-teal-600">₹{row.total.toLocaleString()}</td>
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