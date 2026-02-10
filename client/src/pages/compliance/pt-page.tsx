import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Upload, Calculator } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addCompanyHeader, addWatermark, addHRSignature, addFooter, addDocumentDate, generateReferenceNumber, addReferenceNumber } from "@/lib/pdf-utils";
import { User } from "@shared/schema";

export default function PtPage() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  
  const { data: employees = [] } = useQuery<User[]>({ queryKey: ["/api/employees"] });
  
  const ptData = useMemo(() => {
    return employees
      .filter(emp => emp.isActive && emp.salary && emp.salary > 0)
      .map(emp => {
        const grossSalary = Math.round(emp.salary! / 12);
        let ptAmount = 200;
        if (grossSalary < 10000) ptAmount = 0;
        else if (grossSalary < 15000) ptAmount = 150;
        else if (grossSalary < 25000) ptAmount = 175;
        return {
          employee: `${emp.firstName} ${emp.lastName}`,
          grossSalary,
          ptAmount,
          state: "Maharashtra"
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
    addCompanyHeader(doc, { title: "PROFESSIONAL TAX REPORT", subtitle: "Monthly Collection Summary" });
    addFooter(doc);
    const refNumber = generateReferenceNumber("PT");
    addReferenceNumber(doc, refNumber, 68);
    addDocumentDate(doc, undefined, 68);
    
    autoTable(doc, {
      startY: 80,
      head: [['Employee', 'Gross Salary', 'State', 'PT Amount']],
      body: ptData.map(row => [
        row.employee,
        `Rs. ${row.grossSalary.toLocaleString()}`,
        row.state,
        `Rs. ${row.ptAmount.toLocaleString()}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [128, 0, 128] },
    });
    
    addHRSignature(doc, (doc as any).lastAutoTable.finalY + 20);
    doc.save('professional-tax-report.pdf');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Professional Tax</h1>
            <p className="text-slate-500 mt-1">Manage state-wise Professional Tax</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2"><Upload className="h-4 w-4" />Upload Challan</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Upload PT Challan</DialogTitle></DialogHeader>
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
            <CardTitle>PT Collection</CardTitle>
            <CardDescription>Monthly state-wise PT details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-slate-600">Employee</th>
                    <th className="text-left py-3 px-4 text-slate-600">Gross Salary</th>
                    <th className="text-left py-3 px-4 text-slate-600">State</th>
                    <th className="text-left py-3 px-4 text-slate-600">PT Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {ptData.map((row, index) => (
                    <tr key={index} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium">{row.employee}</td>
                      <td className="py-3 px-4">₹{row.grossSalary.toLocaleString()}</td>
                      <td className="py-3 px-4">{row.state}</td>
                      <td className="py-3 px-4 font-medium text-teal-600">₹{row.ptAmount.toLocaleString()}</td>
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