import React, { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Code, Send, Play, Eye, MessageSquare, Sun, Moon, Save, Trash, Maximize, RefreshCcw, ChevronDown, FileText, Gift, Settings, Database, Plus, Image, Menu, Info } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useIsMobile } from "@/hooks/use-mobile";
import { Toggle } from "@/components/ui/toggle";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import FileExplorer from "@/components/FileExplorer";
import CodeEditor from "@/components/CodeEditor";
import PreviewSettings from "@/components/PreviewSettings";
import { packageJsonContent } from "@/data/packageJson";
import Navigation from "@/components/Navigation";
import { Link } from "react-router-dom";
import FileExplorerEnhanced from '@/components/FileExplorerEnhanced';
import FileExplorerUpload from '@/components/FileExplorerUpload';
import { useProjectFiles } from "@/hooks/use-project-files";

const DEFAULT_CODE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
    }
    p {
      line-height: 1.5;
      color: #555;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>The Preview hasn't been built yet.</h1>
    <p>Ask our AI Assistant to build something to see the app here! Or Edit the Code yourself.</p>
  </div>
</body>
</html>`;

// Define initial files structure
const initialFiles = [{
  name: "index.html",
  content: DEFAULT_CODE,
  type: "html"
}, {
  name: "styles.css",
  content: "/* Add your CSS styles here */",
  type: "css"
}, {
  name: "script.js",
  content: "// Add your JavaScript code here",
  type: "js"
}, {
  name: "package.json",
  content: packageJsonContent,
  type: "json"
}];
const initialMessages = [{
  role: "assistant",
  content: "Welcome! I'm your AI coding assistant. Describe the changes you'd like to make to the code and I'll help implement them."
}];
const DAILY_CREDIT_LIMIT = 25;
const UNLIMITED_CODE = "3636";
const CREDIT_CODES = {
  "56722": 100,
  "757874": 500,
  "776561": 1600
  // More can be added here in the future
};
const Index = () => {
  const {
    theme,
    setTheme
  } = useTheme();
  const isMobile = useIsMobile();
  
  // Use the enhanced useProjectFiles hook
  const {
    files, 
    setFiles,
    currentFile, 
    setCurrentFile,
    mainPreviewFile, 
    setMainPreviewFile,
    updateFileContent,
    getCurrentProjectId,
    getStorageKey,
    getContentAsString
  } = useProjectFiles(initialFiles);
  
  const [userPrompt, setUserPrompt] = useState<string>("");
  const [messages, setMessages] = useState<Array<{
    role: string;
    content: string;
    image?: string;
  }>>(initialMessages);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem("gemini_api_key") || "";
  });
  const [showApiKeyInput, setShowApiKeyInput] = useState<boolean>(() => !localStorage.getItem("gemini_api_key"));
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [editorView, setEditorView] = useState<"code" | "files">("code");
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());
  const [imageUpload, setImageUpload] = useState<File | null>(null);
  const [showImageUpload, setShowImageUpload] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [buildError, setBuildError] = useState<boolean>(false);

  // Load chat messages from localStorage when component mounts or project ID changes
  useEffect(() => {
    const projectId = getCurrentProjectId();
    if (!projectId) return;
    
    try {
      const chatKey = getStorageKey("chat_history");
      const savedMessages = localStorage.getItem(chatKey);
      
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      } else {
        setMessages(initialMessages);
        // Save initial messages to project-specific storage
        localStorage.setItem(chatKey, JSON.stringify(initialMessages));
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
      setMessages(initialMessages);
    }
  }, [getCurrentProjectId, getStorageKey]);

  // Credits system
  const [dailyCredits, setDailyCredits] = useState<number>(() => {
    const savedCredits = localStorage.getItem("daily_credits");
    if (savedCredits) {
      const {
        value,
        lastReset
      } = JSON.parse(savedCredits);

      // Check if we need to reset credits (new day)
      const today = new Date().setHours(0, 0, 0, 0);
      const lastResetDate = new Date(lastReset).setHours(0, 0, 0, 0);
      if (today > lastResetDate) {
        return DAILY_CREDIT_LIMIT;
      }
      return value;
    }
    return DAILY_CREDIT_LIMIT;
  });

  // New lifetime credits system
  const [lifetimeCredits, setLifetimeCredits] = useState<number>(() => {
    return parseInt(localStorage.getItem("lifetime_credits") || "0", 10);
  });
  const [hasUnlimitedCredits, setHasUnlimitedCredits] = useState<boolean>(() => {
    return localStorage.getItem("unlimited_credits") === "true";
  });
  const [claimCode, setClaimCode] = useState<string>("");
  const [showClaimDialog, setShowClaimDialog] = useState<boolean>(false);

  // Combined credits
  const totalAvailableCredits = dailyCredits + lifetimeCredits;

  // Get current file content and language
  const getCurrentFileContent = () => {
    const file = files.find(f => f.name === currentFile);
    return file ? (typeof file.content === 'string' ? file.content : '') : "";
  };
  const getCurrentFileLanguage = () => {
    if (currentFile.endsWith('.html')) return 'html';
    if (currentFile.endsWith('.css')) return 'css';
    if (currentFile.endsWith('.js')) return 'js';
    if (currentFile.endsWith('.ts') || currentFile.endsWith('.tsx')) return 'ts';
    if (currentFile.endsWith('.json')) return 'json';
    return 'text';
  };

  // Check for code errors like triple backticks
  const checkForCodeErrors = (content: string) => {
    // Check if content ends with backticks or contains double backticks
    const endsWithBackticks = content.trim().endsWith('```');
    const containsDoubleBackticks = content.includes('``````');
    if (endsWithBackticks || containsDoubleBackticks) {
      setBuildError(true);
    } else {
      setBuildError(false);
    }
  };

  // Fix code errors
  const handleFixCodeErrors = () => {
    setUserPrompt("Fix the code syntax. It appears to contain markdown backticks (```) that should be removed.");
    handleSubmit(new Event('submit') as unknown as React.FormEvent);
    setBuildError(false);
  };

  // Save credits to localStorage
  useEffect(() => {
    const creditsData = {
      value: dailyCredits,
      lastReset: new Date().toISOString()
    };
    localStorage.setItem("daily_credits", JSON.stringify(creditsData));
  }, [dailyCredits]);

  // Save lifetime credits to localStorage
  useEffect(() => {
    localStorage.setItem("lifetime_credits", lifetimeCredits.toString());
  }, [lifetimeCredits]);

  // Save unlimited credits status
  useEffect(() => {
    if (hasUnlimitedCredits) {
      localStorage.setItem("unlimited_credits", "true");
    }
  }, [hasUnlimitedCredits]);

  // Reset credits at midnight
  useEffect(() => {
    const checkAndResetCredits = () => {
      const savedCredits = localStorage.getItem("daily_credits");
      if (savedCredits) {
        const {
          lastReset
        } = JSON.parse(savedCredits);
        const today = new Date().setHours(0, 0, 0, 0);
        const lastResetDate = new Date(lastReset).setHours(0, 0, 0, 0);
        if (today > lastResetDate) {
          setDailyCredits(DAILY_CREDIT_LIMIT);
        }
      }
    };

    // Set up interval to check credits reset (every minute)
    const interval = setInterval(checkAndResetCredits, 60000);

    // Check on component mount
    checkAndResetCredits();
    return () => clearInterval(interval);
  }, []);

  // Update the preview when files change
  useEffect(() => {
    updatePreview();
  }, [files, currentFile, mainPreviewFile, lastRefreshTime]);

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      const projectId = getCurrentProjectId();
      if (!projectId) return;
      
      const chatKey = getStorageKey("chat_history");
      localStorage.setItem(chatKey, JSON.stringify(messages));
    }
  }, [messages, getCurrentProjectId, getStorageKey]);

  // Scroll to bottom of messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  };
  
  // Enhanced updatePreview function to handle content type safety
  const updatePreview = () => {
    if (previewIframeRef.current) {
      const iframe = previewIframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        const htmlFile = files.find(f => f.name === mainPreviewFile) || files.find(f => f.name === "index.html");
        const cssFile = files.find(f => f.name === "styles.css");
        const jsFile = files.find(f => f.name === "script.js");

        // Convert content to string safely
        let htmlContent = htmlFile ? getContentAsString(htmlFile.content) : DEFAULT_CODE;
        const cssContent = cssFile ? getContentAsString(cssFile.content) : "";
        const jsContent = jsFile ? getContentAsString(jsFile.content) : "";

        // Ensure the HTML structure is complete and add style/script tags if needed
        if (htmlContent && !htmlContent.includes('</head>') && cssContent) {
          // If there's no head tag, we need to add one with the styles
          htmlContent = htmlContent.replace('<html>', '<html>\n<head>\n<style>' + cssContent + '</style>\n</head>');
        } else if (htmlContent && cssContent) {
          // Add styles if there's already a head tag
          htmlContent = htmlContent.replace('</head>', `<style>${cssContent}</style>\n</head>`);
        }

        // Add JavaScript before closing body tag
        if (htmlContent && jsContent) {
          htmlContent = htmlContent.replace('</body>', `<script>${jsContent}</script>\n</body>`);
        }

        // Add navigation listener script to intercept clicks on links
        const navigationScript = `
          <script>
            document.addEventListener('click', function(e) {
              const link = e.target.closest('a');
              if (link && link.href) {
                e.preventDefault();
                const href = link.getAttribute('href');
                if (href && !href.startsWith('http') && !href.startsWith('#')) {
                  window.parent.postMessage({ type: 'navigate', href: href }, '*');
                } else {
                  window.open(link.href, '_blank');
                }
              }
            });
          </script>
        `;

        htmlContent = htmlContent.replace('</body>', `${navigationScript}</body>`);
        
        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();
      }
    }
  };

  // Handle file upload - fixed to convert ArrayBuffer to string
  const handleFileUpload = (uploadedFile: { name: string, content: string | ArrayBuffer, type: string }) => {
    // Create a new file with the uploaded content
    const newFile = {
      name: uploadedFile.name,
      content: uploadedFile.content,
      type: uploadedFile.type
    };
    
    // Check if file already exists
    const existingFileIndex = files.findIndex(f => f.name === uploadedFile.name);
    
    if (existingFileIndex >= 0) {
      // Update existing file
      const updatedFiles = [...files];
      updatedFiles[existingFileIndex] = newFile;
      setFiles(updatedFiles);
    } else {
      // Add new file
      setFiles([...files, newFile]);
    }
    
    // Set as current file
    setCurrentFile(uploadedFile.name);
  };

  // Listen for navigation events from the iframe
  useEffect(() => {
    const handleIframeMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'navigate') {
        const targetFile = event.data.href;
        // Find the file in our files array
        const fileExists = files.some(f => f.name === targetFile);
        
        if (fileExists) {
          // Set as main preview file
          setMainPreviewFile(targetFile);
          toast({
            title: "Navigation",
            description: `Navigated to ${targetFile}`
          });
        } else {
          toast({
            title: "File not found",
            description: `The file ${targetFile} does not exist in your project`,
            variant: "destructive"
          });
        }
      }
    };
    
    window.addEventListener('message', handleIframeMessage);
    return () => {
      window.removeEventListener('message', handleIframeMessage);
    };
  }, [files]);

  // Load initial prompt if available (from homepage)
  useEffect(() => {
    const lastPrompt = localStorage.getItem("last_prompt");
    if (lastPrompt) {
      setUserPrompt(lastPrompt);
      localStorage.removeItem("last_prompt"); // Clear after loading
    }
  }, []);
  
  // Check for initial image upload from homepage
  useEffect(() => {
    const initialImage = localStorage.getItem("initial_image");
    if (initialImage) {
      // Create a file object from the data URL
      const fetchImageFromDataURL = async (dataURL: string) => {
        try {
          const res = await fetch(dataURL);
          const blob = await res.blob();
          const file = new File([blob], "uploaded-image.jpg", { type: "image/jpeg" });
          setImageUpload(file);
          
          // Auto-open image upload dialog
          setShowImageUpload(true);
          
          // Clear the storage after loading
          localStorage.removeItem("initial_image");
        } catch (error) {
          console.error("Error loading initial image:", error);
        }
      };
      
      fetchImageFromDataURL(initialImage);
    }
  }, []);
  
  const saveApiKey = () => {
    if (apiKey) {
      localStorage.setItem("gemini_api_key", apiKey);
      setShowApiKeyInput(false);
      toast({
        title: "API Key Saved",
        description: "Your API key has been saved for future sessions."
      });
    }
  };
  const clearChatHistory = () => {
    if (window.confirm("Are you sure you want to clear the chat history?")) {
      setMessages(initialMessages);
      const chatKey = getStorageKey("chat_history");
      localStorage.removeItem(chatKey);
      toast({
        title: "Chat History Cleared",
        description: "Your conversation history has been cleared."
      });
    }
  };
  const resetProject = () => {
    // Store current credits before reset
    const currentDailyCredits = dailyCredits;
    const currentLifetimeCredits = lifetimeCredits;
    const isUnlimited = hasUnlimitedCredits;
    
    // Reset all project-specific data
    setFiles(initialFiles);
    setCurrentFile("index.html");
    setMainPreviewFile("index.html");
    setMessages(initialMessages);
    setEditorView("code");
    
    // Clear project-specific localStorage
    if (getCurrentProjectId()) {
      const projectId = getCurrentProjectId();
      
      // Update project storage with reset state
      localStorage.setItem(getStorageKey("project_files"), JSON.stringify(initialFiles));
      localStorage.setItem(getStorageKey("current_file"), "index.html");
      localStorage.setItem(getStorageKey("main_preview_file"), "index.html");
      localStorage.setItem(getStorageKey("chat_history"), JSON.stringify(initialMessages));
      
      // Update the project in saved_projects
      const savedProjects = localStorage.getItem("saved_projects");
      if (savedProjects) {
        const projects = JSON.parse(savedProjects);
        const updatedProjects = projects.map((project: any) => {
          if (project.id === projectId) {
            return {
              ...project,
              files: initialFiles,
              lastModified: new Date().toISOString()
            };
          }
          return project;
        });
        
        localStorage.setItem("saved_projects", JSON.stringify(updatedProjects));
      }
    }

    // Restore credits after reset
    setDailyCredits(currentDailyCredits);
    setLifetimeCredits(currentLifetimeCredits);
    setHasUnlimitedCredits(isUnlimited);
    
    toast({
      title: "Project Reset",
      description: "Your project has been reset to its default state. Credits were preserved."
    });
    
    setLastRefreshTime(Date.now());
  };
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };
  const handleClaimCode = () => {
    if (claimCode === UNLIMITED_CODE) {
      setHasUnlimitedCredits(true);
      setShowClaimDialog(false);
      toast({
        title: "Unlimited Credits Activated!",
        description: "You now have unlimited credits to use the AI."
      });
    } else if (CREDIT_CODES[claimCode as keyof typeof CREDIT_CODES]) {
      // Add credits to lifetime credits
      const bonusCredits = CREDIT_CODES[claimCode as keyof typeof CREDIT_CODES];
      setLifetimeCredits(prev => prev + bonusCredits);
      setShowClaimDialog(false);
      toast({
        title: "Credits Claimed!",
        description: `You've received ${bonusCredits} lifetime credits that won't expire!`
      });
    } else {
      toast({
        title: "Invalid Code",
        description: "The code you entered is invalid.",
        variant: "destructive"
      });
    }
  };

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        toast({
          title: "File too large",
          description: "Please upload an image smaller than 5MB.",
          variant: "destructive"
        });
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please upload an image file.",
          variant: "destructive"
        });
        return;
      }
      setImageUpload(file);
      setShowImageUpload(true);
    }
  };

  // Convert image file to base64
  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Confirm image upload
  const confirmImageUpload = async () => {
    if (imageUpload) {
      try {
        const base64Image = await convertToBase64(imageUpload);

        // Create a user message with the image
        const userMessage = {
          role: "user",
          content: userPrompt || "Please build a website based on this image",
          image: base64Image
        };
        setMessages(prev => [...prev, userMessage]);
        setUserPrompt("");
        setIsLoading(true);
        setShowImageUpload(false);
        setImageUpload(null);

        // Deduct credit if not unlimited
        if (!hasUnlimitedCredits) {
          if (lifetimeCredits > 0) {
            setLifetimeCredits(prev => prev - 1);
          } else {
            setDailyCredits(prev => prev - 1);
          }
        }
        try {
          // Create enhanced system prompt
          const systemPrompt = `You are an expert web developer AI assistant that helps modify HTML, CSS and JavaScript code.
Current project files:
${files.map(file => `
--- ${file.name} ---
${file.content}
`).join('\n')}

User request: "${userPrompt || "Please build a website based on this image"}"
User has uploaded an image, which you'll see in your input. Please analyze it and build a website based on it.

Previous conversation:
${messages.slice(-5).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Analyze the image and the user's request. Then, respond with the full updated files that incorporates the requested changes.

Follow these rules:
1. Return all files that need to be modified in this format:
--- filename.ext ---
Full file content here

2. Always return the complete content for each file
3. Don't include explanations, just the code files
4. Make sure to include proper links between HTML, CSS, and JS files
5. Don't include markdown formatting or code blocks, just the raw code
6. Be creative and implement visual enhancements when appropriate
7. Follow best practices for HTML, CSS, and JavaScript
8. Make sure your code is clean, organized, and well-documented
9. Implement responsive design elements when possible
10. Consider accessibility in your implementations
11. Create visually appealing color schemes and typography to match the uploaded image
12. Recreate the design from the uploaded image as closely as possible
13. Use the same colors, layout, and style as shown in the image
14. Consider the context and purpose of the image when designing the site
15. If the image contains text, try to incorporate that text into your design
16. If the image shows a UI, recreate that UI in your code
17. Use modern design principles for beautiful interfaces
18. Utilize smooth animations and transitions when appropriate
19. Ensure proper spacing and layout for optimal user experience
20. Implement intuitive navigation and user interaction patterns
21. Apply dynamic hover animations for buttons, links, and interactive elements
22. Use grid or flexbox layouts to ensure structure remains clean and adaptable`;
          const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey
            },
            body: JSON.stringify({
              contents: [{
                role: "user",
                parts: [{
                  text: systemPrompt
                }, {
                  inline_data: {
                    mime_type: imageUpload.type,
                    data: base64Image.split(',')[1]
                  }
                }]
              }],
              generationConfig: {
                temperature: 0.2,
                topP: 0.8,
                topK: 40
              }
            })
          });
          if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
          }
          const data = await response.json();

          // Process response as in regular submission
          if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            // Extract the generated code
            const generatedText = data.candidates[0].content.parts[0].text;

            // Process the response to extract file contents
            const fileMatches = generatedText.match(/---\s+([a-zA-Z0-9_.-]+)\s+---\s+([\s\S]*?)(?=(?:---\s+[a-zA-Z0-9_.-]+\s+---|$))/g);
            if (fileMatches && fileMatches.length > 0) {
              const updatedFiles = [...files];
              const newFiles = [];
              fileMatches.forEach(match => {
                const fileNameMatch = match.match(/---\s+([a-zA-Z0-9_.-]+)\s+---/);
                if (fileNameMatch && fileNameMatch[1]) {
                  const fileName = fileNameMatch[1].trim();
                  let fileContent = match.replace(/---\s+[a-zA-Z0-9_.-]+\s+---/, '').trim();

                  // Get file extension
                  const fileExt = fileName.split('.').pop() || "";

                  // Check if file already exists
                  const existingFileIndex = updatedFiles.findIndex(f => f.name === fileName);
                  if (existingFileIndex >= 0) {
                    // Update existing file
                    updatedFiles[existingFileIndex].content = fileContent;
                  } else {
                    // Add new file
                    newFiles.push({
                      name: fileName,
                      content: fileContent,
                      type: fileExt
                    });
                  }
                }
              });

              // Add new files to the list
              const combinedFiles = [...updatedFiles, ...newFiles];
              setFiles(combinedFiles);

              // Show toast for new files
              if (newFiles.length > 0) {
                toast({
                  title: `Created ${newFiles.length} new file(s)`,
                  description: `Added: ${newFiles.map(f => f.name).join(', ')}`
                });
              }
            } else {
              // If no file structure detected, treat it as changes to the current file
              updateFileContent(generatedText);
            }

            // Add assistant response
            setMessages(prev => [...prev, {
              role: "assistant",
              content: "✅ I've analyzed your image and created a website based on it! Check the preview to see the results."
            }]);
            if (showApiKeyInput) {
              saveApiKey();
            }

            // Update preview
            setLastRefreshTime(Date.now());
          } else {
            throw new Error("Invalid response format from API");
          }
        } catch (error) {
          console.error("Error:", error);
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `❌ Error: ${error instanceof Error ? error.message : "Failed to process request"}`
          }]);
        } finally {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Image conversion error:", error);
        toast({
          title: "Error",
          description: "Failed to process the image. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  // Cancel image upload
  const cancelImageUpload = () => {
    setShowImageUpload(false);
    setImageUpload(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt.trim()) return;
    if (!apiKey && showApiKeyInput) {
      toast({
        title: "API Key Required",
        description: "Please enter your Gemini API key to continue."
      });
      return;
    }

    // Check if user has credits available
    if (totalAvailableCredits <= 0 && !hasUnlimitedCredits) {
      toast({
        title: "Credit Limit Reached",
        description: "You've used all your available credits. Claim codes for more credits or wait until tomorrow for daily credits.",
        variant: "destructive"
      });
      return;
    }
    const userMessage = {
      role: "user",
      content: userPrompt
    };
    setMessages(prev => [...prev, userMessage]);
    setUserPrompt("");
    setIsLoading(true);

    // Deduct credit if not unlimited
    if (!hasUnlimitedCredits) {
      // First use lifetime credits, then daily credits
      if (lifetimeCredits > 0) {
        setLifetimeCredits(prev => prev - 1);
      } else {
        setDailyCredits(prev => prev - 1);
      }
    }
    try {
      // Create enhanced system prompt
      const systemPrompt = `You are an expert web developer AI assistant that helps modify HTML, CSS and JavaScript code.
Current project files:
${files.map(file => `
--- ${file.name} ---
${file.content}
`).join('\n')}

User request: "${userPrompt}"

Previous conversation:
${messages.slice(-5).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Analyze the code and the user's request. Then, respond with the full updated files that incorporates the requested changes.

Follow these rules:
1. Return all files that need to be modified in this format:
--- filename.ext ---
Full file content here

2. Always return the complete content for each file
3. Don't include explanations, just the code files
4. Make sure to include proper links between HTML, CSS, and JS files
5. Don't include markdown formatting or code blocks, just the raw code
6. Be creative and implement visual enhancements when appropriate
7. Follow best practices for HTML, CSS, and JavaScript
8. Make sure your code is clean, organized, and well-documented
9. Implement responsive design elements when possible
10. Consider accessibility in your implementations
11. Use modern design principles for beautiful interfaces
12. Create visually appealing color schemes and typography
13. Utilize smooth animations and transitions when appropriate
14. Ensure proper spacing and layout for optimal user experience
15. Implement intuitive navigation and user interaction patterns
16. Use consistent design language throughout the interface
17. Add appropriate hover states and interactive elements
18. Design with a focus on user experience and usability
19. Consider performance optimizations in your implementations
20. Maintain semantic HTML structure
21. When implementing navigation between pages, create the necessary files and update links accordingly
22. Ensure JavaScript code is properly added and functional
23. Use modern CSS features like flexbox, grid, and custom properties
24. Implement proper error handling in JavaScript code
25. Create stunning visual designs with gradients, shadows, and modern UI elements

# MASSIVE DESIGN CAPABILITIES

## Advanced Visual Systems
- Implement intricate visual hierarchy with 3+ levels of information architecture
- Create complex gradient systems with multiple color stops and directional flows
- Use depth layering with 5+ distinct z-index levels for dimensional richness
- Design with optical illusions and visual tricks for engaging experiences
- Apply advanced color harmony rules including split-complementary and tetradic schemes
- Craft custom shape systems with geometric and organic forms
- Design immersive full-page backgrounds with parallax and movement
- Implement background noise textures and subtle patterns for tactile feel

## Cutting-Edge UI Components
- Create advanced morphing UI elements that transform based on context
- Design data-driven components with dynamic visual representations
- Implement 3D-inspired UI elements with realistic lighting and shadows
- Create image-rich carousels with multi-directional navigation and zoom
- Design interactive timeline components with storytelling capabilities
- Create nested navigation systems with intelligent hierarchies
- Design state-preserving form components with elegant validation
- Implement context-aware tooltips with rich content and interactions
- Create customizable dashboard components with drag-and-drop capabilities
- Design data tables with advanced filtering, sorting, and visualization options

## Layout Mastery
- Create adaptive layouts that morph based on content and context
- Design with asymmetrical balance for visual tension and interest
- Implement content-aware spacing that adjusts to varying content density
- Create interlocking grid systems with overlapping elements
- Design with golden spiral principles for organic composition
- Implement visual rhythm with repeating elements and patterns
- Create modular component systems that fit together like puzzles
- Design with intentional visual breaks to guide attention
- Implement mixed-hierarchy layouts for complex information architecture
- Create magazine-style layouts with irregular grids and dynamic typography

## Motion Excellence
- Design physics-based animations that respond to user input
- Create seamless scene transitions with coordinated element movements
- Implement path-based animations for natural, flowing motion
- Design sequential animations with carefully timed sequences
- Create attention-guiding motion that leads the eye through content
- Implement scroll-driven animations tied to page position
- Design micro-interactions with personality and character
- Create mouse-following elements with smooth, natural movement
- Implement state transitions with meaningful motion patterns
- Design loading states with engaging, informative animations

## Visual Code Techniques
- Use creative clipping paths for unconventional layout shapes
- Implement backdrop-filter effects for depth and glass morphism
- Create custom animated cursors that respond to context
- Design with advanced CSS gradient techniques like conic and repeating gradients
- Implement dynamic dark mode with context-aware color adjustments
- Create animated SVG illustrations with synchronized animations
- Design with CSS custom properties for theme switching and variations
- Implement advanced masking techniques for creative reveals
- Create text effects with gradient fills, strokes, and animations
- Design with variable font animations for dynamic typography`;

      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{
              text: systemPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            topK: 40
          }
        })
      });
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      const data = await response.json();

      // Check if we have valid response data
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        // Extract the generated code
        const generatedText = data.candidates[0].content.parts[0].text;

        // Process the response to extract file contents
        const fileMatches = generatedText.match(/---\s+([a-zA-Z0-9_.-]+)\s+---\s+([\s\S]*?)(?=(?:---\s+[a-zA-Z0-9_.-]+\s+---|$))/g);
        if (fileMatches && fileMatches.length > 0) {
          const updatedFiles = [...files];
          const newFiles = [];
          fileMatches.forEach(match => {
            const fileNameMatch = match.match(/---\s+([a-zA-Z0-9_.-]+)\s+---/);
            if (fileNameMatch && fileNameMatch[1]) {
              const fileName = fileNameMatch[1].trim();
              let fileContent = match.replace(/---\s+[a-zA-Z0-9_.-]+\s+---/, '').trim();

              // Get file extension
              const fileExt = fileName.split('.').pop() || "";

              // Check if file already exists
              const existingFileIndex = updatedFiles.findIndex(f => f.name === fileName);
              if (existingFileIndex >= 0) {
                // Update existing file
                updatedFiles[existingFileIndex].content = fileContent;
              } else {
                // Add new file
                newFiles.push({
                  name: fileName,
                  content: fileContent,
                  type: fileExt
                });
              }
            }
          });

          // Add new files to the list
          const combinedFiles = [...updatedFiles, ...newFiles];
          setFiles(combinedFiles);

          // Show toast for new files
          if (newFiles.length > 0) {
            toast({
              title: `Created ${newFiles.length} new file(s)`,
              description: `Added: ${newFiles.map(f => f.name).join(', ')}`
            });
          }
        } else {
          // If no file structure detected, treat it as changes to the current file
          updateFileContent(generatedText);
        }

        // Add assistant response
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "✅ Changes applied! Check the preview to see the results."
        }]);
        if (showApiKeyInput) {
          saveApiKey();
        }

        // Update preview
        setLastRefreshTime(Date.now());
      } else {
        throw new Error("Invalid response format from API");
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `❌ Error: ${error instanceof Error ? error.message : "Failed to process request"}`
      }]);
      toast({
        title: "Error",
        description: "Failed to process your request. Please check your API key and try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const creditPercentage = dailyCredits / DAILY_CREDIT_LIMIT * 100;
  return (
    <div className={`flex flex-col h-screen bg-background ${theme}`}>
      {/* Header */}
      <header className="border-b p-4 bg-background flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Code className="h-6 w-6" />
          <h1 className={cn("text-xl font-semibold", isMobile && "sr-only")}>Boongle AI - Software Engineer</h1>
          {isMobile && <h1 className="text-lg font-semibold">Boongle AI</h1>}
        </div>
        <div className="flex gap-2 items-center">
          <Link to="/supabase">
            <Button variant="outline" size={isMobile ? "icon" : "sm"} className={isMobile ? "h-9 w-9 p-0" : ""}>
              <Database className="h-4 w-4" />
              {!isMobile && <span className="ml-1">Supabase</span>}
            </Button>
          </Link>
          <Navigation />
          <div className="flex gap-1 md:gap-2 items-center">
            <div className={cn("flex items-center gap-1 md:gap-2", isMobile ? "mr-1" : "mr-4")}>
              <span className={cn("text-sm font-medium", isMobile && "hidden md:inline")}>
                {hasUnlimitedCredits ? "∞" : `${totalAvailableCredits}`} Credits
              </span>
              {!hasUnlimitedCredits && !isMobile && <Progress value={creditPercentage} className="w-24 h-2" />}
              <Button size={isMobile ? "icon" : "sm"} variant="outline" onClick={() => setShowClaimDialog(true)} className={isMobile ? "h-9 w-9 p-0" : ""}>
                <Gift className="h-4 w-4" />
                {!isMobile && <span className="ml-1">Claim</span>}
              </Button>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size={isMobile ? "icon" : "sm"} variant="outline" className={isMobile ? "h-9 w-9 p-0" : ""}>
                  <RefreshCcw className="h-4 w-4" />
                  {!isMobile && <span className="ml-1">Reset</span>}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className={isMobile ? "w-[90vw] max-w-[90vw] p-4" : ""}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset Project</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will reset your project to its default state. All your code changes, file explorer, and chat history will be lost. Are you sure you want to continue?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={resetProject} className="bg-destructive text-destructive-foreground">
                    Reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Toggle aria-label="Toggle theme" pressed={theme === "dark"} onPressedChange={pressed => setTheme(pressed ? "dark" : "light")} className={isMobile ? "h-9 w-9 p-0" : ""}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Toggle>
            <Button size={isMobile ? "icon" : "sm"} variant="outline" onClick={() => {
            updatePreview();
            setLastRefreshTime(Date.now());
          }} className={isMobile ? "h-9 w-9 p-0" : ""}>
              <Play className="h-4 w-4" />
              {!isMobile && <span className="ml-1">Run</span>}
            </Button>
          </div>
        </div>
      </header>

      {/* Claim Code Dialog */}
      <Dialog open={showClaimDialog} onOpenChange={setShowClaimDialog}>
        <DialogContent className={cn("sm:max-w-md", isMobile && "w-[90vw] max-w-[90vw] p-4 rounded-lg")}>
          <DialogHeader>
            <DialogTitle>Claim Credits</DialogTitle>
            <DialogDescription>
              Enter your code to claim additional credits
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Enter claim code</label>
              <Input placeholder="Enter code..." value={claimCode} onChange={e => setClaimCode(e.target.value)} />
            </div>
            
            {/* Credits status */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Your Credits</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span>Daily:</span>
                  <span className="font-semibold">{dailyCredits}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span>Lifetime:</span>
                  <span className="font-semibold">{lifetimeCredits}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded col-span-2">
                  <span>Unlimited:</span>
                  <span className="font-semibold">{hasUnlimitedCredits ? "Yes" : "No"}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Daily credits reset every 24 hours. Lifetime credits never expire.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClaimDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleClaimCode}>
              Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Image Upload Dialog */}
      <Dialog open={showImageUpload} onOpenChange={setShowImageUpload}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Image Upload</DialogTitle>
            <DialogDescription>
              Upload an image to generate a website design
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {imageUpload && <div className="border rounded-md p-2 flex justify-center">
                <img src={URL.createObjectURL(imageUpload)} alt="Uploaded" className="max-h-[300px] object-contain" />
              </div>}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Add a description (optional)</label>
              <Input placeholder="Describe what you want to build..." value={userPrompt} onChange={e => setUserPrompt(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelImageUpload}>
              Cancel
            </Button>
            <Button onClick={confirmImageUpload}>
              Generate Website
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Left Panel - Code Editor */}
        <ResizablePanel defaultSize={50} minSize={30} className={`${isFullscreen ? 'hidden' : ''} h-full`}>
          <div className="border-r h-full flex flex-col">
            <div className="p-2 bg-muted flex items-center justify-between">
              <Tabs value={editorView} onValueChange={value => setEditorView(value as "code" | "files")} className="w-full">
                <TabsList className={cn("grid w-60 grid-cols-2", isMobile && "w-full")}>
                  <TabsTrigger value="code">Editor</TabsTrigger>
                  <TabsTrigger value="files">File Explorer</TabsTrigger>
                </TabsList>
              </Tabs>
              
              <div className="flex items-center gap-2">
                {editorView === "code" && <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        {currentFile} <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {files.map(file => <DropdownMenuItem key={file.name} onClick={() => setCurrentFile(file.name)} className={cn("cursor-pointer", currentFile === file.name && "bg-accent")}>
                          {file.name}
                        </DropdownMenuItem>)}
                    </DropdownMenuContent>
                  </DropdownMenu>}
                
                <PreviewSettings files={files} mainFile={mainPreviewFile} setMainFile={setMainPreviewFile} />
              </div>
            </div>
            
            <div className="flex-1 h-full">
              <Tabs value={editorView} className="h-full">
                <TabsContent value="code" className="h-full mt-0">
                  <CodeEditor 
                    value={getCurrentFileContent()} 
                    onChange={handleCodeEditorChange} 
                    language={getCurrentFileLanguage()} 
                  />
                </TabsContent>
                
                <TabsContent value="files" className="h-full mt-0 overflow-hidden">
                  {/* Add file upload component */}
                  <div className="p-2">
                    <FileExplorerUpload onFileUpload={handleFileUpload} />
                  </div>
                  <FileExplorerEnhanced files={files} setFiles={setFiles} currentFile={currentFile} setCurrentFile={setCurrentFile} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </ResizablePanel>

        {isFullscreen ? null : <ResizableHandle withHandle />}

        {/* Right Panel - Chat and Preview */}
        <ResizablePanel defaultSize={50} minSize={30} className="h-full">
          <ResizablePanelGroup direction="vertical">
            {/* Preview Section */}
            <ResizablePanel defaultSize={50} minSize={20} className="border-b">
              <div className="h-full flex flex-col">
                <div className="p-2 bg-muted flex items-center justify-between">
                  <div className="flex items-center">
                    <Eye className="h-4 w-4 mr-2" />
                    <span className="text-sm font-medium">Preview: {mainPreviewFile}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "View fullscreen"}>
                    <Maximize className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 bg-white">
                  <iframe ref={previewIframeRef} title="Preview" className="w-full h-full" sandbox="allow-scripts allow-same-origin" />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Chat Section */}
            <ResizablePanel defaultSize={50} minSize={20}>
              <div className="h-full flex flex-col">
                <div className="p-2 bg-muted flex items-center justify-between">
                  <div className="flex items-center">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    <span className="text-sm font-medium">Chat</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={clearChatHistory} title="Clear chat history">
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>

                {/* API Key Input */}
                {showApiKeyInput && <div className="border-b p-3">
                    <label className="block text-sm font-medium mb-1">Enter Gemini API Key</label>
                    <div className="flex gap-2">
                      <Input type="password" placeholder="AIza..." value={apiKey} onChange={e => setApiKey(e.target.value)} />
                      <Button size="sm" onClick={saveApiKey}>
                        <Save className="h-4 w-4 mr-2" /> Save
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your API key is stored locally and never sent to our servers.
                    </p>
                  </div>}

                {/* Messages */}
                <div className="flex-1 overflow-auto p-4" ref={chatContainerRef}>
                  <div className="space-y-4">
                    {messages.map((msg, i) => <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-lg p-3 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          {msg.image && <div className="mb-3">
                              <img src={msg.image} alt="User uploaded" className="max-w-full rounded-md max-h-[200px]" />
                            </div>}
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>)}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
                
                {/* Build Error Message */}
                {buildError && <div className="border-t p-3 bg-destructive/10">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-destructive">Build Unsuccessful</span>
                      <Button variant="destructive" size="sm" onClick={handleFixCodeErrors}>
                        Fix
                      </Button>
                    </div>
                    <p className="text-sm mt-1 text-muted-foreground">
                      The code contains syntax errors. There might be markdown backticks (```) in the code.
                    </p>
                  </div>}

                {/* Input Area */}
                <form onSubmit={handleSubmit} className="border-t p-3 flex gap-2">
                  <div className="flex items-center">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" ref={fileInputRef} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isLoading || totalAvailableCredits <= 0 && !hasUnlimitedCredits} title="Upload image">
                      <Image className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input placeholder="Ask Boongle AI to build anything..." value={userPrompt} onChange={e => setUserPrompt(e.target.value)} disabled={isLoading || totalAvailableCredits <= 0 && !hasUnlimitedCredits} className="flex-1 rounded" />
                  <Button type="submit" variant="circle" disabled={isLoading || totalAvailableCredits <= 0 && !hasUnlimitedCredits} className="transition-transform hover:scale-105 hover:shadow-lg">
                    {isLoading ? <div className="flex items-center justify-center">
                        <div className="w-5 h-5 relative animate-spin rounded-full border-2 border-solid border-gray-300 border-t-transparent"></div>
                      </div> : <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-up">
                        <path d="m5 12 7-7 7 7"></path>
                        <path d="M12 19V5"></path>
                      </svg>}
                  </Button>
                </form>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default Index;
