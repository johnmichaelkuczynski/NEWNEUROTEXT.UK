import * as React from "react"
import { cn } from "@/lib/utils"

export interface FileInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onFileSelected?: (file: File) => void;
  onFilesSelected?: (files: File[]) => void;
}

const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, onFileSelected, onFilesSelected, onChange, ...props }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) onChange(event);
      
      const files = event.target.files;
      if (files && files.length > 0) {
        if (onFilesSelected) {
          onFilesSelected(Array.from(files));
        } else if (onFileSelected) {
          onFileSelected(files[0]);
        }
      }
    };

    return (
      <input
        type="file"
        className={cn(
          "hidden",
          className
        )}
        ref={ref}
        onChange={handleChange}
        {...props}
      />
    )
  }
)
FileInput.displayName = "FileInput"

export { FileInput }
