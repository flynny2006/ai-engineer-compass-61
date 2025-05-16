
import React, { useState, useRef } from 'react';
import { Download, File, FolderOpen, Trash, Plus, Edit, Save, FileText, Code, FileJson, FilePen, Upload, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import JSZip from 'jszip';

// Define a proper interface that matches what useProjectFiles returns
interface FileExplorerProps {
  files: {
    name: string;
    content: string | ArrayBuffer;
    type: string;
  }[];
  setFiles: React.Dispatch<React.SetStateAction<{
    name: string;
    content: string | ArrayBuffer;
    type: string;
  }[]>>;
  currentFile: string;
  setCurrentFile: React.SetStateAction<any>;
}

const FileExplorerEnhanced: React.FC<FileExplorerProps> = ({
  files,
  setFiles,
  currentFile,
  setCurrentFile
}) => {
  const [newFileName, setNewFileName] = useState<string>('');
  const [isAddingFile, setIsAddingFile] = useState<boolean>(false);
  const [isRenamingFile, setIsRenamingFile] = useState<boolean>(false);
  const [fileToRename, setFileToRename] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.html')) return <Code className="h-4 w-4 text-orange-500" />;
    if (fileName.endsWith('.css')) return <Code className="h-4 w-4 text-blue-500" />;
    if (fileName.endsWith('.js')) return <Code className="h-4 w-4 text-yellow-500" />;
    if (fileName.endsWith('.json')) return <FileJson className="h-4 w-4 text-green-500" />;
    if (fileName.endsWith('.md')) return <FilePen className="h-4 w-4 text-purple-500" />;
    if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].some(ext => fileName.toLowerCase().endsWith(ext))) 
      return <Image className="h-4 w-4 text-pink-500" />;
    return <FileText className="h-4 w-4" />;
  };

  const addNewFile = () => {
    if (!newFileName) {
      toast({
        title: "Error",
        description: "Please enter a file name",
        variant: "destructive"
      });
      return;
    }

    // Check if file name already exists
    if (files.some(file => file.name === newFileName)) {
      toast({
        title: "Error",
        description: "File already exists",
        variant: "destructive"
      });
      return;
    }

    // Get file extension
    const fileExt = newFileName.split('.').pop() || "";
    let fileType = "text";
    let defaultContent = "";

    // Set default content based on file type
    if (fileExt === 'html') {
      fileType = 'html';
      defaultContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Page</title>
</head>
<body>
  <h1>Hello World</h1>
</body>
</html>`;
    } else if (fileExt === 'css') {
      fileType = 'css';
      defaultContent = '/* Add your CSS styles here */';
    } else if (fileExt === 'js') {
      fileType = 'js';
      defaultContent = '// Add your JavaScript code here';
    } else if (fileExt === 'json') {
      fileType = 'json';
      defaultContent = '{\n  "name": "my-project"\n}';
    } else if (fileExt === 'md') {
      fileType = 'md';
      defaultContent = '# New Document\n\nAdd your content here.';
    } else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(fileExt.toLowerCase())) {
      fileType = 'binary';
      defaultContent = ''; // Binary content will be handled separately
    }

    const newFile = {
      name: newFileName,
      content: defaultContent,
      type: fileType
    };

    setFiles([...files, newFile]);
    setCurrentFile(newFileName);
    setNewFileName('');
    setIsAddingFile(false);

    toast({
      title: "File Created",
      description: `${newFileName} has been created`
    });
  };

  const deleteFile = (fileName: string) => {
    // Don't allow deletion of README.md
    if (fileName === "README.md") {
      toast({
        title: "Cannot Delete README",
        description: "The README.md file cannot be deleted",
        variant: "destructive"
      });
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete ${fileName}?`)) {
      const updatedFiles = files.filter(file => file.name !== fileName);
      setFiles(updatedFiles);
      
      // If we're deleting the current file, switch to index.html or the first available file
      if (currentFile === fileName) {
        const indexFile = updatedFiles.find(file => file.name === 'index.html');
        setCurrentFile(indexFile ? indexFile.name : (updatedFiles[0]?.name || ''));
      }

      toast({
        title: "File Deleted",
        description: `${fileName} has been deleted`
      });
    }
  };

  const renameFile = () => {
    // Don't allow renaming of README.md
    if (fileToRename === "README.md") {
      toast({
        title: "Cannot Rename README",
        description: "The README.md file cannot be renamed",
        variant: "destructive"
      });
      return;
    }
    
    if (!newName) {
      toast({
        title: "Error",
        description: "Please enter a file name",
        variant: "destructive"
      });
      return;
    }

    // Check if file name already exists
    if (files.some(file => file.name === newName)) {
      toast({
        title: "Error",
        description: "File already exists",
        variant: "destructive"
      });
      return;
    }

    const updatedFiles = files.map(file => {
      if (file.name === fileToRename) {
        return {
          ...file,
          name: newName
        };
      }
      return file;
    });

    setFiles(updatedFiles);
    
    // If we're renaming the current file, update currentFile
    if (currentFile === fileToRename) {
      setCurrentFile(newName);
    }

    setIsRenamingFile(false);
    setFileToRename('');
    setNewName('');

    toast({
      title: "File Renamed",
      description: `${fileToRename} has been renamed to ${newName}`
    });
  };

  // Download a single file
  const downloadFile = (file: { name: string; content: string | ArrayBuffer }) => {
    // Create a string version of content if it's an ArrayBuffer
    const contentString = typeof file.content === 'string' 
      ? file.content 
      : new TextDecoder().decode(file.content);
      
    const blob = new Blob([contentString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "File Downloaded",
      description: `${file.name} has been downloaded`
    });
  };

  // Download all files as ZIP
  const downloadAllFiles = () => {
    const zip = new JSZip();
    
    files.forEach(file => {
      zip.file(file.name, file.content);
    });
    
    zip.generateAsync({ type: "blob" }).then(content => {
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = "boongle-ai-project.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Your Download Has Been Started!",
        description: "Thanks for using Boongle AI!"
      });
    });
  };

  // Handle file upload trigger
  const triggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    Array.from(uploadedFiles).forEach(uploadedFile => {
      const fileName = uploadedFile.name;
      
      // Check if file already exists
      if (files.some(file => file.name === fileName)) {
        toast({
          title: "Error",
          description: `File ${fileName} already exists`,
          variant: "destructive"
        });
        return;
      }

      const fileReader = new FileReader();
      
      if (uploadedFile.type.startsWith('image/') || 
          uploadedFile.type === 'application/pdf' || 
          uploadedFile.name.endsWith('.svg')) {
        // For binary files (images, PDFs, etc.)
        fileReader.readAsDataURL(uploadedFile);
        fileReader.onload = () => {
          const content = fileReader.result as string;
          const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
          
          let fileType = 'binary';
          if (uploadedFile.type.startsWith('image/')) {
            fileType = 'image';
          } else if (uploadedFile.type === 'application/pdf') {
            fileType = 'pdf';
          }

          const newFile = {
            name: fileName,
            content: content,
            type: fileType
          };
          
          setFiles(prev => [...prev, newFile]);
          
          toast({
            title: "File Uploaded",
            description: `${fileName} has been uploaded successfully`
          });
        };
      } else {
        // For text files
        fileReader.readAsText(uploadedFile);
        fileReader.onload = () => {
          const content = fileReader.result as string;
          const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
          
          let fileType = 'text';
          if (fileExt === 'html') fileType = 'html';
          else if (fileExt === 'css') fileType = 'css';
          else if (fileExt === 'js') fileType = 'js';
          else if (fileExt === 'json') fileType = 'json';
          else if (fileExt === 'md') fileType = 'md';

          const newFile = {
            name: fileName,
            content,
            type: fileType
          };
          
          setFiles(prev => [...prev, newFile]);
          
          toast({
            title: "File Uploaded",
            description: `${fileName} has been uploaded successfully`
          });
        };
      }

      fileReader.onerror = () => {
        toast({
          title: "Error",
          description: `Failed to upload ${fileName}`,
          variant: "destructive"
        });
      };
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsUploadDialogOpen(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b flex justify-between items-center bg-muted">
        <h3 className="font-medium">Files</h3>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setIsAddingFile(true)}
            title="Create new file"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setIsUploadDialogOpen(true)}
            title="Upload files"
          >
            <Upload className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={downloadAllFiles}
            title="Download Project"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-auto flex-1 p-2">
        <ul className="space-y-1">
          {files.map((file) => (
            <li 
              key={file.name} 
              className={cn(
                "flex items-center justify-between p-2 rounded-md cursor-pointer",
                currentFile === file.name ? "bg-accent" : "hover:bg-muted"
              )}
              onClick={() => setCurrentFile(file.name)}
            >
              <div className="flex items-center space-x-2 overflow-hidden">
                {getFileIcon(file.name)}
                <span className="truncate">{file.name}</span>
              </div>
              <div className="flex space-x-1">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadFile(file);
                  }}
                >
                  <Download className="h-3 w-3" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFileToRename(file.name);
                    setNewName(file.name);
                    setIsRenamingFile(true);
                  }}
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFile(file.name);
                  }}
                >
                  <Trash className="h-3 w-3" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-3 border-t mt-auto flex justify-between items-center bg-muted">
        <div className="text-xs text-muted-foreground">
          {files.length} file{files.length !== 1 ? 's' : ''} in project
        </div>
        <Button 
          size="sm" 
          onClick={downloadAllFiles}
        >
          <Download className="h-4 w-4 mr-2" /> Download Project
        </Button>
      </div>

      {/* Add File Dialog */}
      <Dialog open={isAddingFile} onOpenChange={setIsAddingFile}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium">File Name</label>
              <Input
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="e.g. about.html"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingFile(false)}>Cancel</Button>
            <Button onClick={addNewFile}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename File Dialog */}
      <Dialog open={isRenamingFile} onOpenChange={setIsRenamingFile}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium">New Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenamingFile(false)}>Cancel</Button>
            <Button onClick={renameFile}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload File Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-6 flex flex-col items-center justify-center">
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              multiple
              accept="image/*,text/*,application/json,.html,.css,.js,.md,.svg"
            />
            <Button 
              variant="outline" 
              className="w-full h-32 border-dashed flex flex-col gap-2"
              onClick={triggerFileUpload}
            >
              <Upload className="h-8 w-8 opacity-70" />
              <span>Click to select files</span>
              <span className="text-xs text-muted-foreground">
                Supports images, html, css, js, and more
              </span>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FileExplorerEnhanced;
