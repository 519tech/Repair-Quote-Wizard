import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, FileText, Mail, Phone } from "lucide-react";

type Submission = {
  id: string;
  type: 'quote' | 'unknown';
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  deviceName?: string;
  serviceName?: string;
  quotedPrice?: string;
  deviceDescription?: string;
  issueDescription?: string;
  notes?: string | null;
  createdAt: string;
};

export function SubmissionsTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: submissions = [], isLoading } = useQuery<Submission[]>({
    queryKey: ["/api/submissions/search", debouncedQuery],
    queryFn: async () => {
      const url = debouncedQuery 
        ? `/api/submissions/search?q=${encodeURIComponent(debouncedQuery)}`
        : `/api/submissions/search`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch submissions');
      return res.json();
    },
  });

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Past Submissions
        </CardTitle>
        <CardDescription>View and search past quote submissions by name, email, or phone number</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-submissions-search"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? "No submissions found matching your search." : "No submissions yet."}
          </div>
        ) : (
          <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
            {submissions.map((submission) => (
              <div key={submission.id} className="p-3 hover-elevate">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{submission.customerName}</span>
                      <Badge variant={submission.type === 'quote' ? 'default' : 'secondary'} className="text-xs">
                        {submission.type === 'quote' ? 'Quote' : 'Unknown Device'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        <span>{submission.customerEmail}</span>
                      </div>
                      {submission.customerPhone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          <span>{submission.customerPhone}</span>
                        </div>
                      )}
                    </div>
                    {submission.type === 'quote' ? (
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">Device:</span> {submission.deviceName}
                        <span className="mx-2">·</span>
                        <span className="text-muted-foreground">Service:</span> {submission.serviceName}
                        <span className="mx-2">·</span>
                        <span className="font-medium text-primary">${submission.quotedPrice}</span>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm">
                        <div><span className="text-muted-foreground">Device:</span> {submission.deviceDescription}</div>
                        <div><span className="text-muted-foreground">Issue:</span> {submission.issueDescription}</div>
                      </div>
                    )}
                    {submission.notes && (
                      <div className="mt-1 text-xs text-muted-foreground italic">
                        Notes: {submission.notes}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(submission.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {submissions.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Showing {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
