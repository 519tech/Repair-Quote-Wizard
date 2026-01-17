import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Link, X, Loader2 } from "lucide-react";

interface ImageInputProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  placeholder?: string;
  testIdPrefix?: string;
}

export function ImageInput({ 
  value, 
  onChange, 
  label = "Image",
  placeholder = "Enter image URL or upload a file",
  testIdPrefix = "image"
}: ImageInputProps) {
  const [mode, setMode] = useState<"url" | "upload">("url");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadURL, objectPath } = await response.json();

      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });

      onChange(objectPath);
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const clearImage = () => {
    onChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getDisplayUrl = (url: string) => {
    if (url.startsWith("/objects/")) {
      return url;
    }
    return url;
  };

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      
      <div className="flex gap-2 mb-2">
        <Button
          type="button"
          variant={mode === "url" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("url")}
          data-testid={`${testIdPrefix}-mode-url`}
        >
          <Link className="h-4 w-4 mr-1" />
          URL
        </Button>
        <Button
          type="button"
          variant={mode === "upload" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("upload")}
          data-testid={`${testIdPrefix}-mode-upload`}
        >
          <Upload className="h-4 w-4 mr-1" />
          Upload
        </Button>
      </div>

      {mode === "url" ? (
        <Input
          value={value.startsWith("/objects/") ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          data-testid={`${testIdPrefix}-url-input`}
        />
      ) : (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            data-testid={`${testIdPrefix}-file-input`}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            data-testid={`${testIdPrefix}-upload-button`}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </>
            )}
          </Button>
        </div>
      )}

      {value && (
        <div className="relative mt-2 rounded-md border bg-muted/20 p-2">
          <div className="flex items-center gap-2">
            <img
              src={getDisplayUrl(value)}
              alt="Preview"
              className="h-16 w-16 object-contain rounded-md bg-background"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground truncate">{value}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={clearImage}
              data-testid={`${testIdPrefix}-clear`}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
